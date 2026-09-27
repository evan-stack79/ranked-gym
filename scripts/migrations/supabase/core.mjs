import { createHash } from 'node:crypto'
import { chmod, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ConvexHttpClient } from 'convex/browser'

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

export const MIGRATION_VERIFY_TABLE_ORDER = [
  'auth_users',
  'profiles',
  'workouts',
  'nutrition',
  'checkins',
  'aliments',
  'activities',
  'ai_usage_limits',
  'user_backups',
  'streak_state',
  'custom_spots',
  'active_checkins',
  'nutrition_meals',
  'nutrition_water_entries',
  'nutrition_day_state',
  'nutrition_food_catalog',
]

export const MIGRATION_DERIVED_TABLE_ORDER = [
  'streak_state',
  'custom_spots',
  'active_checkins',
  'nutrition_meals',
  'nutrition_water_entries',
  'nutrition_day_state',
  'nutrition_food_catalog',
]

export const MIGRATION_NODE_MIN_MAJOR = 22

export const MIGRATION_ENV_NAMES = {
  supabaseUrl: 'MIGRATION_SUPABASE_URL',
  supabaseServiceRoleKey: 'MIGRATION_SUPABASE_SERVICE_ROLE_KEY',
  convexUrl: 'MIGRATION_CONVEX_URL',
  convexAdminKey: 'MIGRATION_CONVEX_ADMIN_KEY',
  adminSecret: 'MIGRATION_ADMIN_SECRET',
  runSecret: 'MIGRATION_RUN_SECRET',
  runId: 'MIGRATION_RUN_ID',
}

function parseNodeMajor(version) {
  const [major] = String(version ?? '').split('.')
  const parsed = Number(major)
  return Number.isFinite(parsed) ? parsed : 0
}

export function assertSupportedNodeVersion(context = 'migration script', version = process.versions.node) {
  const major = parseNodeMajor(version)
  if (major >= MIGRATION_NODE_MIN_MAJOR) return
  throw new Error(
    `[${context}] Node.js ${MIGRATION_NODE_MIN_MAJOR}+ required (detected ${version}). Upgrade Node before running Supabase -> Convex migration scripts.`,
  )
}

export async function ensurePrivateArtifactsDir(dirPath) {
  await mkdir(dirPath, { recursive: true, mode: 0o700 })
  await chmod(dirPath, 0o700)
}

export async function writePrivateTextFile(filePath, text) {
  const dirPath = path.dirname(filePath)
  await ensurePrivateArtifactsDir(dirPath)
  await writeFile(filePath, text, { encoding: 'utf8', mode: 0o600 })
  await chmod(filePath, 0o600)
}

export async function writePrivateJsonFile(filePath, value) {
  await writePrivateTextFile(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

export function requireMigrationSecrets() {
  const adminSecret = process.env[MIGRATION_ENV_NAMES.adminSecret]
  if (!adminSecret) {
    throw new Error(`Missing env name: ${MIGRATION_ENV_NAMES.adminSecret}`)
  }
  const runSecret = process.env[MIGRATION_ENV_NAMES.runSecret] || adminSecret
  return { adminSecret, runSecret }
}

export function createConvexInternalClient() {
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
  const secrets = requireMigrationSecrets()
  return { client, ...secrets }
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

function toDateKey(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim()
  }
  if (typeof value === 'string' && value.trim()) {
    const ms = Date.parse(value)
    if (!Number.isNaN(ms)) return new Date(ms).toISOString().slice(0, 10)
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString().slice(0, 10)
  }
  return null
}

function asRecord(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value
  }
  return null
}

function asArrayOfObjects(value) {
  if (!Array.isArray(value)) return []
  return value.map((item) => asRecord(item)).filter(Boolean)
}

function asNullableNumber(value) {
  if (value == null) return null
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

function asOptionalNumber(value) {
  const parsed = asNullableNumber(value)
  return parsed == null ? undefined : parsed
}

function normalizeMealType(value) {
  const mealType = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (mealType === 'breakfast') return mealType
  if (mealType === 'lunch') return mealType
  if (mealType === 'dinner') return mealType
  if (mealType === 'snack') return mealType
  return 'snack'
}

function normalizePortionMode(value) {
  const mode = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (mode === 'solo') return 'solo'
  if (mode === 'with_sides') return 'with_sides'
  return undefined
}

function normalizeWaterEntryType(value) {
  const type = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (type === 'glass') return 'glass'
  if (type === 'shaker') return 'shaker'
  if (type === 'bottle') return 'bottle'
  if (type === 'manual') return 'manual'
  if (type === 'legacy') return 'legacy'
  return 'manual'
}

function normalizeWaterEntryLabel(type, value) {
  if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 64)
  if (type === 'glass') return 'Verre'
  if (type === 'shaker') return 'Shaker'
  if (type === 'bottle') return 'Bouteille'
  if (type === 'legacy') return 'Eau'
  return 'Ajustement'
}

function normalizeMealName(value) {
  if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 120)
  return 'Repas'
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

export function foodCatalogKeyFromInput(input) {
  const barcode = typeof input?.barcode === 'string' ? input.barcode.trim() : ''
  if (barcode) return `barcode:${barcode}`
  const name = typeof input?.name === 'string' ? input.name.trim().toLowerCase().slice(0, 140) : ''
  const brand =
    typeof input?.brand === 'string' ? input.brand.trim().toLowerCase().slice(0, 80) : ''
  return `name:${name}|brand:${brand}`
}

function foodCatalogRowFromAliment(row) {
  const userId = String(row.user_id ?? '').trim()
  const name = String(row.nom ?? 'Aliment').trim().slice(0, 120) || 'Aliment'
  const barcode = row.barcode == null ? undefined : String(row.barcode).trim() || undefined
  const createdAt = toUnixMs(row.created_at)
  return {
    userId,
    foodKey: foodCatalogKeyFromInput({ barcode, name, brand: '' }),
    barcode,
    name,
    brand: undefined,
    caloriesPer100g: asNullableNumber(row.calories),
    proteinPer100g: asNullableNumber(row.proteines),
    carbsPer100g: asNullableNumber(row.glucides),
    fatPer100g: asNullableNumber(row.lipides),
    imageUrl: undefined,
    source: 'supabase_import',
    lastFetchedAt: createdAt,
    lastSelectedAt: createdAt,
    selectedCount: 1,
    isFavorite: false,
    lastUsedMealType: undefined,
    updatedAt: createdAt,
    schemaVersion: 1,
  }
}

function toNutritionDerivedRows(row) {
  const userId = String(row.user_id ?? '').trim()
  const journal = asRecord(row.journal) ?? {}
  const meals = []
  const waterEntries = []
  const dayStates = []
  const seenMealIds = new Set()
  const seenWaterIds = new Set()
  const seenDayKeys = new Set()

  for (const [rawDateKey, dayRaw] of Object.entries(journal)) {
    const dateKey = toDateKey(rawDateKey)
    if (!dateKey) continue
    const day = asRecord(dayRaw) ?? {}
    const dayUpdatedAt = toUnixMs(day.updatedAt ?? day.updated_at ?? row.updated_at)

    const mealRows = asArrayOfObjects(day.meals)
    for (let index = 0; index < mealRows.length; index += 1) {
      const meal = mealRows[index]
      const mealId = String(meal.id ?? `${dateKey}:meal:${index}`).trim()
      if (!mealId || seenMealIds.has(mealId)) continue
      seenMealIds.add(mealId)
      meals.push({
        userId,
        mealId,
        dateKey,
        mealType: normalizeMealType(meal.mealType),
        name: normalizeMealName(meal.name),
        calories: asNullableNumber(meal.calories),
        proteinG: Object.hasOwn(meal, 'proteinG') ? asNullableNumber(meal.proteinG) : undefined,
        carbsG: Object.hasOwn(meal, 'carbsG') ? asNullableNumber(meal.carbsG) : undefined,
        fatG: Object.hasOwn(meal, 'fatG') ? asNullableNumber(meal.fatG) : undefined,
        grams: asOptionalNumber(meal.grams),
        pieces: asOptionalNumber(meal.pieces),
        portionMode: normalizePortionMode(meal.portionMode),
        createdAt: toUnixMs(meal.createdAt ?? meal.created_at ?? dayUpdatedAt),
        updatedAt: toUnixMs(meal.updatedAt ?? meal.updated_at ?? dayUpdatedAt),
        deletedAt: undefined,
        schemaVersion: 1,
      })
    }

    const waterRows = asArrayOfObjects(day.waterEntries)
    for (let index = 0; index < waterRows.length; index += 1) {
      const entry = waterRows[index]
      const entryId = String(entry.id ?? `${dateKey}:water:${index}`).trim()
      if (!entryId || seenWaterIds.has(entryId)) continue
      seenWaterIds.add(entryId)
      const type = normalizeWaterEntryType(entry.type)
      waterEntries.push({
        userId,
        entryId,
        dateKey,
        amountMl: Math.max(0, Math.round(asNullableNumber(entry.amountMl ?? entry.amount) ?? 0)),
        type,
        label: normalizeWaterEntryLabel(type, entry.label),
        createdAt: toUnixMs(entry.createdAt ?? entry.created_at ?? dayUpdatedAt),
        updatedAt: toUnixMs(entry.updatedAt ?? entry.updated_at ?? dayUpdatedAt),
        deletedAt: undefined,
        schemaVersion: 1,
      })
    }

    const hasBottleLevel = Object.hasOwn(day, 'waterBottleLevelMl')
    const hasBottleCalibration = Object.hasOwn(day, 'waterBottleCalibrationTotalMl')
    if ((hasBottleLevel || hasBottleCalibration) && !seenDayKeys.has(dateKey)) {
      seenDayKeys.add(dateKey)
      dayStates.push({
        userId,
        dateKey,
        waterBottleLevelMl: hasBottleLevel ? asNullableNumber(day.waterBottleLevelMl) : undefined,
        waterBottleCalibrationTotalMl: hasBottleCalibration
          ? asNullableNumber(day.waterBottleCalibrationTotalMl)
          : undefined,
        updatedAt: dayUpdatedAt,
        schemaVersion: 1,
      })
    }
  }

  return { meals, waterEntries, dayStates }
}

function addToPerUserCounter(counter, table, userId, delta = 1) {
  if (!counter[table]) counter[table] = {}
  counter[table][userId] = (counter[table][userId] ?? 0) + delta
}

function createEmptyVerifyTableCounts() {
  const counts = {}
  for (const key of MIGRATION_VERIFY_TABLE_ORDER) counts[key] = 0
  return counts
}

function createEmptyDerivedPerUserCounts() {
  const perUser = {}
  for (const key of MIGRATION_DERIVED_TABLE_ORDER) perUser[key] = {}
  return perUser
}

function createEmptyMetrics() {
  return {
    nutrition_food_catalog_selected_count_total: 0,
  }
}

export function deriveExpectedTableCounts(rawBundle) {
  const bundle = normalizeExportBundle(rawBundle)
  const baseCounts = countBundleEntities(bundle)
  const tables = createEmptyVerifyTableCounts()
  const perUser = createEmptyDerivedPerUserCounts()
  const metrics = createEmptyMetrics()
  tables.auth_users = baseCounts.auth_users
  tables.profiles = baseCounts.profiles
  tables.workouts = baseCounts.workouts
  tables.nutrition = baseCounts.nutrition
  tables.checkins = baseCounts.checkins
  tables.aliments = baseCounts.aliments
  tables.activities = baseCounts.activities
  tables.ai_usage_limits = baseCounts.ai_usage_limits
  tables.user_backups = baseCounts.user_backups

  const seenSpots = new Set()
  for (const row of bundle.entities.profiles) {
    const userId = String(row.id ?? '').trim()
    if (!userId) continue
    tables.streak_state += 1
    addToPerUserCounter(perUser, 'streak_state', userId, 1)

    const customSpots = asArrayOfObjects(row.custom_spots)
    for (let index = 0; index < customSpots.length; index += 1) {
      const spot = customSpots[index]
      const spotId = String(spot.id ?? spot.spotId ?? `spot-${index}`).trim()
      const key = `${userId}:${spotId}`
      if (seenSpots.has(key)) continue
      seenSpots.add(key)
      tables.custom_spots += 1
      addToPerUserCounter(perUser, 'custom_spots', userId, 1)
    }

    if (row.active_checkin != null) {
      tables.active_checkins += 1
      addToPerUserCounter(perUser, 'active_checkins', userId, 1)
    }
  }

  const seenMeals = new Set()
  const seenWaters = new Set()
  const seenDays = new Set()
  for (const row of bundle.entities.nutrition) {
    const derived = toNutritionDerivedRows(row)
    for (const meal of derived.meals) {
      const key = `${meal.userId}:${meal.mealId}`
      if (seenMeals.has(key)) continue
      seenMeals.add(key)
      tables.nutrition_meals += 1
      addToPerUserCounter(perUser, 'nutrition_meals', meal.userId, 1)
    }
    for (const entry of derived.waterEntries) {
      const key = `${entry.userId}:${entry.entryId}`
      if (seenWaters.has(key)) continue
      seenWaters.add(key)
      tables.nutrition_water_entries += 1
      addToPerUserCounter(perUser, 'nutrition_water_entries', entry.userId, 1)
    }
    for (const day of derived.dayStates) {
      const key = `${day.userId}:${day.dateKey}`
      if (seenDays.has(key)) continue
      seenDays.add(key)
      tables.nutrition_day_state += 1
      addToPerUserCounter(perUser, 'nutrition_day_state', day.userId, 1)
    }
  }

  const seenFoods = new Set()
  const selectedCountByCatalogKey = new Map()
  for (const row of bundle.entities.aliments) {
    const catalogRow = foodCatalogRowFromAliment(row)
    if (!catalogRow.userId || !catalogRow.foodKey) continue
    const key = `${catalogRow.userId}:${catalogRow.foodKey}`
    selectedCountByCatalogKey.set(key, (selectedCountByCatalogKey.get(key) ?? 0) + 1)
    if (seenFoods.has(key)) continue
    seenFoods.add(key)
    tables.nutrition_food_catalog += 1
    addToPerUserCounter(perUser, 'nutrition_food_catalog', catalogRow.userId, 1)
  }

  metrics.nutrition_food_catalog_selected_count_total = [...selectedCountByCatalogKey.values()].reduce(
    (sum, value) => sum + value,
    0,
  )

  return { tables, perUserDerivedTables: perUser, metrics }
}

function dedupe(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()).map((v) => v.trim()))]
}

export function buildVerificationScope(rawBundle) {
  const bundle = normalizeExportBundle(rawBundle)
  const rows = buildImportRows(bundle)
  const entitySupabaseIds = {}
  for (const entityType of MIGRATION_ENTITY_ORDER) {
    entitySupabaseIds[entityType] = []
  }
  for (const row of rows) {
    entitySupabaseIds[row.entityType].push(row.supabaseId)
  }
  for (const entityType of MIGRATION_ENTITY_ORDER) {
    entitySupabaseIds[entityType] = dedupe(entitySupabaseIds[entityType])
  }

  const migratedUserIds = dedupe([
    ...bundle.entities.auth_users.map((row) => String(row.id ?? '')),
    ...bundle.entities.profiles.map((row) => String(row.id ?? '')),
    ...bundle.entities.workouts.map((row) => String(row.user_id ?? '')),
    ...bundle.entities.nutrition.map((row) => String(row.user_id ?? '')),
    ...bundle.entities.checkins.map((row) => String(row.user_id ?? '')),
    ...bundle.entities.aliments.map((row) => String(row.user_id ?? '')),
    ...bundle.entities.activities.map((row) => String(row.user_id ?? '')),
    ...bundle.entities.ai_usage_limits.map((row) => String(row.user_id ?? '')),
    ...bundle.entities.user_backups.map((row) => String(row.user_id ?? '')),
  ])

  const customSpotKeys = []
  const activeCheckinUserIds = []
  for (const row of bundle.entities.profiles) {
    const userId = String(row.id ?? '').trim()
    if (!userId) continue
    const customSpots = asArrayOfObjects(row.custom_spots)
    for (let index = 0; index < customSpots.length; index += 1) {
      const spot = customSpots[index]
      const spotId = String(spot.id ?? spot.spotId ?? `spot-${index}`).trim()
      if (!spotId) continue
      customSpotKeys.push(`${userId}:${spotId}`)
    }
    if (row.active_checkin != null) {
      activeCheckinUserIds.push(userId)
    }
  }

  const mealKeys = []
  const waterEntryKeys = []
  const dayStateKeys = []
  for (const row of bundle.entities.nutrition) {
    const derived = toNutritionDerivedRows(row)
    for (const meal of derived.meals) mealKeys.push(`${meal.userId}:${meal.mealId}`)
    for (const entry of derived.waterEntries) waterEntryKeys.push(`${entry.userId}:${entry.entryId}`)
    for (const dayState of derived.dayStates) dayStateKeys.push(`${dayState.userId}:${dayState.dateKey}`)
  }

  const foodCatalogKeys = []
  for (const row of bundle.entities.aliments) {
    const catalogRow = foodCatalogRowFromAliment(row)
    if (!catalogRow.userId || !catalogRow.foodKey) continue
    foodCatalogKeys.push(`${catalogRow.userId}:${catalogRow.foodKey}`)
  }

  return {
    migratedUserIds,
    entitySupabaseIds,
    customSpotKeys: dedupe(customSpotKeys),
    activeCheckinUserIds: dedupe(activeCheckinUserIds),
    mealKeys: dedupe(mealKeys),
    waterEntryKeys: dedupe(waterEntryKeys),
    dayStateKeys: dedupe(dayStateKeys),
    foodCatalogKeys: dedupe(foodCatalogKeys),
  }
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
      currentStreak: Math.max(0, Number(row.current_streak ?? 0)),
      lastLoginDate: toDateKey(row.last_login_date),
      customSpotsJson: row.custom_spots ?? [],
      activeCheckinJson: row.active_checkin ?? null,
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
  const derived = toNutritionDerivedRows(row)
  return {
    supabaseId: String(row.user_id ?? ''),
    payload: {
      userId: String(row.user_id ?? ''),
      profileJson: row.profile ?? {},
      journalJson: row.journal ?? {},
      normalizedMeals: derived.meals,
      normalizedWaterEntries: derived.waterEntries,
      normalizedDayStates: derived.dayStates,
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
  const catalogRow = foodCatalogRowFromAliment(row)
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
      catalogRow,
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

export function verifyTableCounts(expectedCounts, actualCounts) {
  const mismatches = []
  for (const tableName of MIGRATION_VERIFY_TABLE_ORDER) {
    const expected = Number(expectedCounts?.[tableName] ?? 0)
    const actual = Number(actualCounts?.[tableName] ?? 0)
    if (expected !== actual) {
      mismatches.push({ tableName, expected, actual })
    }
  }
  return { ok: mismatches.length === 0, mismatches }
}

export function verifyDerivedPerUserCounts(expectedPerUser, actualPerUser) {
  const mismatches = []
  for (const tableName of MIGRATION_DERIVED_TABLE_ORDER) {
    const expectedUsers = expectedPerUser?.[tableName] ?? {}
    const actualUsers = actualPerUser?.[tableName] ?? {}
    const userIds = new Set([...Object.keys(expectedUsers), ...Object.keys(actualUsers)])
    for (const userId of userIds) {
      const expected = Number(expectedUsers[userId] ?? 0)
      const actual = Number(actualUsers[userId] ?? 0)
      if (expected !== actual) {
        mismatches.push({ tableName, userId, expected, actual })
      }
    }
  }
  return { ok: mismatches.length === 0, mismatches }
}

export function verifyMetrics(expectedMetrics, actualMetrics) {
  const mismatches = []
  const expectedSelectedTotal = Number(
    expectedMetrics?.nutrition_food_catalog_selected_count_total ?? 0,
  )
  const actualSelectedTotal = Number(
    actualMetrics?.nutrition_food_catalog_selected_count_total ?? 0,
  )
  if (expectedSelectedTotal !== actualSelectedTotal) {
    mismatches.push({
      metric: 'nutrition_food_catalog_selected_count_total',
      expected: expectedSelectedTotal,
      actual: actualSelectedTotal,
    })
  }
  return { ok: mismatches.length === 0, mismatches }
}
