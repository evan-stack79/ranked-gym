#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { internal } from '../../../convex/_generated/api.js'
import {
  MIGRATION_ENV_NAMES,
  applyImportRows,
  buildImportRows,
  countBundleEntities,
  createConvexInternalClient,
  createFakeExportBundle,
  createInMemoryImportTarget,
  normalizeExportBundle,
} from './core.mjs'

function parseArgs(argv) {
  const args = {
    inputPath: '',
    outDir: path.resolve(process.cwd(), 'scripts/migrations/artifacts'),
    dryRun: false,
    fakeData: false,
    runId: process.env[MIGRATION_ENV_NAMES.runId] || `run-${Date.now()}`,
    sourceSha: process.env.RISK_SHA || process.env.GIT_SHA || 'unknown',
  }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--input') {
      args.inputPath = path.resolve(process.cwd(), argv[i + 1] ?? '')
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
    if (token === '--source-sha') {
      args.sourceSha = String(argv[i + 1] ?? args.sourceSha)
      i += 1
      continue
    }
    if (token === '--dry-run') args.dryRun = true
    if (token === '--fake-data') args.fakeData = true
  }
  return args
}

async function readJson(filePath) {
  const raw = await readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

function createConvexTarget(config) {
  const { client, adminSecret, runSecret } = config

  return {
    async start() {
      await client.mutation(internal.migrations.startRun, {
        runId: config.runId,
        sourceSha: config.sourceSha,
        runSecret,
        adminSecret,
      })
    },
    async upsertImportRow(row) {
      return client.mutation(internal.migrations.importEntity, {
        runId: config.runId,
        sourceSha: config.sourceSha,
        runSecret,
        adminSecret,
        entityType: row.entityType,
        supabaseId: row.supabaseId,
        checksum: row.checksum,
        payload: row.payload,
      })
    },
    async finish(status, summaryJson) {
      await client.mutation(internal.migrations.finishRun, {
        runId: config.runId,
        runSecret,
        adminSecret,
        status,
        summaryJson,
      })
    },
    async getCounts() {
      return client.query(internal.migrations.getCounts, {
        runId: config.runId,
        runSecret,
        adminSecret,
      })
    },
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  await mkdir(args.outDir, { recursive: true })

  let bundle
  if (args.fakeData) {
    bundle = createFakeExportBundle(args.runId)
  } else if (args.inputPath) {
    bundle = normalizeExportBundle(await readJson(args.inputPath))
  } else {
    throw new Error('Provide --input <bundle.json> or use --fake-data.')
  }

  const rows = buildImportRows(bundle)
  const expectedCounts = countBundleEntities(bundle)

  let summary
  if (args.dryRun) {
    const preview = createInMemoryImportTarget()
    summary = await applyImportRows(preview, rows, { dryRun: true })
    summary.counts = {
      mappedEntities: { ...expectedCounts },
      tables: { ...expectedCounts },
    }
  } else {
    const { client, adminSecret, runSecret } = createConvexInternalClient()
    const target = createConvexTarget({
      client,
      adminSecret,
      runSecret,
      runId: bundle.runId,
      sourceSha: args.sourceSha,
    })
    await target.start()
    try {
      summary = await applyImportRows(target, rows, { dryRun: false })
      const counts = await target.getCounts()
      summary.counts = counts
      await target.finish('completed', summary)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await target.finish('failed', { error: message })
      throw error
    }
  }

  const report = {
    ok: true,
    dryRun: args.dryRun,
    fakeData: args.fakeData,
    runId: bundle.runId,
    sourceSha: args.sourceSha,
    expectedCounts,
    summary,
  }
  const reportPath = path.join(args.outDir, `${bundle.runId}.convex-import-report.json`)
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ ...report, reportPath }, null, 2))
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(JSON.stringify({ ok: false, error: message }, null, 2))
  process.exitCode = 1
})
