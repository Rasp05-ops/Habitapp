import type { ReactNode } from "react";
import { useApp } from "../hooks/app";

export function Spinner({ label }: { label?: string }) {
  return <div className="spinner-wrap" role="status"><span className="spinner" /> {label && <span className="muted">{label}</span>}</div>;
}

export function Skeleton({ h = 120, className = "" }: { h?: number; className?: string }) {
  return <div className={`skeleton ${className}`} style={{ height: h }} aria-hidden="true" />;
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { err, t } = useApp();
  return (
    <div className="card center-card" role="alert">
      <p>{err(error)}</p>
      <button className="btn primary" onClick={onRetry}>{t("ui.retry")}</button>
    </div>
  );
}

export function PageHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="page-head">
      <div><h1>{title}</h1>{sub && <p className="muted">{sub}</p>}</div>
      {right}
    </div>
  );
}

export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={`switch ${on ? "on" : ""}`} onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}

export function Stepper({ value, min, max, onChange, unit }: { value: number; min: number; max: number; onChange: (v: number) => void; unit?: string }) {
  return (
    <div className="stepper">
      <button type="button" className="btn icon" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="−">−</button>
      <div className="stepper-val"><b>{value}</b>{unit && <small>{unit}</small>}</div>
      <button type="button" className="btn icon" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="+">+</button>
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} className={o.value === value ? "on" : ""} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export const fmtTime = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
