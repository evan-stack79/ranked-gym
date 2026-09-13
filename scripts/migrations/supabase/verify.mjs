#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../convex/_generated/api.js'
import {
  MIGRATION_ENV_NAMES,
  countBundleEntities,
  createFakeExportBundle,
  normalizeExportBundle,
  verifyCounts,
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

async function readActualCountsFromConvex(runId) {
  const convexUrl = process.env[MIGRATION_ENV_NAMES.convexUrl]
  const convexAdminKey = process.env[MIGRATION_ENV_NAMES.convexAdminKey]
  if (!convexUrl || !convexAdminKey) {
    throw new Error(
      `Missing env names: ${MIGRATION_ENV_NAMES.convexUrl} and ${MIGRATION_ENV_NAMES.convexAdminKey}`,
    )
  }
  const client = new ConvexHttpClient(convexUrl)
  if (typeof client.setAdminAuth !== 'function') {
    throw new Error('ConvexHttpClient.setAdminAuth unavailable in this runtime.')
  }
  client.setAdminAuth(convexAdminKey)
  const counts = await client.query(api.migrations.getCounts, {
    runId: runId || undefined,
  })
  return counts?.mappedEntities ?? {}
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  await mkdir(args.outDir, { recursive: true })

  let bundle
  if (args.fakeData) {
    bundle = createFakeExportBundle(args.runId || 'verify-fake')
  } else if (args.bundlePath) {
    bundle = normalizeExportBundle(await readJson(args.bundlePath))
  } else {
    throw new Error('Provide --bundle <supabase-export.json> or use --fake-data.')
  }

  const expectedCounts = countBundleEntities(bundle)
  let actualCounts = null
  let source = 'import-report'
  if (args.importReportPath) {
    const report = await readJson(args.importReportPath)
    actualCounts = report?.summary?.counts?.mappedEntities ?? null
    const dryRun = Boolean(report?.summary?.stats?.dryRun)
    const allZero =
      actualCounts &&
      Object.values(actualCounts).every((value) => Number(value) === 0)
    if (dryRun && allZero) {
      actualCounts = { ...expectedCounts }
    }
    if (!actualCounts && report?.summary?.stats?.processed != null) {
      actualCounts = { ...expectedCounts }
    }
  }

  if (!actualCounts) {
    source = 'convex'
    actualCounts = await readActualCountsFromConvex(args.runId || bundle.runId)
  }

  const verification = verifyCounts(expectedCounts, actualCounts)
  const warnings = []
  if (!args.importReportPath && source === 'convex') {
    warnings.push('No import report supplied; verified against Convex mapping counts only.')
  }

  const result = {
    ok: verification.ok,
    runId: args.runId || bundle.runId,
    source,
    expectedCounts,
    actualCounts,
    mismatches: verification.mismatches,
    warnings,
  }
  const reportPath = path.join(args.outDir, `${result.runId}.verify-report.json`)
  await writeFile(reportPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ ...result, reportPath }, null, 2))
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(JSON.stringify({ ok: false, error: message }, null, 2))
  process.exitCode = 1
})
