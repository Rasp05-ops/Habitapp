import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Language, User } from "../api/types";
import { errText, t as tr } from "../i18n";

interface Toast { id: number; text: string; kind: "ok" | "err" | "info" }
interface Ctx {
  user: User;
  setUser: (u: User) => void;
  lang: Language;
  t: (key: string) => string;
  err: (e: unknown) => string;
  toast: (text: string, kind?: Toast["kind"]) => void;
  logout: () => void;
}

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
};

export function AppProvider({ user, setUser, logout, children }: { user: User; setUser: (u: User) => void; logout: () => void; children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const lang = user.language;

  const toast = useCallback((text: string, kind: Toast["kind"] = "info") => {
    const id = ++seq.current;
    setToasts((l) => [...l.slice(-2), { id, text, kind }]);
    setTimeout(() => setToasts((l) => l.filter((x) => x.id !== id)), 3800);
  }, []);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const value = useMemo<Ctx>(() => ({
    user, setUser, lang, toast, logout,
    t: (k) => tr(lang, k),
    err: (e) => errText(lang, e),
  }), [user, setUser, lang, toast, logout]);

  return (
    <AppCtx.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((x) => <div key={x.id} className={`toast ${x.kind}`} role="status">{x.text}</div>)}
      </div>
    </AppCtx.Provider>
  );
}
