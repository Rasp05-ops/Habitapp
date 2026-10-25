import { store } from "./storage";

export type Theme = "auto" | "dark" | "light";
export const getTheme = (): Theme => (store.get("habit_theme") as Theme) || "auto";
export function applyTheme(t: Theme = getTheme()) {
  if (t === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "light" ? "#f4f3ff" : "#0a0b1e");
}
export function setTheme(t: Theme) { store.set("habit_theme", t); applyTheme(t); }
