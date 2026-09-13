#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import {
  MIGRATION_ENTITY_ORDER,
  MIGRATION_ENV_NAMES,
  checksumFor,
  countBundleEntities,
  createFakeExportBundle,
  normalizeExportBundle,
} from './core.mjs'

function parseArgs(argv) {
  const args = {
    outDir: path.resolve(process.cwd(), 'scripts/migrations/artifacts'),
    fakeData: false,
    dryRun: false,
    runId: process.env[MIGRATION_ENV_NAMES.runId] || `run-${Date.now()}`,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
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
    if (token === '--dry-run') args.dryRun = true
  }
  return args
}

async function fetchAllRows(client, table, columns = '*') {
  const pageSize = 1000
  let offset = 0
  const rows = []
  while (true) {
    const { data, error } = await client.from(table).select(columns).range(offset, offset + pageSize - 1)
    if (error) throw new Error(`[export:${table}] ${error.message}`)
    const page = Array.isArray(data) ? data : []
    rows.push(...page)
    if (page.length < pageSize) break
    offset += pageSize
  }
  return rows
}

async function fetchAuthUsers(client) {
  let page = 1
  const perPage = 1000
  const users = []
  while (true) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage,
    })
    if (error) throw new Error(`[export:auth_users] ${error.message}`)
    const pageUsers = Array.isArray(data?.users) ? data.users : []
    users.push(
      ...pageUsers.map((row) => ({
        id: row.id,
        email: row.email,
        user_metadata: row.user_metadata ?? {},
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
    )
    if (pageUsers.length < perPage) break
    page += 1
  }
  return users
}

function buildManifest(bundle) {
  const counts = countBundleEntities(bundle)
  const checksums = {}
  for (const entityType of MIGRATION_ENTITY_ORDER) {
    checksums[entityType] = checksumFor(bundle.entities[entityType])
  }
  return {
    runId: bundle.runId,
    exportedAt: bundle.exportedAt,
    source: bundle.source,
    counts,
    checksums,
    bundleChecksum: checksumFor(bundle),
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  let bundle
  if (args.fakeData) {
    bundle = createFakeExportBundle(args.runId)
  } else {
    const supabaseUrl = process.env[MIGRATION_ENV_NAMES.supabaseUrl]
    const serviceRoleKey = process.env[MIGRATION_ENV_NAMES.supabaseServiceRoleKey]
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        `Missing env names: ${MIGRATION_ENV_NAMES.supabaseUrl} and ${MIGRATION_ENV_NAMES.supabaseServiceRoleKey}`,
      )
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const [
      authUsers,
      profiles,
      workouts,
      nutrition,
      checkins,
      aliments,
      activities,
      aiUsageLimits,
      userBackups,
    ] = await Promise.all([
      fetchAuthUsers(supabase),
      fetchAllRows(supabase, 'profiles'),
      fetchAllRows(supabase, 'workouts'),
      fetchAllRows(supabase, 'nutrition'),
      fetchAllRows(supabase, 'checkins'),
      fetchAllRows(supabase, 'aliments'),
      fetchAllRows(supabase, 'activities'),
      fetchAllRows(supabase, 'ai_usage_limits'),
      fetchAllRows(supabase, 'user_backups'),
    ])
    bundle = normalizeExportBundle({
      runId: args.runId,
      exportedAt: new Date().toISOString(),
      source: { mode: 'live', supabaseUrl },
      entities: {
        auth_users: authUsers,
        profiles,
        workouts,
        nutrition,
        checkins,
        aliments,
        activities,
        ai_usage_limits: aiUsageLimits,
        user_backups: userBackups,
      },
    })
  }

  const manifest = buildManifest(bundle)
  await mkdir(args.outDir, { recursive: true })
  const bundlePath = path.join(args.outDir, `${bundle.runId}.supabase-export.json`)
  const manifestPath = path.join(args.outDir, `${bundle.runId}.manifest.json`)
  await writeFile(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8')
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  const response = {
    ok: true,
    dryRun: args.dryRun,
    fakeData: args.fakeData,
    bundlePath,
    manifestPath,
    counts: manifest.counts,
  }
  console.log(JSON.stringify(response, null, 2))
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(JSON.stringify({ ok: false, error: message }, null, 2))
  process.exitCode = 1
})
