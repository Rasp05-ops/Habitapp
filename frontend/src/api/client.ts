import { store } from "../lib/storage";
import type {
  AuthResult, CalendarResponse, CatalogHabit, CheckInResult, GamesResponse,
  Habit, LeaderboardResponse, Today, UiErrorCode, User,
} from "./types";

const BASE: string = import.meta.env.VITE_API_BASE ?? "/api/v1";
const TOKEN_KEY = "habit_token";

export class ApiError extends Error {
  constructor(public status: number, public code: UiErrorCode, message: string) { super(message); }
}

export const auth = {
  get token() { return store.get(TOKEN_KEY); },
  set token(v: string | null) { store.set(TOKEN_KEY, v); },
};

/** Fired when the server says our token is no longer valid, so the app can return to the login screen. */
export const AUTH_EXPIRED = "habit:auth-expired";

async function request<T>(method: string, path: string, body?: unknown, timeoutMs = 20_000): Promise<T> {
  const headers: Record<string, string> = {};
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;                 // browser sets the multipart boundary
  else if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: payload, signal: ctl.signal });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Network error");     // offline, DNS, CORS, or timeout
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const code = (data?.error?.code ?? "INTERNAL_ERROR") as UiErrorCode;
    if (res.status === 401 && auth.token) { auth.token = null; window.dispatchEvent(new Event(AUTH_EXPIRED)); }
    throw new ApiError(res.status, code, data?.error?.message ?? "Something went wrong");
  }
  return data as T;
}

export const api = {
  register: async (username: string, password: string) => {
    const r = await request<AuthResult>("POST", "/auth/register", { username, password });
    auth.token = r.access_token;
    return r;
  },
  login: async (username: string, password: string) => {
    const r = await request<AuthResult>("POST", "/auth/login", { username, password });
    auth.token = r.access_token;
    return r;
  },
  requestOtp: (phone: string) => request<{ sent: boolean; expires_in_seconds: number }>("POST", "/auth/otp/request", { phone }),
  verifyOtp: async (phone: string, otp: string) => {
    const r = await request<AuthResult>("POST", "/auth/otp/verify", { phone, otp });
    auth.token = r.access_token;
    return r;
  },
  logout: () => { auth.token = null; },
  me: () => request<User>("GET", "/me"),
  updateMe: (patch: Partial<Pick<User, "name" | "language" | "timezone" | "daily_target" | "leaderboard_opt_in" | "onboarding_completed">>) =>
    request<User>("PATCH", "/me", patch),
  catalog: () => request<{ habits: CatalogHabit[] }>("GET", "/habits/catalog"),
  habits: () => request<{ habits: Habit[] }>("GET", "/habits"),
  addHabit: (catalog_id: string) => request<Habit>("POST", "/habits", { catalog_id }),
  removeHabit: (id: string) => request<void>("DELETE", `/habits/${id}`),
  today: () => request<Today>("GET", "/today"),
  checkInTap: (id: string) => request<CheckInResult>("POST", `/habits/${id}/check-ins`, { method: "tap" }),
  checkInPhoto: (id: string, photo: Blob) => {
    const f = new FormData();
    f.append("photo", photo, "photo.jpg");
    return request<CheckInResult>("POST", `/habits/${id}/check-ins`, f, 45_000);   // Gemini can be slow on 2G/3G
  },
  games: () => request<GamesResponse>("GET", "/games"),
  leaderboard: (limit = 20) => request<LeaderboardResponse>("GET", `/leaderboard/weekly?limit=${limit}`),
  calendar: (month: string) => request<CalendarResponse>("GET", `/history/calendar?month=${month}`),
  todayStory: () => request<import("./types").DailyStory>("GET", "/stories/today"),
  markStoryWatched: (id: string) => request<import("./types").DailyStory>("POST", `/stories/${id}/watched`),
  submitStoryQuiz: (id: string, answers: Record<string, number>) =>
    request<import("./types").DailyStory>("POST", `/stories/${id}/quiz`, { answers }),
};
