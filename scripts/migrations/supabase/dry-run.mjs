#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const outDir = path.resolve(process.cwd(), 'scripts/migrations/artifacts')
const runId = process.env.MIGRATION_RUN_ID || `dry-run-${Date.now()}`

function runNode(script, args) {
  const result = spawnSync('node', [script, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
  })
  if (result.status !== 0) {
    const message = result.stderr || result.stdout || `Command failed: ${script}`
    throw new Error(message.trim())
  }
  const text = result.stdout.trim()
  return JSON.parse(text)
}

function main() {
  const exportResult = runNode('scripts/migrations/supabase/export.mjs', [
    '--fake-data',
    '--dry-run',
    '--run-id',
    runId,
    '--out-dir',
    outDir,
  ])
  const importResult = runNode('scripts/migrations/supabase/import-convex.mjs', [
    '--dry-run',
    '--input',
    exportResult.bundlePath,
    '--run-id',
    runId,
    '--source-sha',
    'dry-run-fake-data',
    '--out-dir',
    outDir,
  ])
  const verifyResult = runNode('scripts/migrations/supabase/verify.mjs', [
    '--bundle',
    exportResult.bundlePath,
    '--import-report',
    importResult.reportPath,
    '--run-id',
    runId,
    '--out-dir',
    outDir,
  ])

  const result = {
    ok: verifyResult.ok,
    runId,
    bundlePath: exportResult.bundlePath,
    importReportPath: importResult.reportPath,
    verifyReportPath: verifyResult.reportPath,
  }
  console.log(JSON.stringify(result, null, 2))
}

try {
  main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(JSON.stringify({ ok: false, error: message }, null, 2))
  process.exitCode = 1
}
