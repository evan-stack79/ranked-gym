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

  /**
   * One-shot + retries webhooks « Surveillance fitness » (Grok Bot).
   * Un enregistrement par (userId, type) pour signup / first_* / churn / test.
   */
  surveillance_fitness_events: defineTable({
    userId: v.string(),
    email: v.string(),
    type: v.union(
      v.literal('signup_free'),
      v.literal('beta_signup'),
      v.literal('first_meal_photo_ai'),
      v.literal('first_workout'),
      v.literal('churn'),
      v.literal('test'),
    ),
    plan: v.union(v.literal('free'), v.literal('beta'), v.literal('unknown')),
    lastActiveDays: v.optional(v.union(v.number(), v.null())),
    actionCount: v.optional(v.union(v.number(), v.null())),
    notif: v.union(v.literal('a_envoyer'), v.literal('envoyee'), v.literal('echec')),
    notifEssais: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_userId_type', ['userId', 'type'])
    .index('by_notif', ['notif'])
    .index('by_type', ['type']),

  /**
   * Ranked Force / Ranked Discipline (P0) — ARCHI_RANKED §4.
   * Cosmétique Bronze→Légende (profiles.rank / rank.ts) reste à côté, inchangé.
   * Jamais de bodyweight / IAP / look / âge bio dans ces tables.
   */
  rankedOptIn: defineTable({
    userId: v.string(),
    forceEnabled: v.boolean(),
    disciplineEnabled: v.boolean(),
    optedInAt: v.number(),
    optedOutAt: v.optional(v.number()),
    ageGatePassedAt: v.number(),
    sex: v.union(v.literal('M'), v.literal('F'), v.literal('unknown')),
    pauseInjuryUntil: v.optional(v.number()),
    /** Code ami court partageable (B1-bis) — pas l’id Convex brut. */
    friendCode: v.optional(v.string()),
  })
    .index('by_userId', ['userId'])
    .index('by_friendCode', ['friendCode']),

  rankedLiftLog: defineTable({
    userId: v.string(),
    canonicalExerciseId: v.string(),
    weightKg: v.number(),
    reps: v.number(),
    estimated1RmKg: v.optional(v.number()),
    status: v.union(
      v.literal('declared'),
      v.literal('pending_verify'),
      v.literal('verified'),
      v.literal('rejected_force'),
    ),
    anomalyFlag: v.union(v.literal('none'), v.literal('A'), v.literal('B')),
    sourceSessionId: v.optional(v.string()),
    createdAt: v.number(),
    verifiedAt: v.optional(v.number()),
    verifyMethod: v.optional(
      v.union(v.literal('self_24h'), v.literal('friend_18'), v.literal('review')),
    ),
    needsReviewQueue: v.optional(v.boolean()),
    rejectReason: v.optional(v.string()),
  })
    .index('by_userId', ['userId'])
    .index('by_user_exercise_time', ['userId', 'canonicalExerciseId', 'createdAt']),

  rankedVerifiedPr: defineTable({
    userId: v.string(),
    canonicalExerciseId: v.string(),
    estimated1RmKg: v.number(),
    liftLogId: v.id('rankedLiftLog'),
    verifiedAt: v.number(),
    cycleId: v.id('rankedCycle'),
  })
    .index('by_userId', ['userId'])
    .index('by_user_exercise', ['userId', 'canonicalExerciseId']),

  rankedForceScore: defineTable({
    userId: v.string(),
    cycleId: v.id('rankedCycle'),
    score: v.number(),
    /** Soft-reset partial seed (CA6) — not a 100% copy of previous score. */
    seedScore: v.optional(v.number()),
    breakdown: v.object({
      squat: v.number(),
      bench: v.number(),
      deadlift: v.number(),
      barbell_row: v.number(),
      ohp: v.number(),
    }),
    leagueId: v.id('rankedLeague'),
    updatedAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_user_cycle', ['userId', 'cycleId'])
    .index('by_cycle_score', ['cycleId', 'score']),

  rankedDisciplineScore: defineTable({
    userId: v.string(),
    cycleId: v.id('rankedCycle'),
    sessionsLast7d: v.number(),
    streakWeeks: v.number(),
    score: v.number(),
    updatedAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_user_cycle', ['userId', 'cycleId'])
    .index('by_cycle_score', ['cycleId', 'score']),

  rankedCycle: defineTable({
    startsAt: v.number(),
    endsAt: v.number(),
    status: v.union(v.literal('active'), v.literal('closing'), v.literal('closed')),
    softResetAt: v.optional(v.number()),
  })
    .index('by_status', ['status'])
    .index('by_endsAt', ['endsAt']),

  rankedLeague: defineTable({
    cycleId: v.id('rankedCycle'),
    name: v.string(),
    tier: v.number(),
    minScore: v.number(),
    maxScore: v.number(),
  })
    .index('by_cycleId', ['cycleId'])
    .index('by_cycle_tier', ['cycleId', 'tier']),

  /** Amis Ranked P0 (pas de table friendship legacy dédiée). */
  rankedFriendship: defineTable({
    userA: v.string(),
    userB: v.string(),
    status: v.union(v.literal('pending'), v.literal('accepted')),
    requestedBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_pair', ['userA', 'userB'])
    .index('by_userA_status', ['userA', 'status'])
    .index('by_userB_status', ['userB', 'status']),

  rankedVerifyRequest: defineTable({
    liftLogId: v.id('rankedLiftLog'),
    ownerId: v.string(),
    method: v.union(v.literal('self_24h'), v.literal('friend_18')),
    friendId: v.optional(v.string()),
    createdAt: v.number(),
    expiresAt: v.number(),
    status: v.union(
      v.literal('open'),
      v.literal('confirmed'),
      v.literal('expired'),
      v.literal('denied'),
    ),
  })
    .index('by_liftLogId', ['liftLogId'])
    .index('by_ownerId', ['ownerId'])
    .index('by_friendId_status', ['friendId', 'status']),

  /** Séances terminées comptées pour Ranked Discipline (fenêtre 7j + streak). */
  rankedSessionCompletion: defineTable({
    userId: v.string(),
    completedAt: v.number(),
    sourceSessionId: v.optional(v.string()),
  })
    .index('by_userId', ['userId'])
    .index('by_user_time', ['userId', 'completedAt']),

  /**
   * Points partenaires / boutique cadeaux (ARCHI_REWARDS_PARTENAIRES).
   * Wallet séparé de Force/Discipline. Interdit : proOnly, earlyAccessPro, minPlan,
   * pointMultiplier, capBonus. userId = auth string (comme ranked*).
   */
  rewardsWallet: defineTable({
    userId: v.string(),
    cycleId: v.id('rankedCycle'),
    balance: v.number(),
    earnedToday: v.number(),
    earnedTodayDate: v.string(),
    earnedThisCycle: v.number(),
    updatedAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_user_cycle', ['userId', 'cycleId'])
    .index('by_cycleId', ['cycleId']),

  rewardsLedger: defineTable({
    userId: v.string(),
    cycleId: v.id('rankedCycle'),
    delta: v.number(),
    reason: v.union(
      v.literal('discipline_session'),
      v.literal('week_objective'),
      v.literal('redeem'),
      v.literal('season_reset'),
      v.literal('partner_refuse_recredit'),
      v.literal('admin_adjust'),
    ),
    refId: v.optional(v.string()),
    createdAt: v.number(),
    balanceAfter: v.number(),
  })
    .index('by_user_time', ['userId', 'createdAt'])
    .index('by_user_reason_ref', ['userId', 'reason', 'refId'])
    .index('by_cycleId', ['cycleId']),

  rewardsPartner: defineTable({
    slug: v.string(),
    name: v.string(),
    active: v.boolean(),
  }).index('by_slug', ['slug']),

  rewardsCatalogItem: defineTable({
    partnerId: v.id('rewardsPartner'),
    categoryId: v.union(
      v.literal('RP-CAT-01'),
      v.literal('RP-CAT-02'),
      v.literal('RP-CAT-03'),
      v.literal('RP-CAT-04'),
      v.literal('RP-CAT-05'),
    ),
    title: v.string(),
    costPoints: v.number(),
    stockLogical: v.number(),
    active: v.boolean(),
    availableFrom: v.number(),
    availableTo: v.optional(v.number()),
    sortOrder: v.number(),
  })
    .index('by_partnerId', ['partnerId'])
    .index('by_active_sort', ['active', 'sortOrder'])
    .index('by_categoryId', ['categoryId']),

  rewardsRedemptionCode: defineTable({
    code: v.string(),
    userId: v.string(),
    itemId: v.id('rewardsCatalogItem'),
    costPoints: v.number(),
    status: v.union(
      v.literal('created'),
      v.literal('shown'),
      v.literal('consumed'),
      v.literal('expired'),
      v.literal('partner_refused'),
      v.literal('invalidated'),
    ),
    cycleId: v.id('rankedCycle'),
    createdAt: v.number(),
    expiresAt: v.number(),
    shownAt: v.optional(v.number()),
    consumedAt: v.optional(v.number()),
    partnerRefuseAt: v.optional(v.number()),
    partnerRefuseReason: v.optional(v.string()),
    recreditLedgerId: v.optional(v.id('rewardsLedger')),
  })
    .index('by_code', ['code'])
    .index('by_userId', ['userId'])
    .index('by_user_created', ['userId', 'createdAt'])
    .index('by_itemId', ['itemId'])
    .index('by_status', ['status']),

  rewardsEconomyConfig: defineTable({
    ptsPerValidatedSession: v.number(),
    ptsPerWeekObjective: v.number(),
    dailyCap: v.number(),
    seasonCap: v.number(),
    codeTtlMs: v.number(),
    activeFrom: v.number(),
  }).index('by_activeFrom', ['activeFrom']),

  /**
   * Partner tool auth (ARCHI_OUTIL_PARTENAIRE §3.1) — separate from player auth_users.
   * No SSO joueur → outil.
   */
  rewardsPartnerAccount: defineTable({
    email: v.string(),
    passwordHash: v.string(),
    partnerId: v.id('rewardsPartner'),
    role: v.union(
      v.literal('partner_staff'),
      v.literal('partner_admin'),
      v.literal('rg_admin'),
    ),
    active: v.boolean(),
    createdAt: v.number(),
    lastLoginAt: v.optional(v.number()),
  })
    .index('by_email', ['email'])
    .index('by_partnerId', ['partnerId'])
    .index('by_partner_role', ['partnerId', 'role']),

  rewardsPartnerInvite: defineTable({
    tokenHash: v.string(),
    partnerId: v.id('rewardsPartner'),
    role: v.union(v.literal('partner_staff'), v.literal('partner_admin')),
    email: v.optional(v.string()),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
    createdAt: v.number(),
    createdByAccountId: v.optional(v.id('rewardsPartnerAccount')),
  })
    .index('by_tokenHash', ['tokenHash'])
    .index('by_partnerId', ['partnerId']),

  rewardsPartnerSession: defineTable({
    accountId: v.id('rewardsPartnerAccount'),
    tokenHash: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    lastActiveAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index('by_tokenHash', ['tokenHash'])
    .index('by_accountId', ['accountId']),

  /** Append-only caisse action log (ARCHI_OUTIL_PARTENAIRE §5). */
  rewardsPartnerActionLog: defineTable({
    partnerId: v.id('rewardsPartner'),
    accountId: v.id('rewardsPartnerAccount'),
    role: v.string(),
    code: v.string(),
    redemptionId: v.optional(v.id('rewardsRedemptionCode')),
    action: v.union(
      v.literal('lookup'),
      v.literal('consume'),
      v.literal('refuse'),
    ),
    result: v.union(
      v.literal('ok'),
      v.literal('denied'),
      v.literal('error'),
    ),
    errorCode: v.optional(v.string()),
    reason: v.optional(v.string()),
    adminConfirmed: v.optional(v.boolean()),
    createdAt: v.number(),
    ipHash: v.optional(v.string()),
  })
    .index('by_partner_time', ['partnerId', 'createdAt'])
    .index('by_account_time', ['accountId', 'createdAt'])
    .index('by_code', ['code']),

  /**
   * Hydratation v2 (ARCHI_HYDRATATION) — isolé de ranked* / rewards*.
   * `proEntitlements` = legacy / inventaire post-merge uniquement.
   * Source de vérité Pro cosmétique = `subscriptionAccess` / `requirePro` (Ranked Pro Solo).
   * Ne jamais promouvoir `activeUntil` en droit payant sans reçu validé.
   */
  proEntitlements: defineTable({
    userId: v.string(),
    activeUntil: v.number(),
    updatedAt: v.number(),
  }).index('by_user', ['userId']),

  hydrationSettings: defineTable({
    userId: v.string(),
    mode: v.union(
      v.literal('classic_15'),
      v.literal('classic_2l'),
      v.literal('glasses_250'),
      v.literal('my_bottle'),
    ),
    goalMl: v.number(),
    myBottleVolumeMl: v.optional(v.number()),
    myBottleHasShape: v.boolean(),
    remindersEnabled: v.boolean(),
    reminderTimes: v.array(v.string()),
    onboardedAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index('by_user', ['userId']),

  hydrationEntries: defineTable({
    userId: v.string(),
    dayKey: v.string(),
    amountMl: v.number(),
    source: v.union(
      v.literal('glass'),
      v.literal('half_bottle'),
      v.literal('full_bottle'),
      v.literal('slider'),
    ),
    clientId: v.string(),
    createdAt: v.number(),
    undoneAt: v.optional(v.number()),
  })
    .index('by_user_day', ['userId', 'dayKey'])
    .index('by_user_client', ['userId', 'clientId']),

  /**
   * Ranked Pro Solo v0 (ARCHI_ABONNEMENT_PRO §3).
   * Source de vérité Pro = chaînes vérifiées + projection `subscriptionAccess`.
   */

  /** DOB privée pour garde d’achat 15+ (ARCHI §7) — hors `subscriptions`. */
  subscriptionUserProfiles: defineTable({
    userId: v.string(),
    dateOfBirth: v.optional(v.string()), // YYYY-MM-DD
    dateOfBirthUpdatedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_user', ['userId']),

  subscriptionAccounts: defineTable({
    userId: v.string(),
    storeAccountToken: v.string(),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_store_token', ['storeAccountToken']),

  subscriptions: defineTable({
    userId: v.string(),
    source: v.union(v.literal('apple'), v.literal('google'), v.literal('admin')),
    environment: v.union(
      v.literal('production'),
      v.literal('sandbox'),
      v.literal('local_test'),
    ),
    storeChainKey: v.string(),
    purchaseTokenEncrypted: v.optional(v.string()),
    linkedChainKey: v.optional(v.string()),
    latestTransactionId: v.optional(v.string()),
    productId: v.string(),
    basePlanId: v.optional(v.string()),
    offerId: v.optional(v.string()),
    plan: v.literal('solo'),
    seatLimit: v.number(),
    billingPeriod: v.union(v.literal('month'), v.literal('year')),
    status: v.union(
      v.literal('pending'),
      v.literal('trial'),
      v.literal('active'),
      v.literal('canceled_active_until'),
      v.literal('grace'),
      v.literal('suspended'),
      v.literal('expired'),
      v.literal('refunded'),
      v.literal('revoked'),
    ),
    periodEndsAt: v.optional(v.number()),
    trialEndsAt: v.optional(v.number()),
    graceEndsAt: v.optional(v.number()),
    autoRenew: v.boolean(),
    isTrial: v.boolean(),
    billingRetry: v.boolean(),
    familyShared: v.optional(v.boolean()),
    revokedAt: v.optional(v.number()),
    refundedAt: v.optional(v.number()),
    verifiedAt: v.number(),
    updatedAt: v.number(),
    revision: v.number(),
    adminActorId: v.optional(v.string()),
    adminReason: v.optional(v.string()),
  })
    .index('by_user', ['userId'])
    .index('by_source_env_chain', ['source', 'environment', 'storeChainKey']),

  subscriptionAccess: defineTable({
    userId: v.string(),
    active: v.boolean(),
    state: v.string(),
    subscriptionId: v.optional(v.id('subscriptions')),
    plan: v.optional(v.literal('solo')),
    origin: v.optional(
      v.union(v.literal('apple'), v.literal('google'), v.literal('admin')),
    ),
    accessUntil: v.optional(v.number()),
    trialEndsAt: v.optional(v.number()),
    autoRenew: v.optional(v.boolean()),
    nextTransitionAt: v.optional(v.number()),
    revision: v.number(),
    updatedAt: v.number(),
  }).index('by_user', ['userId']),

  subscriptionEvents: defineTable({
    source: v.string(),
    environment: v.string(),
    eventKey: v.string(),
    subscriptionId: v.optional(v.id('subscriptions')),
    userId: v.optional(v.string()),
    type: v.string(),
    sourceOccurredAt: v.optional(v.number()),
    receivedAt: v.number(),
    payloadHash: v.string(),
    payloadEncrypted: v.optional(v.string()),
    processingState: v.union(
      v.literal('queued'),
      v.literal('processing'),
      v.literal('applied'),
      v.literal('quarantined'),
      v.literal('failed'),
    ),
    attempts: v.number(),
    lastError: v.optional(v.string()),
    actor: v.optional(v.string()),
    before: v.optional(v.string()),
    after: v.optional(v.string()),
    appliedAt: v.optional(v.number()),
  })
    .index('by_source_env_event', ['source', 'environment', 'eventKey'])
    .index('by_processing_state', ['processingState', 'receivedAt']),

  subscriptionPurchaseAttempts: defineTable({
    userId: v.string(),
    offerKey: v.string(),
    productId: v.string(),
    billingPeriod: v.union(v.literal('month'), v.literal('year')),
    storeAccountToken: v.string(),
    legalVersionL05: v.string(),
    legalVersionL05b: v.string(),
    cgvVersion: v.string(),
    withdrawalConsentAt: v.number(),
    ageGateYears: v.number(),
    agePolicyVersion: v.string(),
    status: v.union(
      v.literal('prepared'),
      v.literal('submitted'),
      v.literal('verified'),
      v.literal('abandoned'),
      v.literal('rejected'),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_created', ['userId', 'createdAt']),

  /** Confirmation durable post-achat (PRO-L05d / CA-PRO25) — page sauvegardable. */
  subscriptionReceipts: defineTable({
    userId: v.string(),
    subscriptionId: v.optional(v.id('subscriptions')),
    purchaseAttemptId: v.optional(v.id('subscriptionPurchaseAttempts')),
    offerKey: v.string(),
    productId: v.string(),
    priceDisplay: v.string(),
    firstChargeAt: v.optional(v.number()),
    firstChargeAmountDisplay: v.string(),
    withdrawalConsentAt: v.number(),
    legalVersionL05: v.string(),
    cancelUrl: v.string(),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_created', ['userId', 'createdAt']),

  /**
   * Outbox rappels (essai J−2, annuel ~J−30 PRO-P05).
   * Dédupliqués par (userId, kind, periodKey).
   */
  subscriptionReminderOutbox: defineTable({
    userId: v.string(),
    kind: v.union(
      v.literal('trial_end_j2'),
      v.literal('annual_renewal_j30'),
    ),
    periodKey: v.string(),
    fireAt: v.number(),
    status: v.union(
      v.literal('scheduled'),
      v.literal('sent'),
      v.literal('cancelled'),
      v.literal('failed'),
    ),
    channel: v.union(v.literal('local_push'), v.literal('email'), v.literal('in_app')),
    createdAt: v.number(),
    updatedAt: v.number(),
    sentAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
  })
    .index('by_user_kind_period', ['userId', 'kind', 'periodKey'])
    .index('by_status_fireAt', ['status', 'fireAt']),
}

export default defineSchema(convexTables)
