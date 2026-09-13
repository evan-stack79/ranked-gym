import { createHash } from 'node:crypto'

export const MIGRATION_ENTITY_ORDER = [
  'auth_users',
  'profiles',
  'workouts',
  'nutrition',
  'checkins',
  'aliments',
  'activities',
  'ai_usage_limits',
  'user_backups',
]

export const MIGRATION_ENV_NAMES = {
  supabaseUrl: 'MIGRATION_SUPABASE_URL',
  supabaseServiceRoleKey: 'MIGRATION_SUPABASE_SERVICE_ROLE_KEY',
  convexUrl: 'MIGRATION_CONVEX_URL',
  convexAdminKey: 'MIGRATION_CONVEX_ADMIN_KEY',
  runId: 'MIGRATION_RUN_ID',
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function toIsoString(value) {
  if (typeof value === 'string' && value.trim()) {
    const asDate = new Date(value)
    if (!Number.isNaN(asDate.getTime())) return asDate.toISOString()
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const asDate = new Date(value)
    if (!Number.isNaN(asDate.getTime())) return asDate.toISOString()
  }
  return new Date(0).toISOString()
}

function toUnixMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value)
  if (typeof value === 'string' && value.trim()) {
    const ms = Date.parse(value)
    if (!Number.isNaN(ms)) return ms
  }
  return Date.now()
}

function toDisplayName(authUser) {
  const meta = authUser?.user_metadata
  if (meta && typeof meta === 'object') {
    if (typeof meta.pseudo === 'string' && meta.pseudo.trim()) return meta.pseudo.trim()
    if (typeof meta.display_name === 'string' && meta.display_name.trim()) return meta.display_name.trim()
    if (typeof meta.name === 'string' && meta.name.trim()) return meta.name.trim()
  }
  if (typeof authUser?.email === 'string' && authUser.email.includes('@')) {
    return authUser.email.split('@')[0]
  }
  return 'Athlete'
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }
  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
  const body = entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')
  return `{${body}}`
}

export function checksumFor(value) {
  return createHash('sha256').update(stableStringify(value)).digest('hex')
}

export function normalizeExportBundle(raw) {
  const bundle = raw && typeof raw === 'object' ? raw : {}
  const entities = bundle.entities && typeof bundle.entities === 'object' ? bundle.entities : {}
  const normalized = {}
  for (const key of MIGRATION_ENTITY_ORDER) {
    normalized[key] = asArray(entities[key])
  }
  return {
    schemaVersion: 1,
    runId: typeof bundle.runId === 'string' && bundle.runId.trim() ? bundle.runId.trim() : 'migration-run',
    exportedAt: toIsoString(bundle.exportedAt ?? Date.now()),
    source: {
      mode: bundle.source?.mode === 'live' ? 'live' : 'fake',
      supabaseUrl:
        typeof bundle.source?.supabaseUrl === 'string' && bundle.source.supabaseUrl.trim()
          ? bundle.source.supabaseUrl.trim()
          : null,
    },
    entities: normalized,
  }
}

export function countBundleEntities(bundle) {
  const normalized = normalizeExportBundle(bundle)
  const counts = {}
  for (const key of MIGRATION_ENTITY_ORDER) {
    counts[key] = normalized.entities[key].length
  }
  return counts
}

export function createFakeExportBundle(runId = 'dry-run-fake') {
  const now = new Date('2026-09-13T18:00:00.000Z')
  const createdAt = new Date('2026-09-10T10:00:00.000Z').toISOString()
  const updatedAt = new Date('2026-09-13T17:45:00.000Z').toISOString()
  return normalizeExportBundle({
    runId,
    exportedAt: now.toISOString(),
    source: {
      mode: 'fake',
      supabaseUrl: 'https://example.supabase.co',
    },
    entities: {
      auth_users: [
        {
          id: 'user-a',
          email: 'user-a@example.com',
          user_metadata: { pseudo: 'Alpha' },
          created_at: createdAt,
          updated_at: updatedAt,
        },
        {
          id: 'user-b',
          email: 'user-b@example.com',
          user_metadata: { pseudo: 'Bravo' },
          created_at: createdAt,
          updated_at: updatedAt,
        },
      ],
      profiles: [
        {
          id: 'user-a',
          pseudo: 'Alpha',
          level: 3,
          xp: 340,
          rank: 'Silver',
          discipline: 'Musculation',
          is_ghost_mode_enabled: false,
          created_at: createdAt,
          updated_at: updatedAt,
        },
        {
          id: 'user-b',
          pseudo: 'Bravo',
          level: 5,
          xp: 980,
          rank: 'Gold',
          discipline: 'Crossfit',
          is_ghost_mode_enabled: true,
          created_at: createdAt,
          updated_at: updatedAt,
        },
      ],
      workouts: [
        {
          user_id: 'user-a',
          state: {
            workoutNotes: [
              {
                id: 'wa-1',
                dateKey: '2026-09-12',
                exercises: [{ name: 'Bench Press', sets: [{ weightKg: 70, reps: 8 }] }],
              },
            ],
          },
          progress: { level: 3 },
          updated_at: updatedAt,
        },
        {
          user_id: 'user-b',
          state: {
            workoutNotes: [
              {
                id: 'wb-1',
                dateKey: '2026-09-11',
                exercises: [{ name: 'Squat', sets: [{ weightKg: 120, reps: 5 }] }],
              },
            ],
          },
          progress: { level: 5 },
          updated_at: updatedAt,
        },
      ],
      nutrition: [
        {
          user_id: 'user-a',
          profile: { onboardingComplete: true },
          journal: {
            '2026-09-12': {
              meals: [{ id: 'meal-a', calories: 500 }],
              waterEntries: [{ id: 'water-a', amountMl: 350 }],
            },
          },
          updated_at: updatedAt,
        },
      ],
      checkins: [
        {
          id: 'checkin-a-1',
          user_id: 'user-a',
          salle_nom: 'Gym A',
          salle_lat: 48.86,
          salle_lng: 2.35,
          gym_payload: { id: 'gym-a', name: 'Gym A' },
          created_at: updatedAt,
        },
      ],
      aliments: [
        {
          id: 'aliment-a-1',
          user_id: 'user-a',
          nom: 'Banane',
          calories: 105,
          proteines: 1.3,
          glucides: 27,
          lipides: 0.3,
          barcode: '1234567890',
          created_at: updatedAt,
        },
      ],
      activities: [
        {
          id: 'activity-a-1',
          user_id: 'user-a',
          activity_type: 'checkin',
          action_text: 'a check-in a Gym A',
          xp_earned: 90,
          origin_lat: 48.86,
          origin_lng: 2.35,
          created_at: updatedAt,
        },
      ],
      ai_usage_limits: [
        {
          user_id: 'user-a',
          date_of_scan: '2026-09-13',
          scan_count: 2,
          updated_at: updatedAt,
        },
      ],
      user_backups: [
        {
          user_id: 'user-a',
          payload: { version: 4, training: { workoutNotes: [] } },
          updated_at: updatedAt,
        },
      ],
    },
  })
}

function mapAuthUserRow(row) {
  const userId = String(row.id ?? '')
  return {
    supabaseId: userId,
    payload: {
      userId,
      email: String(row.email ?? ''),
      emailNorm: String(row.email ?? '').trim().toLowerCase(),
      displayName: toDisplayName(row),
      createdAt: toUnixMs(row.created_at),
      updatedAt: toUnixMs(row.updated_at),
    },
  }
}

function mapProfileRow(row) {
  const userId = String(row.id ?? '')
  return {
    supabaseId: userId,
    payload: {
      userId,
      pseudo: String(row.pseudo ?? 'Athlete'),
      level: Number(row.level ?? 1),
      xp: Number(row.xp ?? 0),
      rank: String(row.rank ?? 'Bronze'),
      discipline: String(row.discipline ?? 'Musculation'),
      isGhostModeEnabled: Boolean(row.is_ghost_mode_enabled),
      createdAt: toUnixMs(row.created_at),
      updatedAt: toUnixMs(row.updated_at),
    },
  }
}

function mapWorkoutRow(row) {
  return {
    supabaseId: String(row.user_id ?? ''),
    payload: {
      userId: String(row.user_id ?? ''),
      stateJson: row.state ?? {},
      progressJson: row.progress ?? {},
      updatedAt: toUnixMs(row.updated_at),
    },
  }
}

function mapNutritionRow(row) {
  return {
    supabaseId: String(row.user_id ?? ''),
    payload: {
      userId: String(row.user_id ?? ''),
      profileJson: row.profile ?? {},
      journalJson: row.journal ?? {},
      updatedAt: toUnixMs(row.updated_at),
    },
  }
}

function mapCheckinRow(row) {
  return {
    supabaseId: String(row.id ?? ''),
    payload: {
      userId: String(row.user_id ?? ''),
      salleNom: String(row.salle_nom ?? 'Salle'),
      salleLat: row.salle_lat == null ? null : Number(row.salle_lat),
      salleLng: row.salle_lng == null ? null : Number(row.salle_lng),
      gymPayload: row.gym_payload ?? null,
      createdAt: toUnixMs(row.created_at),
    },
  }
}

function mapAlimentRow(row) {
  return {
    supabaseId: String(row.id ?? ''),
    payload: {
      userId: String(row.user_id ?? ''),
      nom: String(row.nom ?? 'Aliment'),
      calories: Number(row.calories ?? 0),
      proteines: Number(row.proteines ?? 0),
      glucides: Number(row.glucides ?? 0),
      lipides: Number(row.lipides ?? 0),
      barcode: row.barcode == null ? null : String(row.barcode),
      createdAt: toUnixMs(row.created_at),
    },
  }
}

function mapActivityRow(row) {
  return {
    supabaseId: String(row.id ?? ''),
    payload: {
      userId: String(row.user_id ?? ''),
      activityType: String(row.activity_type ?? 'workout'),
      actionText: String(row.action_text ?? ''),
      xpEarned: Number(row.xp_earned ?? 0),
      originLat: row.origin_lat == null ? null : Number(row.origin_lat),
      originLng: row.origin_lng == null ? null : Number(row.origin_lng),
      createdAt: toUnixMs(row.created_at),
    },
  }
}

function mapAiUsageRow(row) {
  const userId = String(row.user_id ?? '')
  const date = String(row.date_of_scan ?? '')
  return {
    supabaseId: `${userId}:${date}`,
    payload: {
      userId,
      dateOfScan: date,
      scanCount: Number(row.scan_count ?? 0),
      updatedAt: toUnixMs(row.updated_at),
    },
  }
}

function mapBackupRow(row) {
  return {
    supabaseId: String(row.user_id ?? ''),
    payload: {
      userId: String(row.user_id ?? ''),
      payloadJson: row.payload ?? {},
      updatedAt: toUnixMs(row.updated_at),
    },
  }
}

const ENTITY_MAPPERS = {
  auth_users: mapAuthUserRow,
  profiles: mapProfileRow,
  workouts: mapWorkoutRow,
  nutrition: mapNutritionRow,
  checkins: mapCheckinRow,
  aliments: mapAlimentRow,
  activities: mapActivityRow,
  ai_usage_limits: mapAiUsageRow,
  user_backups: mapBackupRow,
}

export function buildImportRows(rawBundle) {
  const bundle = normalizeExportBundle(rawBundle)
  const rows = []
  for (const entityType of MIGRATION_ENTITY_ORDER) {
    const mapper = ENTITY_MAPPERS[entityType]
    const sourceRows = bundle.entities[entityType]
    for (const sourceRow of sourceRows) {
      const mapped = mapper(sourceRow)
      if (!mapped.supabaseId) {
        throw new Error(`Missing Supabase id for entity ${entityType}`)
      }
      const checksumPayload = {
        entityType,
        supabaseId: mapped.supabaseId,
        payload: mapped.payload,
      }
      rows.push({
        entityType,
        supabaseId: mapped.supabaseId,
        payload: mapped.payload,
        checksum: checksumFor(checksumPayload),
      })
    }
  }
  return rows
}

export function createInMemoryImportTarget() {
  const mapRows = new Map()
  const tableRows = new Map()
  let idCounter = 0

  function nextId(entityType) {
    idCounter += 1
    return `${entityType}:${idCounter}`
  }

  function keyOf(entityType, supabaseId) {
    return `${entityType}:${supabaseId}`
  }

  return {
    upsertImportRow(row) {
      const key = keyOf(row.entityType, row.supabaseId)
      const existing = mapRows.get(key)
      if (!existing) {
        const convexId = nextId(row.entityType)
        mapRows.set(key, {
          convexId,
          checksum: row.checksum,
          entityType: row.entityType,
          supabaseId: row.supabaseId,
        })
        tableRows.set(convexId, {
          entityType: row.entityType,
          payload: row.payload,
        })
        return { operation: 'inserted', convexId }
      }

      if (existing.checksum === row.checksum) {
        return { operation: 'skipped', convexId: existing.convexId }
      }

      mapRows.set(key, {
        ...existing,
        checksum: row.checksum,
      })
      tableRows.set(existing.convexId, {
        entityType: row.entityType,
        payload: row.payload,
      })
      return { operation: 'updated', convexId: existing.convexId }
    },
    getCounts() {
      const mappedEntities = {}
      const tables = {}
      for (const entityType of MIGRATION_ENTITY_ORDER) {
        mappedEntities[entityType] = 0
        tables[entityType] = 0
      }
      for (const mapRow of mapRows.values()) {
        mappedEntities[mapRow.entityType] += 1
      }
      for (const tableRow of tableRows.values()) {
        tables[tableRow.entityType] += 1
      }
      return { mappedEntities, tables }
    },
    getIdMapEntries() {
      return [...mapRows.entries()].map(([key, row]) => ({
        key,
        entityType: row.entityType,
        supabaseId: row.supabaseId,
        convexId: row.convexId,
        checksum: row.checksum,
      }))
    },
  }
}

export async function applyImportRows(target, rows, options = {}) {
  const stats = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    dryRun: Boolean(options.dryRun),
    processed: rows.length,
  }
  const idMap = {}
  for (const row of rows) {
    if (options.dryRun) {
      const key = `${row.entityType}:${row.supabaseId}`
      idMap[key] = null
      stats.inserted += 1
      continue
    }
    const result = await target.upsertImportRow(row)
    if (result.operation === 'inserted') stats.inserted += 1
    if (result.operation === 'updated') stats.updated += 1
    if (result.operation === 'skipped') stats.skipped += 1
    idMap[`${row.entityType}:${row.supabaseId}`] = result.convexId
  }
  const counts = typeof target.getCounts === 'function' ? target.getCounts() : null
  return {
    stats,
    counts,
    idMap,
  }
}

export function verifyCounts(expectedCounts, actualCounts) {
  const mismatches = []
  for (const entityType of MIGRATION_ENTITY_ORDER) {
    const expected = Number(expectedCounts?.[entityType] ?? 0)
    const actual = Number(actualCounts?.[entityType] ?? 0)
    if (expected !== actual) {
      mismatches.push({
        entityType,
        expected,
        actual,
      })
    }
  }
  return {
    ok: mismatches.length === 0,
    mismatches,
  }
}
