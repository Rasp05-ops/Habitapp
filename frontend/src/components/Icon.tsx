const P: Record<string, string> = {
  home: "M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10M10 19.5v-5h4v5",
  calendar: "M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 3v4M16 3v4",
  games: "M7 8h10a4 4 0 0 1 4 4v1.5a3 3 0 0 1-5.4 1.8L15 14.5H9l-.6.8A3 3 0 0 1 3 13.5V12a4 4 0 0 1 4-4zM8 11v3M6.5 12.5h3M16 11.5h.01M18 13.5h.01",
  book: "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21zM4 5.5v15M8 7h8M8 11h8",
  trophy: "M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5a1 1 0 0 0-1 1 4 4 0 0 0 4.5 4M16 6h3.5a1 1 0 0 1 1 1 4 4 0 0 1-4.5 4M12 13v4M8.5 20h7M10 17h4",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0",
  flame: "M12 3c.5 3-1.5 4.5-3 6.5S7 13 8 15.5a4.5 4.5 0 0 0 8.5 1c1-2.5-.5-5-1.5-6.5-.7 1-1.5 1.5-2 1.5.5-2.5.5-5.5-1-8.5z",
  star: "m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  snow: "M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5",
  camera: "M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  check: "m5 12.5 4.5 4.5L19 7.5",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z",
  logout: "M10 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M15 8l4 4-4 4M19 12H9",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  trash: "M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10 11v5M14 11v5",
  left: "m14 6-6 6 6 6",
  right: "m10 6 6 6-6 6",
  back: "M19 12H5M11 6l-6 6 6 6",
  moon: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z",
  sun: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z",
  bolt: "M13 3 5 13.5h6L10 21l8-10.5h-6z",
  eraser: "m7 21-4-4a2 2 0 0 1 0-2.8l10-10a2 2 0 0 1 2.8 0l5 5a2 2 0 0 1 0 2.8L12 21zM9 11l6 6",
  pencil: "M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16zM13.5 6.5l4 4",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z",
  refresh: "M20 11a8 8 0 0 0-14.5-4M4 4v4h4M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4",
  crown: "m3 8 4.5 4L12 5l4.5 7L21 8l-1.5 11h-15z",
};

export default function Icon({ name, size = 22, className, fill = false }: { name: keyof typeof P | string; size?: number; className?: string; fill?: boolean }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={P[name] ?? ""} />
    </svg>
  );
}
