// localStorage throws in private mode / when blocked. Every access goes through here.
export const store = {
  get(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } },
  set(key: string, v: string | null) { try { v === null ? localStorage.removeItem(key) : localStorage.setItem(key, v); } catch { /* ignore */ } },
  getJSON<T>(key: string, fallback: T): T { try { const s = localStorage.getItem(key); return s ? (JSON.parse(s) as T) : fallback; } catch { return fallback; } },
  setJSON(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } },
};
