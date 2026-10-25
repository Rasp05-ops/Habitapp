/** Small seedable RNG so game logic is deterministic in tests. Use crypto in the real app. */
export type Rand = () => number;

export function mulberry32(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const secureRand: Rand = () => {
  const c = globalThis.crypto;
  if (!c?.getRandomValues) return Math.random();
  const a = new Uint32Array(1);
  c.getRandomValues(a);
  return a[0] / 4294967296;
};

/** Fisher–Yates. (`arr.sort(() => Math.random() - 0.5)` is biased and must not be used.) */
export function shuffle<T>(input: readonly T[], rand: Rand = secureRand): T[] {
  const a = input.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const pick = <T,>(arr: readonly T[], rand: Rand = secureRand): T => arr[Math.floor(rand() * arr.length)];
