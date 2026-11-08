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
import type * as hydration from "../hydration.js";
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
import type * as purgeSupabaseMeals from "../purgeSupabaseMeals.js";
import type * as ranked from "../ranked.js";
import type * as rewards from "../rewards.js";
import type * as rpc from "../rpc.js";
import type * as social from "../social.js";
import type * as sync from "../sync.js";
import type * as lib_rankedAccess from "../lib/rankedAccess.js";
import type * as lib_rankedScience from "../lib/rankedScience.js";
import type * as lib_rewardsEconomy from "../lib/rewardsEconomy.js";
import type * as lib_subscriptionAccess from "../lib/subscriptionAccess.js";
import type * as lib_subscriptionApply from "../lib/subscriptionApply.js";
import type * as lib_subscriptionProducts from "../lib/subscriptionProducts.js";
import type * as lib_appleJws from "../lib/appleJws.js";
import type * as lib_appleServerApi from "../lib/appleServerApi.js";
import type * as lib_googlePlayVerify from "../lib/googlePlayVerify.js";
import type * as lib_iapHttp from "../lib/iapHttp.js";
import type * as lib_proEntitlement from "../lib/proEntitlement.js";
import type * as lib_subscriptionReminders from "../lib/subscriptionReminders.js";
import type * as subscriptions from "../subscriptions.js";

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
  hydration: typeof hydration;
  "lib/auth": typeof lib_auth;
  "lib/authConfig": typeof lib_authConfig;
  "lib/authCrypto": typeof lib_authCrypto;
  "lib/foodAddAccess": typeof lib_foodAddAccess;
  "lib/migrationAdmin": typeof lib_migrationAdmin;
  "lib/rankedAccess": typeof lib_rankedAccess;
  "lib/rankedScience": typeof lib_rankedScience;
  "lib/rewardsEconomy": typeof lib_rewardsEconomy;
  "lib/subscriptionAccess": typeof lib_subscriptionAccess;
  "lib/subscriptionApply": typeof lib_subscriptionApply;
  "lib/subscriptionProducts": typeof lib_subscriptionProducts;
  "lib/appleJws": typeof lib_appleJws;
  "lib/appleServerApi": typeof lib_appleServerApi;
  "lib/googlePlayVerify": typeof lib_googlePlayVerify;
  "lib/iapHttp": typeof lib_iapHttp;
  "lib/proEntitlement": typeof lib_proEntitlement;
  "lib/subscriptionReminders": typeof lib_subscriptionReminders;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/socialVisibility": typeof lib_socialVisibility;
  "lib/stripJournalMeals": typeof lib_stripJournalMeals;
  "lib/transactionalMailer": typeof lib_transactionalMailer;
  migrations: typeof migrations;
  nutrition: typeof nutrition;
  profiles: typeof profiles;
  purgeSupabaseMeals: typeof purgeSupabaseMeals;
  ranked: typeof ranked;
  rewards: typeof rewards;
  rpc: typeof rpc;
  social: typeof social;
  subscriptions: typeof subscriptions;
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
