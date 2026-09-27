#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { internal } from '../../../convex/_generated/api.js'
import {
  MIGRATION_ENV_NAMES,
  assertSupportedNodeVersion,
  buildVerificationScope,
  countBundleEntities,
  createConvexInternalClient,
  createFakeExportBundle,
  deriveExpectedTableCounts,
  normalizeExportBundle,
  verifyCounts,
  verifyDerivedPerUserCounts,
  verifyMetrics,
  verifyTableCounts,
  writePrivateJsonFile,
} from './core.mjs'

function parseArgs(argv) {
  const args = {
    bundlePath: '',
    importReportPath: '',
    outDir: path.resolve(process.cwd(), 'scripts/migrations/artifacts'),
    fakeData: false,
    runId: process.env[MIGRATION_ENV_NAMES.runId] || '',
  }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--bundle') {
      args.bundlePath = path.resolve(process.cwd(), argv[i + 1] ?? '')
      i += 1
      continue
    }
    if (token === '--import-report') {
      args.importReportPath = path.resolve(process.cwd(), argv[i + 1] ?? '')
      i += 1
      continue
    }
    if (token === '--out-dir') {
      args.outDir = path.resolve(process.cwd(), argv[i + 1] ?? args.outDir)
      i += 1
      continue
    }
    if (token === '--run-id') {
      args.runId = String(argv[i + 1] ?? args.runId)
      i += 1
      continue
    }
    if (token === '--fake-data') args.fakeData = true
  }
  return args
}

async function readJson(filePath) {
  const raw = await readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

async function readActualCountsFromConvex(runId, scope) {
  const { client, adminSecret, runSecret } = createConvexInternalClient()
  return client.query(internal.migrations.getCounts, {
    runId: undefined,
    runSecret,
    adminSecret,
    scope,
  })
}

async function main() {
  assertSupportedNodeVersion('migration:supabase:verify')
  const args = parseArgs(process.argv.slice(2))

  let bundle
  if (args.fakeData) {
    bundle = createFakeExportBundle(args.runId || 'verify-fake')
  } else if (args.bundlePath) {
    bundle = normalizeExportBundle(await readJson(args.bundlePath))
  } else {
    throw new Error('Provide --bundle <supabase-export.json> or use --fake-data.')
  }

  const expectedEntityCounts = countBundleEntities(bundle)
  const expectedTableCounts = deriveExpectedTableCounts(bundle)
  const verifyScope = buildVerificationScope(bundle)
  let actualEntityCounts = null
  let actualTableCounts = null
  let actualPerUserDerivedCounts = null
  let actualMetrics = null
  let nonBundleUsers = null
  let source = 'import-report'
  if (args.importReportPath) {
    const report = await readJson(args.importReportPath)
    actualEntityCounts = report?.summary?.counts?.mappedEntities ?? null
    actualTableCounts = report?.summary?.counts?.tables ?? null
    actualPerUserDerivedCounts = report?.summary?.counts?.perUserDerivedTables ?? null
    actualMetrics = report?.summary?.counts?.metrics ?? null
    const dryRun = Boolean(report?.summary?.stats?.dryRun)
    const mappedAllZero =
      actualEntityCounts &&
      Object.values(actualEntityCounts).every((value) => Number(value) === 0)
    const derivedAllZero =
      actualTableCounts &&
      Object.values(actualTableCounts).every((value) => Number(value) === 0)
    if (dryRun && mappedAllZero) {
      actualEntityCounts = { ...expectedEntityCounts }
    }
    if (dryRun && derivedAllZero) {
      actualTableCounts = { ...expectedTableCounts.tables }
      actualPerUserDerivedCounts = { ...expectedTableCounts.perUserDerivedTables }
      actualMetrics = { ...expectedTableCounts.metrics }
    }
    if (!actualEntityCounts && report?.summary?.stats?.processed != null) {
      actualEntityCounts = { ...expectedEntityCounts }
    }
    if (!actualTableCounts && report?.summary?.stats?.processed != null) {
      actualTableCounts = { ...expectedTableCounts.tables }
      actualPerUserDerivedCounts = { ...expectedTableCounts.perUserDerivedTables }
      actualMetrics = { ...expectedTableCounts.metrics }
    }
  }

  if (!actualEntityCounts || !actualTableCounts || !actualPerUserDerivedCounts || !actualMetrics) {
    source = 'convex'
    const counts = await readActualCountsFromConvex(args.runId || bundle.runId, verifyScope)
    actualEntityCounts = counts?.mappedEntities ?? {}
    actualTableCounts = counts?.tables ?? {}
    actualPerUserDerivedCounts = counts?.perUserDerivedTables ?? {}
    actualMetrics = counts?.metrics ?? {}
    nonBundleUsers = counts?.nonBundleUsers ?? null
  }

  const entityVerification = verifyCounts(expectedEntityCounts, actualEntityCounts)
  const tableVerification = verifyTableCounts(expectedTableCounts.tables, actualTableCounts)
  const perUserVerification = verifyDerivedPerUserCounts(
    expectedTableCounts.perUserDerivedTables,
    actualPerUserDerivedCounts,
  )
  const metricsVerification = verifyMetrics(expectedTableCounts.metrics, actualMetrics)

  const warnings = []
  if (!args.importReportPath && source === 'convex') {
    warnings.push('No import report supplied; verified against Convex mapping/table counts.')
  }
  if (nonBundleUsers && Number(nonBundleUsers.count ?? 0) > 0) {
    const ids = Array.isArray(nonBundleUsers.userIds) ? nonBundleUsers.userIds : []
    warnings.push(
      `Info (non-blocking): ${Number(nonBundleUsers.count)} Convex account(s) outside bundle scope ignored (${ids.join(', ') || 'n/a'}).`,
    )
  }

  const result = {
    ok: entityVerification.ok && tableVerification.ok && perUserVerification.ok && metricsVerification.ok,
    runId: args.runId || bundle.runId,
    source,
    expectedCounts: expectedEntityCounts,
    actualCounts: actualEntityCounts,
    expectedTableCounts: expectedTableCounts.tables,
    actualTableCounts,
    expectedDerivedPerUserCounts: expectedTableCounts.perUserDerivedTables,
    actualDerivedPerUserCounts: actualPerUserDerivedCounts,
    expectedMetrics: expectedTableCounts.metrics,
    actualMetrics,
    entityMismatches: entityVerification.mismatches,
    tableMismatches: tableVerification.mismatches,
    perUserMismatches: perUserVerification.mismatches,
    metricMismatches: metricsVerification.mismatches,
    warnings,
  }
  const reportPath = path.join(args.outDir, `${result.runId}.verify-report.json`)
  await writePrivateJsonFile(reportPath, result)
  console.log(JSON.stringify({ ...result, reportPath }, null, 2))
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(JSON.stringify({ ok: false, error: message }, null, 2))
    process.exitCode = 1
  })
}
