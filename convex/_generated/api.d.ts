/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accountLinks from "../accountLinks.js";
import type * as ai from "../ai.js";
import type * as auth from "../auth.js";
import type * as authPrivateData from "../authPrivateData.js";
import type * as avisBeta from "../avisBeta.js";
import type * as avisDistress from "../avisDistress.js";
import type * as avisInsults from "../avisInsults.js";
import type * as emailVerification from "../emailVerification.js";
import type * as files from "../files.js";
import type * as foodAdd from "../foodAdd.js";
import type * as health from "../health.js";
import type * as lib_athleteMetrics from "../lib/athleteMetrics.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_authConfig from "../lib/authConfig.js";
import type * as lib_authCrypto from "../lib/authCrypto.js";
import type * as lib_foodAddAccess from "../lib/foodAddAccess.js";
import type * as lib_foodAddNutrients from "../lib/foodAddNutrients.js";
import type * as lib_foodAddPublic from "../lib/foodAddPublic.js";
import type * as lib_foodAddQuantity from "../lib/foodAddQuantity.js";
import type * as lib_foodAddUpsertSanitize from "../lib/foodAddUpsertSanitize.js";
import type * as lib_geminiMealPhotoRetry from "../lib/geminiMealPhotoRetry.js";
import type * as lib_googleIdToken from "../lib/googleIdToken.js";
import type * as lib_migrationAdmin from "../lib/migrationAdmin.js";
import type * as lib_nutritionProfile from "../lib/nutritionProfile.js";
import type * as lib_passwordResetMailer from "../lib/passwordResetMailer.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_socialVisibility from "../lib/socialVisibility.js";
import type * as lib_stripJournalMeals from "../lib/stripJournalMeals.js";
import type * as lib_transactionalMailer from "../lib/transactionalMailer.js";
import type * as mealPhotoAi from "../mealPhotoAi.js";
import type * as migrations from "../migrations.js";
import type * as nutrition from "../nutrition.js";
import type * as profiles from "../profiles.js";
import type * as purgeSupabaseMeals from "../purgeSupabaseMeals.js";
import type * as rpc from "../rpc.js";
import type * as social from "../social.js";
import type * as sync from "../sync.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accountLinks: typeof accountLinks;
  ai: typeof ai;
  auth: typeof auth;
  authPrivateData: typeof authPrivateData;
  avisBeta: typeof avisBeta;
  avisDistress: typeof avisDistress;
  avisInsults: typeof avisInsults;
  emailVerification: typeof emailVerification;
  files: typeof files;
  foodAdd: typeof foodAdd;
  health: typeof health;
  "lib/athleteMetrics": typeof lib_athleteMetrics;
  "lib/auth": typeof lib_auth;
  "lib/authConfig": typeof lib_authConfig;
  "lib/authCrypto": typeof lib_authCrypto;
  "lib/foodAddAccess": typeof lib_foodAddAccess;
  "lib/foodAddNutrients": typeof lib_foodAddNutrients;
  "lib/foodAddPublic": typeof lib_foodAddPublic;
  "lib/foodAddQuantity": typeof lib_foodAddQuantity;
  "lib/foodAddUpsertSanitize": typeof lib_foodAddUpsertSanitize;
  "lib/geminiMealPhotoRetry": typeof lib_geminiMealPhotoRetry;
  "lib/googleIdToken": typeof lib_googleIdToken;
  "lib/migrationAdmin": typeof lib_migrationAdmin;
  "lib/nutritionProfile": typeof lib_nutritionProfile;
  "lib/passwordResetMailer": typeof lib_passwordResetMailer;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/socialVisibility": typeof lib_socialVisibility;
  "lib/stripJournalMeals": typeof lib_stripJournalMeals;
  "lib/transactionalMailer": typeof lib_transactionalMailer;
  mealPhotoAi: typeof mealPhotoAi;
  migrations: typeof migrations;
  nutrition: typeof nutrition;
  profiles: typeof profiles;
  purgeSupabaseMeals: typeof purgeSupabaseMeals;
  rpc: typeof rpc;
  social: typeof social;
  sync: typeof sync;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
