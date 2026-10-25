// Friendly names for the generated contract types. Never edit schema.d.ts by hand:
// run `npm run gen:types` after the contract changes.
import type { components } from "./schema";

type S = components["schemas"];
export type User = S["User"];
export type Habit = S["Habit"];
export type CatalogHabit = S["CatalogHabit"];
export type Today = S["Today"];
export type TodayHabit = S["TodayHabit"];
export type Progress = S["Progress"];
export type CheckInResult = S["CheckInResult"];
export type Game = S["Game"];
export type GamesResponse = S["GamesResponse"];
export type LeaderboardResponse = S["LeaderboardResponse"];
export type LeaderboardEntry = S["LeaderboardEntry"];
export type CalendarResponse = S["CalendarResponse"];
export type AuthResult = S["AuthResult"];
export type ErrorCode = S["ErrorCode"];
export type Language = S["Language"];
/** Contract errors plus the one the browser itself can produce (offline / timeout). */
export type UiErrorCode = ErrorCode | "NETWORK_ERROR";
export type DailyStory = S["DailyStory"];
