#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { internal } from '../../../convex/_generated/api.js'
import { MIGRATION_ENV_NAMES, createConvexInternalClient } from './core.mjs'

function parseArgs(argv) {
  const args = {
    outDir: path.resolve(process.cwd(), 'scripts/migrations/artifacts'),
    runId: process.env[MIGRATION_ENV_NAMES.runId] || `avatar-run-${Date.now()}`,
    sourceSha: process.env.RISK_SHA || process.env.GIT_SHA || 'unknown',
    dryRun: true,
    fakeData: false,
    limit: null,
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
    if (token === '--source-sha') {
      args.sourceSha = String(argv[i + 1] ?? args.sourceSha)
      i += 1
      continue
    }
    if (token === '--limit') {
      const raw = Number(argv[i + 1] ?? '')
      args.limit = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : null
      i += 1
      continue
    }
    if (token === '--dry-run') args.dryRun = true
    if (token === '--execute') args.dryRun = false
    if (token === '--fake-data') args.fakeData = true
  }
  return args
}

function toUnixMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value)
  if (typeof value === 'string' && value.trim()) {
    const ms = Date.parse(value)
    if (!Number.isNaN(ms)) return ms
  }
  return Date.now()
}

function parseUserIdFromPath(objectPath) {
  if (typeof objectPath !== 'string') return null
  const normalized = objectPath.trim().replace(/^\/+/, '')
  if (!normalized) return null
  const userId = normalized.split('/')[0]?.trim() || ''
  if (!userId || userId === '.' || userId === '..') return null
  return userId
}

function normalizeAvatarObject(row) {
  const pathName = String(row.name ?? '').trim()
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  const userId = parseUserIdFromPath(pathName)
  return {
    supabaseObjectId: String(row.id ?? `avatars:${pathName}`),
    path: pathName,
    userId,
    contentType: String(
      metadata.mimetype ?? metadata.contentType ?? metadata.content_type ?? 'application/octet-stream',
    ),
    sizeBytes: Number(metadata.size ?? metadata.contentLength ?? metadata.content_length ?? 0),
    createdAt: toUnixMs(row.created_at),
    updatedAt: toUnixMs(row.updated_at),
  }
}

function fakeAvatarObjects() {
  return [
    {
      supabaseObjectId: 'fake-avatar-1',
      path: 'user-a/avatar.jpg',
      userId: 'user-a',
      contentType: 'image/jpeg',
      sizeBytes: 120_000,
      createdAt: Date.parse('2026-09-12T10:00:00.000Z'),
      updatedAt: Date.parse('2026-09-12T10:00:00.000Z'),
    },
    {
      supabaseObjectId: 'fake-avatar-2',
      path: 'user-b/profile.png',
      userId: 'user-b',
      contentType: 'image/png',
      sizeBytes: 180_000,
      createdAt: Date.parse('2026-09-12T11:00:00.000Z'),
      updatedAt: Date.parse('2026-09-13T12:30:00.000Z'),
    },
  ]
}

async function listSupabaseAvatarObjects(supabase) {
  const pageSize = 1000
  let offset = 0
  const collected = []
  while (true) {
    const { data, error } = await supabase
      .schema('storage')
      .from('objects')
      .select('id,name,bucket_id,created_at,updated_at,metadata')
      .eq('bucket_id', 'avatars')
      .order('name', { ascending: true })
      .range(offset, offset + pageSize - 1)
    if (error) throw new Error(`[avatars:export] ${error.message}`)
    const page = Array.isArray(data) ? data : []
    collected.push(...page.map(normalizeAvatarObject))
    if (page.length < pageSize) break
    offset += pageSize
  }
  return collected
}

function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

async function downloadAvatarBytes(supabase, objectPath) {
  const { data, error } = await supabase.storage.from('avatars').download(objectPath)
  if (error) throw new Error(`[avatars:download:${objectPath}] ${error.message}`)
  const blob = data
  if (!blob) throw new Error(`[avatars:download:${objectPath}] Empty response body`)
  const bytes = Buffer.from(await blob.arrayBuffer())
  return bytes
}

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env name: ${name}`)
  return value
}

function createConvexAdminClient() {
  return createConvexInternalClient()
}

async function uploadToConvexStorage(client, args, bytes, contentType) {
  const generated = await client.mutation(internal.files.generateMigrationAvatarUploadUrl, {
    runId: args.runId,
    sourceSha: args.sourceSha,
    runSecret: args.runSecret,
    adminSecret: args.adminSecret,
  })
  const response = await fetch(generated.uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': contentType || 'application/octet-stream' },
    body: bytes,
  })
  if (!response.ok) {
    throw new Error(`[avatars:upload] Convex upload failed with status ${response.status}`)
  }
  const payload = await response.json()
  if (!payload?.storageId) {
    throw new Error('[avatars:upload] Missing storageId from Convex upload response')
  }
  return payload.storageId
}

function createReportSkeleton(args, avatars) {
  return {
    ok: true,
    runId: args.runId,
    dryRun: args.dryRun,
    fakeData: args.fakeData,
    sourceSha: args.sourceSha,
    totals: {
      discovered: avatars.length,
      validUserPaths: avatars.filter((item) => item.userId).length,
    },
    warnings: [],
    imported: [],
    failed: [],
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  await mkdir(args.outDir, { recursive: true })

  let avatars
  let supabase = null
  if (args.fakeData) {
    avatars = fakeAvatarObjects()
  } else {
    const supabaseUrl = requireEnv(MIGRATION_ENV_NAMES.supabaseUrl)
    const serviceRoleKey = requireEnv(MIGRATION_ENV_NAMES.supabaseServiceRoleKey)
    supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    avatars = await listSupabaseAvatarObjects(supabase)
  }

  if (args.limit) avatars = avatars.slice(0, args.limit)
  avatars = [...avatars].sort((a, b) => a.updatedAt - b.updatedAt || a.createdAt - b.createdAt)

  const report = createReportSkeleton(args, avatars)
  for (const entry of avatars) {
    if (!entry.userId) {
      report.warnings.push(`Skipped invalid avatar path (missing user folder): ${entry.path}`)
    }
  }
  const validEntries = avatars.filter((entry) => entry.userId)

  if (args.dryRun) {
    report.imported = validEntries.map((entry) => ({
      supabaseObjectId: entry.supabaseObjectId,
      userId: entry.userId,
      path: entry.path,
      planned: true,
      sizeBytes: entry.sizeBytes,
      contentType: entry.contentType,
    }))
  } else {
    if (!supabase) {
      throw new Error('Live Supabase credentials are required for --execute.')
    }
    const { client, adminSecret, runSecret } = createConvexAdminClient()
    const convexArgs = {
      runId: args.runId,
      sourceSha: args.sourceSha,
      runSecret,
      adminSecret,
    }
    await client.mutation(internal.migrations.startRun, convexArgs)
    try {
      for (const entry of validEntries) {
        try {
          const bytes = await downloadAvatarBytes(supabase, entry.path)
          const storageId = await uploadToConvexStorage(client, convexArgs, bytes, entry.contentType)
          const sizeBytes = bytes.byteLength || entry.sizeBytes
          const sha256 = sha256Hex(bytes)
          const imported = await client.mutation(internal.files.importSupabaseAvatar, {
            ...convexArgs,
            userId: entry.userId,
            legacySupabasePath: entry.path,
            storageId,
            contentType: entry.contentType,
            sizeBytes,
            sha256,
            createdAt: entry.createdAt,
          })
          report.imported.push({
            supabaseObjectId: entry.supabaseObjectId,
            userId: entry.userId,
            path: entry.path,
            storageId,
            fileId: imported.fileId,
            sha256,
            sizeBytes,
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          report.failed.push({
            supabaseObjectId: entry.supabaseObjectId,
            userId: entry.userId,
            path: entry.path,
            error: message,
          })
        }
      }
      await client.mutation(internal.migrations.finishRun, {
        runId: args.runId,
        runSecret,
        adminSecret,
        status: report.failed.length ? 'failed' : 'completed',
        summaryJson: {
          type: 'avatar-storage-cutover',
          discovered: report.totals.discovered,
          imported: report.imported.length,
          failed: report.failed.length,
          warnings: report.warnings.length,
        },
      })
      report.ok = report.failed.length === 0
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await client.mutation(internal.migrations.finishRun, {
        runId: args.runId,
        runSecret,
        adminSecret,
        status: 'failed',
        summaryJson: { type: 'avatar-storage-cutover', error: message },
      })
      throw error
    }
  }

  const reportPath = path.join(args.outDir, `${args.runId}.avatar-storage-report.json`)
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(
    JSON.stringify(
      {
        ok: report.ok,
        runId: args.runId,
        dryRun: args.dryRun,
        fakeData: args.fakeData,
        discovered: report.totals.discovered,
        imported: report.imported.length,
        failed: report.failed.length,
        warnings: report.warnings.length,
        reportPath,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(JSON.stringify({ ok: false, error: message }, null, 2))
  process.exitCode = 1
})
