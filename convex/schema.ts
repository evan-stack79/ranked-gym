import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

/**
 * Ranked Gym Convex schema (Phase A — compatibility-first).
 *
 * Maps plan domains:
 * - Profil: profiles, checkins, custom_spots, active_checkins
 * - Train: workouts_state
 * - Nutrition + Hydratation:
 *   - compatibility snapshot: nutrition_state
 *   - granular sync: nutrition_meals, nutrition_water_entries, nutrition_day_state
 *   - personal/recent/favorites cache: nutrition_food_catalog
 * - Sommeil: sleep_nights (currently local-only in the app)
 * - Streak: streak_state
 * - Files: user_files
 * - Social privacy: user_blocks, user_follows, activity_comments, activity_reactions
 * - Migration bookkeeping: migration_runs, migration_entity_map, legacy_supabase_backups
 *
 * Convex indexes are not unique. Uniqueness listed below is a mutation invariant
 * to enforce when write functions land (later phase).
 *
 * Timestamps are unix milliseconds.
 */
export const convexTables = {
  auth_users: defineTable({
    userId: v.string(),
    email: v.string(),
    emailNorm: v.string(),
    displayName: v.string(),
    mustResetPassword: v.boolean(),
    /** Present when the Convex account email is confirmed (server-side only). */
    emailConfirmedAt: v.optional(v.number()),
    role: v.optional(v.union(v.literal('admin'), v.literal('user'))),
    pendingDeletionAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_emailNorm', ['emailNorm'])
    .index('by_mustResetPassword', ['mustResetPassword']),

  /**
   * Lien compte Ranked Gym (ownerUserId / Convex) ↔ compte Supabase Auth.
   * Obligatoire avant purge repas multi-store.
   */
  auth_account_links: defineTable({
    ownerUserId: v.string(),
    supabaseUserId: v.string(),
    linkedAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_ownerUserId', ['ownerUserId'])
    .index('by_supabaseUserId', ['supabaseUserId']),

  /**
   * Codes e-mail 6 chiffres pour confirmer l’e-mail Convex (liaison compte).
   * Confirmé uniquement après code correct (ou Google) — jamais à l’inscription/import.
   */
  auth_email_verification_codes: defineTable({
    userId: v.string(),
    codeHash: v.string(),
    expiresAt: v.number(),
    attempts: v.number(),
    createdAt: v.number(),
    consumedAt: v.optional(v.number()),
  }).index('by_userId', ['userId']),

  /** One-shot server migrations (e.g. B10-03 unconfirm reset). */
  app_one_shot_migrations: defineTable({
    key: v.string(),
    ranAt: v.number(),
    resultCount: v.optional(v.number()),
  }).index('by_key', ['key']),

  /**
   * B12-01 : Google takeover of an unconfirmed password account.
   * Stores account id + timestamp only — never token or password.
   */
  auth_google_takeover_audit: defineTable({
    userId: v.string(),
    at: v.number(),
  }).index('by_userId', ['userId']),

  auth_password_credentials: defineTable({
    userId: v.string(),
    passwordHash: v.string(),
    updatedAt: v.number(),
  }).index('by_userId', ['userId']),

  auth_sessions: defineTable({
    userId: v.string(),
    tokenHash: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index('by_tokenHash', ['tokenHash'])
    .index('by_userId', ['userId'])
    .index('by_expiresAt', ['expiresAt']),

  auth_password_reset_tokens: defineTable({
    userId: v.string(),
    tokenHash: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    consumedAt: v.optional(v.number()),
  })
    .index('by_tokenHash', ['tokenHash'])
    .index('by_userId', ['userId'])
    .index('by_expiresAt', ['expiresAt']),

  auth_password_reset_outbox: defineTable({
    userId: v.string(),
    email: v.string(),
    emailNorm: v.string(),
    resetLink: v.string(),
    tokenHash: v.string(),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
    sentAt: v.optional(v.number()),
    purgedAt: v.optional(v.number()),
    lastAttemptAt: v.optional(v.number()),
    attemptCount: v.number(),
    status: v.optional(
      v.union(
        v.literal('queued'),
        v.literal('sending'),
        v.literal('sent'),
        v.literal('failed'),
        v.literal('purged'),
      ),
    ),
    providerMessageId: v.optional(v.string()),
    lastError: v.optional(v.string()),
  })
    .index('by_userId', ['userId'])
    .index('by_sentAt', ['sentAt'])
    .index('by_createdAt', ['createdAt']),

  auth_private_notes: defineTable({
    userId: v.string(),
    content: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_userId_createdAt', ['userId', 'createdAt']),

  /**
   * Fixed-window counters for sensitive mutations.
   * `keyHash` is SHA-256 of `policy|kind|value` — never raw email/password/token/IP.
   */
  rate_limit_buckets: defineTable({
    keyHash: v.string(),
    policy: v.string(),
    windowStartedAt: v.number(),
    count: v.number(),
    updatedAt: v.number(),
  }).index('by_keyHash', ['keyHash']),

  profiles: defineTable({
    userId: v.string(),
    pseudo: v.string(),
    level: v.number(),
    xp: v.number(),
    rank: v.string(),
    discipline: v.string(),
    avatarFileId: v.optional(v.id('user_files')),
    isGhostModeEnabled: v.boolean(),
    /** Private accounts are only visible to self and accepted followers. Missing = public. */
    isPrivate: v.optional(v.boolean()),
    /** Sports du profil (ids catalogue). Absent = non renseigné. */
    sportIds: v.optional(v.array(v.string())),
    sportsUndecided: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_updatedAt', ['updatedAt']),

  workouts_state: defineTable({
    userId: v.string(),
    stateJson: v.any(),
    progressJson: v.any(),
    updatedAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_updatedAt', ['updatedAt']),

  nutrition_state: defineTable({
    userId: v.string(),
    profileJson: v.any(),
    journalJson: v.any(),
    updatedAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_updatedAt', ['updatedAt']),

  /**
   * B14 — passage mineur → 18+ via sync/import/update.
   * userId + at uniquement (jamais l’âge ni d’autres données).
   */
  nutrition_age_majority_audit: defineTable({
    userId: v.string(),
    at: v.number(),
  }).index('by_userId', ['userId']),

  /**
   * B15 — retrait délibéré d’un flag de sécurité (diabète / grossesse / allaitement).
   * userId + at uniquement (jamais le nom du flag ni d’autres données).
   */
  nutrition_safety_clear_audit: defineTable({
    userId: v.string(),
    at: v.number(),
  }).index('by_userId', ['userId']),

  /**
   * B15 — correction équipe (dashboard) d’un SAFETY FIELD.
   * userId + field + at (pas la valeur santé au-delà du nom du champ).
   */
  nutrition_safety_admin_audit: defineTable({
    userId: v.string(),
    field: v.string(),
    at: v.number(),
  }).index('by_userId', ['userId']),

  /**
   * Repas actifs : champs complets.
   * Tombstone sync (après delete / delete-all) : uniquement userId + mealId +
   * deletedAt + updatedAt — aucun nom / calorie / macro / dateKey résiduel.
   */
  nutrition_meals: defineTable({
    userId: v.string(),
    mealId: v.string(),
    dateKey: v.optional(v.string()),
    mealType: v.optional(v.string()),
    name: v.optional(v.string()),
    calories: v.optional(v.union(v.number(), v.null())),
    proteinG: v.optional(v.union(v.number(), v.null())),
    carbsG: v.optional(v.union(v.number(), v.null())),
    fatG: v.optional(v.union(v.number(), v.null())),
    grams: v.optional(v.number()),
    pieces: v.optional(v.number()),
    portionMode: v.optional(v.union(v.literal('solo'), v.literal('with_sides'))),
    /** Snapshot v3 — portion / OFF / image Ranked Gym. */
    portionLabel: v.optional(v.string()),
    offCode: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id('_storage')),
    /**
     * Marqueur V3 (addFoodSnapshot). Une ligne V3 ignore toujours les kcal/macros client
     * sur upsertMeal, même sans quantityRules:'v3'.
     */
    entrySource: v.optional(v.literal('v3')),
    /** Id stable d’un ajout V3 (retries / selectedCount). */
    selectionEventId: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
    schemaVersion: v.optional(v.number()),
  })
    .index('by_userId_mealId', ['userId', 'mealId'])
    .index('by_userId_dateKey', ['userId', 'dateKey'])
    .index('by_userId_updatedAt', ['userId', 'updatedAt']),

  nutrition_water_entries: defineTable({
    userId: v.string(),
    entryId: v.string(),
    dateKey: v.string(),
    amountMl: v.number(),
    type: v.string(),
    label: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
    schemaVersion: v.number(),
  })
    .index('by_userId_entryId', ['userId', 'entryId'])
    .index('by_userId_dateKey', ['userId', 'dateKey'])
    .index('by_userId_updatedAt', ['userId', 'updatedAt']),

  nutrition_day_state: defineTable({
    userId: v.string(),
    dateKey: v.string(),
    waterBottleLevelMl: v.optional(v.union(v.number(), v.null())),
    waterBottleCalibrationTotalMl: v.optional(v.union(v.number(), v.null())),
    updatedAt: v.number(),
    schemaVersion: v.number(),
  })
    .index('by_userId_dateKey', ['userId', 'dateKey'])
    .index('by_userId_updatedAt', ['userId', 'updatedAt']),

  nutrition_food_catalog: defineTable({
    userId: v.string(),
    foodKey: v.string(),
    barcode: v.optional(v.string()),
    name: v.string(),
    brand: v.optional(v.string()),
    caloriesPer100g: v.union(v.number(), v.null()),
    proteinPer100g: v.union(v.number(), v.null()),
    carbsPer100g: v.union(v.number(), v.null()),
    fatPer100g: v.union(v.number(), v.null()),
    /**
     * Provenance des nutriments catalogue.
     * 'server' = off_product_nutrients / calcul serveur — peut nourrir V3.
     * 'client' = saisie téléphone — jamais utilisée par addFoodSnapshot V3.
     */
    nutrientsSource: v.optional(v.union(v.literal('server'), v.literal('client'))),
    /** URL de NOTRE stockage (Convex) — jamais un hotlink OFF. */
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id('_storage')),
    servingSize: v.optional(v.union(v.string(), v.null())),
    portionLabel: v.optional(v.string()),
    categoriesTags: v.optional(v.array(v.string())),
    source: v.union(
      v.literal('open_food_facts'),
      v.literal('manual'),
      v.literal('ai_photo'),
      v.literal('supabase_import'),
    ),
    lastFetchedAt: v.number(),
    lastSelectedAt: v.number(),
    selectedCount: v.number(),
    isFavorite: v.boolean(),
    lastUsedMealType: v.optional(v.string()),
    lastSelectionEventId: v.optional(v.string()),
    updatedAt: v.number(),
    schemaVersion: v.number(),
  })
    .index('by_userId_foodKey', ['userId', 'foodKey'])
    .index('by_userId_lastSelectedAt', ['userId', 'lastSelectedAt'])
    .index('by_userId_favorite', ['userId', 'isFavorite'])
    .index('by_userId_barcode', ['userId', 'barcode']),

  /** Quota recherche aliments OFF — limite journalière par utilisateur. */
  food_search_usage: defineTable({
    userId: v.string(),
    dateKey: v.string(),
    searchCount: v.number(),
    updatedAt: v.number(),
  }).index('by_userId_dateKey', ['userId', 'dateKey']),

  /**
   * Cache global des images OFF copiées dans Convex storage.
   * Le client ne hotlink jamais images.openfoodfacts.org.
   */
  off_product_images: defineTable({
    offCode: v.string(),
    storageId: v.id('_storage'),
    contentType: v.string(),
    sourceUrl: v.optional(v.string()),
    updatedAt: v.number(),
  }).index('by_offCode', ['offCode']),

  /**
   * Cache global nutriments OFF (per 100 g + poids portion/pièce si connu).
   * Rempli à la recherche searchFoods ; lu à addFoodSnapshot — pas de refetch OFF.
   */
  off_product_nutrients: defineTable({
    offCode: v.string(),
    caloriesPer100g: v.union(v.number(), v.null()),
    proteinPer100g: v.union(v.number(), v.null()),
    carbsPer100g: v.union(v.number(), v.null()),
    fatPer100g: v.union(v.number(), v.null()),
    servingSize: v.optional(v.union(v.string(), v.null())),
    /** Grammes d’une portion/pièce OFF ; null si inconnu (ne jamais inventer 100 g). */
    servingGrams: v.union(v.number(), v.null()),
    updatedAt: v.number(),
  }).index('by_offCode', ['offCode']),

  sleep_nights: defineTable({
    userId: v.string(),
    dateKey: v.string(),
    bedtime: v.string(),
    waketime: v.string(),
    tstHours: v.union(v.number(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_userId_dateKey', ['userId', 'dateKey'])
    .index('by_userId_updatedAt', ['userId', 'updatedAt']),

  checkins: defineTable({
    userId: v.string(),
    legacySupabaseId: v.optional(v.string()),
    salleNom: v.string(),
    salleLat: v.optional(v.union(v.number(), v.null())),
    salleLng: v.optional(v.union(v.number(), v.null())),
    gymPayload: v.optional(v.any()),
    createdAt: v.number(),
  }).index('by_userId_createdAt', ['userId', 'createdAt']),

  custom_spots: defineTable({
    userId: v.string(),
    spotId: v.string(),
    name: v.string(),
    lat: v.number(),
    lng: v.number(),
    address: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_userId_spotId', ['userId', 'spotId'])
    .index('by_userId_updatedAt', ['userId', 'updatedAt']),

  active_checkins: defineTable({
    userId: v.string(),
    checkinJson: v.any(),
    updatedAt: v.number(),
  }).index('by_userId', ['userId']),

  aliments: defineTable({
    userId: v.string(),
    legacySupabaseId: v.optional(v.string()),
    nom: v.string(),
    calories: v.number(),
    proteines: v.number(),
    glucides: v.number(),
    lipides: v.number(),
    barcode: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_userId_createdAt', ['userId', 'createdAt'])
    .index('by_barcode', ['barcode']),

  activities: defineTable({
    userId: v.string(),
    legacySupabaseId: v.optional(v.string()),
    activityType: v.string(),
    actionText: v.string(),
    xpEarned: v.number(),
    originLat: v.optional(v.union(v.number(), v.null())),
    originLng: v.optional(v.union(v.number(), v.null())),
    createdAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index('by_createdAt', ['createdAt'])
    .index('by_userId_createdAt', ['userId', 'createdAt']),

  /**
   * Reciprocal hide: if either direction exists, neither user may see the other
   * via search, profiles, feed-by-id, comments, reactions, or counters.
   */
  user_blocks: defineTable({
    blockerUserId: v.string(),
    blockedUserId: v.string(),
    createdAt: v.number(),
  })
    .index('by_blocker', ['blockerUserId'])
    .index('by_blocked', ['blockedUserId'])
    .index('by_pair', ['blockerUserId', 'blockedUserId']),

  /** Subscriptions. Private followees require `accepted` before content is visible. */
  user_follows: defineTable({
    followerUserId: v.string(),
    followeeUserId: v.string(),
    status: v.union(v.literal('pending'), v.literal('accepted')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_follower', ['followerUserId'])
    .index('by_followee', ['followeeUserId'])
    .index('by_pair', ['followerUserId', 'followeeUserId']),

  activity_comments: defineTable({
    activityId: v.id('activities'),
    userId: v.string(),
    body: v.string(),
    createdAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index('by_activityId', ['activityId'])
    .index('by_userId', ['userId']),

  activity_reactions: defineTable({
    activityId: v.id('activities'),
    userId: v.string(),
    kind: v.literal('cheer'),
    createdAt: v.number(),
  })
    .index('by_activityId', ['activityId'])
    .index('by_activity_user', ['activityId', 'userId'])
    .index('by_userId', ['userId']),

  ai_usage_limits: defineTable({
    userId: v.string(),
    dateOfScan: v.string(),
    scanCount: v.number(),
    updatedAt: v.number(),
  }).index('by_userId_dateOfScan', ['userId', 'dateOfScan']),

  streak_state: defineTable({
    userId: v.string(),
    currentStreak: v.number(),
    lastLoginDate: v.optional(v.union(v.string(), v.null())),
    updatedAt: v.number(),
  }).index('by_userId', ['userId']),

  user_files: defineTable({
    userId: v.string(),
    kind: v.literal('avatar'),
    storageId: v.id('_storage'),
    contentType: v.string(),
    sizeBytes: v.number(),
    sha256: v.string(),
    legacySupabasePath: v.optional(v.string()),
    createdAt: v.number(),
    replacedAt: v.optional(v.number()),
  })
    .index('by_userId_kind', ['userId', 'kind'])
    .index('by_storageId', ['storageId'])
    .index('by_legacySupabasePath', ['legacySupabasePath']),

  migration_runs: defineTable({
    runId: v.string(),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    status: v.union(
      v.literal('running'),
      v.literal('completed'),
      v.literal('failed'),
      v.literal('aborted'),
    ),
    sourceSha: v.string(),
    adminSecretHash: v.optional(v.string()),
    summaryJson: v.any(),
  })
    .index('by_runId', ['runId'])
    .index('by_startedAt', ['startedAt']),

  migration_entity_map: defineTable({
    runId: v.string(),
    entityType: v.string(),
    supabaseId: v.string(),
    convexId: v.string(),
    checksum: v.string(),
    importedAt: v.number(),
  })
    .index('by_entity_supabaseId', ['entityType', 'supabaseId'])
    .index('by_runId_entityType', ['runId', 'entityType']),

  legacy_supabase_backups: defineTable({
    userId: v.string(),
    payloadJson: v.any(),
    updatedAt: v.number(),
    source: v.literal('supabase_user_backups'),
  }).index('by_userId', ['userId']),

  /**
   * Avis bêta (« Donner mon avis ») — SPEC_AVIS_BETA.
   * Pas d’âge, poids, e-mail, IP ni donnée de santé en colonnes.
   * Garde 18+ : âge lu côté serveur dans `nutrition_state.profileJson` (jamais stocké ici).
   */
  avis_beta: defineTable({
    userId: v.string(),
    type: v.union(v.literal('bug'), v.literal('idee'), v.literal('autre')),
    texte: v.string(),
    texteMasque: v.optional(v.string()),
    page: v.string(),
    version: v.string(),
    creeLe: v.number(),
    consentementDate: v.number(),
    consentementVersion: v.string(),
    statut: v.union(
      v.literal('nouveau'),
      v.literal('urgent'),
      v.literal('garde'),
      v.literal('mis_de_cote'),
      v.literal('transmis'),
      v.literal('traite'),
      v.literal('trie'),
    ),
    signalUrgent: v.boolean(),
    /** 1 = TCA/mal-être · 2 = idées suicidaires (jamais de diagnostic stocké au-delà). */
    signalNiveau: v.optional(v.union(v.literal(1), v.literal(2))),
    motsMasques: v.boolean(),
    notif: v.union(v.literal('a_envoyer'), v.literal('envoyee'), v.literal('echec')),
    notifEssais: v.number(),
    cleAntiDoublon: v.string(),
    decision: v.optional(v.string()),
    noteTri: v.optional(v.string()),
  })
    .index('by_userId', ['userId'])
    .index('by_userId_creeLe', ['userId', 'creeLe'])
    .index('by_cleAntiDoublon', ['cleAntiDoublon'])
    .index('by_notif', ['notif'])
    .index('by_statut', ['statut']),
}

export default defineSchema(convexTables)
