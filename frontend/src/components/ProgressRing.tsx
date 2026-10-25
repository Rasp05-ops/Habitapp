import { useId, type ReactNode } from "react";

/** Circular progress. `value` 0..1. Colours come from CSS (--ring-a / --ring-b). */
export default function ProgressRing({ value, size = 150, stroke = 12, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const id = useId();
  const v = Math.min(1, Math.max(0, value));
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--ring-a)" /><stop offset="100%" stopColor="var(--ring-b)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ring-track)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v)} transform={`rotate(-90 ${size / 2} ${size / 2})`} className="ring-arc" />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}
