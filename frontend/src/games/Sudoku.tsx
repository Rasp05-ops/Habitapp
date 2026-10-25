import { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "../components/Icon";
import { fmtTime, Segmented, Spinner } from "../components/ui";
import { useApp } from "../hooks/app";
import { store } from "../lib/storage";
import { findConflicts, isSolved, makePuzzle, type Difficulty, type Puzzle } from "./logic/sudoku";

const MAX_HINTS = 3;
const peers = (a: number, b: number) =>
  a !== b && (((a / 9) | 0) === ((b / 9) | 0) || a % 9 === b % 9 || (((a / 27) | 0) === ((b / 27) | 0) && (((a % 9) / 3) | 0) === (((b % 9) / 3) | 0)));

export default function Sudoku() {
  const { t } = useApp();
  const [level, setLevel] = useState<Difficulty>("easy");
  const [puz, setPuz] = useState<Puzzle | null>(null);
  const [vals, setVals] = useState<number[]>([]);
  const [notes, setNotes] = useState<number[]>([]);        // bitmask of pencil marks per cell
  const [fixed, setFixed] = useState<boolean[]>([]);       // givens + hinted cells can't be edited
  const [sel, setSel] = useState<number | null>(null);
  const [pencil, setPencil] = useState(false);
  const [hints, setHints] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [won, setWon] = useState(false);
  const [best, setBest] = useState<number | null>(null);

  const start = useCallback((lv: Difficulty) => {
    setLevel(lv); setPuz(null); setWon(false);
    setTimeout(() => {                                  // let the spinner paint before the (fast) generator runs
      const p = makePuzzle(lv);
      setPuz(p); setVals(p.puzzle.slice()); setNotes(Array(81).fill(0)); setFixed(p.givens.slice());
      setSel(null); setPencil(false); setHints(0); setMistakes(0); setSeconds(0);
      setBest(store.getJSON<number | null>(`sd_best_${lv}`, null));
    }, 30);
  }, []);
  useEffect(() => { start("easy"); }, [start]);

  useEffect(() => {
    if (!puz || won) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [puz, won]);

  const conflicts = useMemo(() => findConflicts(vals), [vals]);
  const counts = useMemo(() => { const c = Array(10).fill(0); vals.forEach((v, i) => { if (v && puz && v === puz.solution[i]) c[v]++; }); return c; }, [vals, puz]);

  const finish = (v: number[], secs: number) => {
    if (!isSolved(v)) return;
    setWon(true);
    const prev = store.getJSON<number | null>(`sd_best_${level}`, null);
    if (prev === null || secs < prev) { store.setJSON(`sd_best_${level}`, secs); setBest(secs); }
  };

  const place = useCallback((d: number) => {
    if (!puz || won || sel === null || fixed[sel]) return;
    if (pencil) {
      if (vals[sel] === 0) setNotes((n) => n.map((m, i) => (i === sel ? m ^ (1 << (d - 1)) : m)));
      return;
    }
    if (vals[sel] === d) { setVals((v) => v.map((x, i) => (i === sel ? 0 : x))); return; }   // same digit again = erase
    const nv = vals.map((x, i) => (i === sel ? d : x));
    setVals(nv);
    setNotes((n) => n.map((m, i) => (i === sel ? 0 : peers(i, sel) ? m & ~(1 << (d - 1)) : m)));   // placing a digit clears it from peers' notes
    if (d !== puz.solution[sel]) setMistakes((m) => m + 1);
    finish(nv, seconds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puz, won, sel, fixed, pencil, vals, seconds]);

  const erase = useCallback(() => {
    if (!puz || won || sel === null || fixed[sel]) return;
    setVals((v) => v.map((x, i) => (i === sel ? 0 : x))); setNotes((n) => n.map((m, i) => (i === sel ? 0 : m)));
  }, [puz, won, sel, fixed]);

  const hint = () => {
    if (!puz || won || hints >= MAX_HINTS) return;
    let i = sel !== null && !fixed[sel] && vals[sel] !== puz.solution[sel] ? sel : -1;
    if (i < 0) i = vals.findIndex((v, k) => !fixed[k] && v !== puz.solution[k]);
    if (i < 0) return;
    const nv = vals.map((x, k) => (k === i ? puz.solution[i] : x));
    setVals(nv); setFixed((f) => f.map((x, k) => x || k === i)); setNotes((n) => n.map((m, k) => (k === i ? 0 : peers(k, i) ? m & ~(1 << (puz.solution[i] - 1)) : m)));
    setSel(i); setHints((h) => h + 1); finish(nv, seconds);
  };

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[1-9]$/.test(e.key)) place(Number(e.key));
      else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") erase();
      else if (e.key.toLowerCase() === "n") setPencil((p) => !p);
      else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        setSel((s) => { const c = s ?? 40, r = (c / 9) | 0, k = c % 9;
          return e.key === "ArrowUp" ? Math.max(0, r - 1) * 9 + k : e.key === "ArrowDown" ? Math.min(8, r + 1) * 9 + k : e.key === "ArrowLeft" ? r * 9 + Math.max(0, k - 1) : r * 9 + Math.min(8, k + 1); });
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [place, erase]);

  return (
    <div className="game-wrap">
      <div className="game-bar">
        <Segmented value={level} onChange={start} options={[{ value: "easy", label: t("games.easy") }, { value: "medium", label: t("games.medium") }, { value: "hard", label: t("games.hard") }]} />
        <div className="stats-inline">
          <span><small>{t("games.time")}</small><b>{fmtTime(seconds)}</b></span>
          <span><small>{t("games.mistakes")}</small><b>{mistakes}</b></span>
          {best !== null && <span><small>{t("games.best")}</small><b>{fmtTime(best)}</b></span>}
        </div>
      </div>

      {!puz ? <div className="card center-card"><Spinner label={t("games.generating")} /></div> : (
        <div className="sd-layout">
          <div className="sd-board" role="grid" aria-label="Sudoku">
            {vals.map((v, i) => {
              const same = sel !== null && v !== 0 && vals[sel] === v;
              const wrong = v !== 0 && !fixed[i] && v !== puz.solution[i];
              const cls = ["sd-cell", fixed[i] ? "given" : "", i === sel ? "sel" : "", sel !== null && peers(i, sel) ? "peer" : "", same ? "same" : "",
                wrong || (conflicts.has(i) && !fixed[i]) ? "bad" : "", i % 9 === 2 || i % 9 === 5 ? "br" : "", ((i / 9) | 0) === 2 || ((i / 9) | 0) === 5 ? "bb" : ""].join(" ");
              return (
                <button key={i} className={cls} onClick={() => setSel(i)} role="gridcell" aria-selected={i === sel}
                  aria-label={`${((i / 9) | 0) + 1},${(i % 9) + 1}: ${v || "empty"}`}>
                  {v ? v : notes[i] ? <span className="sd-notes">{Array.from({ length: 9 }, (_, d) => <i key={d}>{notes[i] & (1 << d) ? d + 1 : ""}</i>)}</span> : null}
                </button>
              );
            })}
          </div>

          <div className="sd-pad">
            <div className="sd-digits">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                <button key={d} className="btn pad" onClick={() => place(d)} disabled={counts[d] >= 9 || won}>{d}<small>{9 - counts[d]}</small></button>
              ))}
            </div>
            <div className="sd-tools">
              <button className={`btn ghost ${pencil ? "on" : ""}`} onClick={() => setPencil(!pencil)} aria-pressed={pencil}><Icon name="pencil" size={18} /> {t("games.notes")}</button>
              <button className="btn ghost" onClick={erase}><Icon name="eraser" size={18} /> {t("games.erase")}</button>
              <button className="btn ghost" onClick={hint} disabled={hints >= MAX_HINTS || won}><Icon name="bulb" size={18} /> {t("games.hint")} {MAX_HINTS - hints}</button>
              <button className="btn ghost" onClick={() => start(level)}><Icon name="refresh" size={18} /> {t("games.new")}</button>
            </div>
          </div>
        </div>
      )}

      {won && (
        <div className="card result" role="status">
          <h2>{t("games.win")} 🎉</h2>
          <p className="muted">{fmtTime(seconds)} · {t("games.mistakes").toLowerCase()} {mistakes} · {t("games.hints").toLowerCase()} {hints}</p>
          <button className="btn primary" onClick={() => start(level)}>{t("games.again")}</button>
        </div>
      )}
    </div>
  );
}
