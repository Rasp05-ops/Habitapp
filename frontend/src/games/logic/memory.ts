import { shuffle, type Rand, secureRand } from "./rng";

export interface Card { id: number; symbol: string; matched: boolean }
export interface MemoryState {
  cards: Card[];
  open: number[];      // indexes currently face-up and not yet matched (0, 1 or 2)
  moves: number;       // one move = two cards turned over
  locked: boolean;     // true while a mismatched pair is showing: input is ignored until `resolve`
  won: boolean;
}

export function newMemory(symbols: readonly string[], rand: Rand = secureRand): MemoryState {
  const cards = shuffle([...symbols, ...symbols], rand).map((symbol, id) => ({ id, symbol, matched: false }));
  return { cards, open: [], moves: 0, locked: false, won: false };
}

/** Turn a card over. Pure: returns the same state object when the click must be ignored. */
export function flip(s: MemoryState, index: number): MemoryState {
  const card = s.cards[index];
  if (!card || s.locked || s.won || card.matched || s.open.includes(index)) return s;
  const open = [...s.open, index];
  if (open.length < 2) return { ...s, open };

  const [a, b] = open;
  if (s.cards[a].symbol === s.cards[b].symbol) {
    const cards = s.cards.map((c, i) => (i === a || i === b ? { ...c, matched: true } : c));
    return { ...s, cards, open: [], moves: s.moves + 1, won: cards.every((c) => c.matched) };
  }
  return { ...s, open, moves: s.moves + 1, locked: true };   // wait for the UI to call resolve()
}

/** Turn a mismatched pair face-down again and unlock the board. */
export function resolve(s: MemoryState): MemoryState {
  return s.locked ? { ...s, open: [], locked: false } : s;
}

/** 3 stars for a near-perfect game, scaled by pair count. */
export function stars(moves: number, pairs: number): 1 | 2 | 3 {
  if (moves <= Math.ceil(pairs * 1.5)) return 3;
  if (moves <= pairs * 2.5) return 2;
  return 1;
}
