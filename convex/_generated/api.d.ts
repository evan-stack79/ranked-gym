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
import type * as auth from "../auth.js";
import type * as authPrivateData from "../authPrivateData.js";
import type * as avisBeta from "../avisBeta.js";
import type * as avisDistress from "../avisDistress.js";
import type * as emailVerification from "../emailVerification.js";
import type * as files from "../files.js";
import type * as foodAdd from "../foodAdd.js";
import type * as health from "../health.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_authConfig from "../lib/authConfig.js";
import type * as lib_authCrypto from "../lib/authCrypto.js";
import type * as lib_foodAddAccess from "../lib/foodAddAccess.js";
import type * as lib_migrationAdmin from "../lib/migrationAdmin.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_socialVisibility from "../lib/socialVisibility.js";
import type * as lib_transactionalMailer from "../lib/transactionalMailer.js";
import type * as migrations from "../migrations.js";
import type * as lib_stripJournalMeals from "../lib/stripJournalMeals.js";
import type * as nutrition from "../nutrition.js";
import type * as profiles from "../profiles.js";
import type * as progression from "../progression.js";
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
  auth: typeof auth;
  authPrivateData: typeof authPrivateData;
  avisBeta: typeof avisBeta;
  avisDistress: typeof avisDistress;
  emailVerification: typeof emailVerification;
  files: typeof files;
  foodAdd: typeof foodAdd;
  health: typeof health;
  "lib/auth": typeof lib_auth;
  "lib/authConfig": typeof lib_authConfig;
  "lib/authCrypto": typeof lib_authCrypto;
  "lib/foodAddAccess": typeof lib_foodAddAccess;
  "lib/migrationAdmin": typeof lib_migrationAdmin;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/socialVisibility": typeof lib_socialVisibility;
  "lib/stripJournalMeals": typeof lib_stripJournalMeals;
  "lib/transactionalMailer": typeof lib_transactionalMailer;
  migrations: typeof migrations;
  nutrition: typeof nutrition;
  profiles: typeof profiles;
  progression: typeof progression;
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
