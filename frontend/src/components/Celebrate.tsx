import { useEffect } from "react";
import KungFuPanda from "./KungFuPanda";

const COLORS = ["#8b7bff", "#ff6fb5", "#ffb454", "#38e1a8", "#5ec8ff"];

/** CSS-only confetti. Hidden automatically for people who prefer reduced motion. */
export default function Celebrate({ title, lines, onClose, cta }: { title: string; lines: string[]; onClose: () => void; cta: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const timer = setTimeout(onClose, 6000);
    return () => { window.removeEventListener("keydown", k); clearTimeout(timer); };
  }, [onClose]);
  return (
    <div className="celebrate" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="confetti" aria-hidden="true">
        {Array.from({ length: 36 }, (_, i) => (
          <i key={i} style={{ left: `${(i * 97) % 100}%`, background: COLORS[i % COLORS.length], animationDelay: `${(i % 9) * 0.07}s`, animationDuration: `${1.8 + (i % 5) * 0.25}s`, transform: `rotate(${i * 40}deg)` }} />
        ))}
      </div>
      <div className="celebrate-card" onClick={(e) => e.stopPropagation()}>
        <KungFuPanda variant="streak" />
        <h2>{title}</h2>
        {lines.map((l) => <p key={l} className="celebrate-line">{l}</p>)}
        <button className="btn primary" onClick={onClose} autoFocus>{cta}</button>
      </div>
    </div>
  );
}
