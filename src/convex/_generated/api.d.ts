/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as appTypes from "../appTypes.js";
import type * as auth from "../auth.js";
import type * as auth_emailOtp from "../auth/emailOtp.js";
import type * as competition from "../competition.js";
import type * as competitionEngine from "../competitionEngine.js";
import type * as competitionSelfTest from "../competitionSelfTest.js";
import type * as context from "../context.js";
import type * as draft from "../draft.js";
import type * as draftEngine from "../draftEngine.js";
import type * as draftSelfTest from "../draftSelfTest.js";
import type * as footballApi from "../footballApi.js";
import type * as footballData from "../footballData.js";
import type * as footballSync from "../footballSync.js";
import type * as http from "../http.js";
import type * as leagues from "../leagues.js";
import type * as market from "../market.js";
import type * as marketEngine from "../marketEngine.js";
import type * as marketSelfTest from "../marketSelfTest.js";
import type * as rulesEngine from "../rulesEngine.js";
import type * as squads from "../squads.js";
import type * as teams from "../teams.js";
import type * as tournament from "../tournament.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  appTypes: typeof appTypes;
  auth: typeof auth;
  "auth/emailOtp": typeof auth_emailOtp;
  competition: typeof competition;
  competitionEngine: typeof competitionEngine;
  competitionSelfTest: typeof competitionSelfTest;
  context: typeof context;
  draft: typeof draft;
  draftEngine: typeof draftEngine;
  draftSelfTest: typeof draftSelfTest;
  footballApi: typeof footballApi;
  footballData: typeof footballData;
  footballSync: typeof footballSync;
  http: typeof http;
  leagues: typeof leagues;
  market: typeof market;
  marketEngine: typeof marketEngine;
  marketSelfTest: typeof marketSelfTest;
  rulesEngine: typeof rulesEngine;
  squads: typeof squads;
  teams: typeof teams;
  tournament: typeof tournament;
  users: typeof users;
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
