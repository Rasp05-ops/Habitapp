import { shuffle, type Rand, secureRand } from "./rng";

/** A board is 81 numbers, row-major. 0 = empty. */
export type Grid = number[];
export type Difficulty = "easy" | "medium" | "hard";
export const CLUES: Record<Difficulty, number> = { easy: 40, medium: 33, hard: 27 };

const ROW = (i: number) => (i / 9) | 0;
const COL = (i: number) => i % 9;
const BOX = (i: number) => ((ROW(i) / 3) | 0) * 3 + ((COL(i) / 3) | 0);
const ALL = 0x1ff; // bits 0..8 = digits 1..9

interface Masks { rows: number[]; cols: number[]; boxes: number[] }

function masksOf(g: Grid): Masks | null {
  const m: Masks = { rows: Array(9).fill(0), cols: Array(9).fill(0), boxes: Array(9).fill(0) };
  for (let i = 0; i < 81; i++) {
    if (!g[i]) continue;
    const bit = 1 << (g[i] - 1);
    if (m.rows[ROW(i)] & bit || m.cols[COL(i)] & bit || m.boxes[BOX(i)] & bit) return null;  // given clues already clash
    m.rows[ROW(i)] |= bit; m.cols[COL(i)] |= bit; m.boxes[BOX(i)] |= bit;
  }
  return m;
}

const popcount = (x: number) => { let n = 0; while (x) { x &= x - 1; n++; } return n; };

/**
 * Backtracking solver with "most constrained cell first". Counts solutions up to `limit`
 * (2 is enough to prove uniqueness). Optionally randomises digit order and stores the first solution.
 */
function search(g: Grid, limit: number, rand?: Rand, out?: Grid): number {
  const m = masksOf(g);
  if (!m) return 0;
  const grid = g.slice();
  let found = 0;

  const go = (): void => {
    let best = -1, bestMask = 0, bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (grid[i]) continue;
      const free = ALL & ~(m.rows[ROW(i)] | m.cols[COL(i)] | m.boxes[BOX(i)]);
      const n = popcount(free);
      if (n === 0) return;                               // dead end
      if (n < bestCount) { best = i; bestMask = free; bestCount = n; if (n === 1) break; }
    }
    if (best === -1) { found++; if (found === 1 && out) out.splice(0, 81, ...grid); return; }

    let digits = [] as number[];
    for (let d = 0; d < 9; d++) if (bestMask & (1 << d)) digits.push(d);
    if (rand) digits = shuffle(digits, rand);
    for (const d of digits) {
      const bit = 1 << d;
      grid[best] = d + 1; m.rows[ROW(best)] |= bit; m.cols[COL(best)] |= bit; m.boxes[BOX(best)] |= bit;
      go();
      grid[best] = 0; m.rows[ROW(best)] &= ~bit; m.cols[COL(best)] &= ~bit; m.boxes[BOX(best)] &= ~bit;
      if (found >= limit) return;
    }
  };
  go();
  return found;
}

export const countSolutions = (g: Grid, limit = 2) => search(g, limit);

export function solve(g: Grid): Grid | null {
  const out: Grid = [];
  return search(g, 1, undefined, out) ? out : null;
}

export function randomSolved(rand: Rand = secureRand): Grid {
  const out: Grid = [];
  search(Array(81).fill(0), 1, rand, out);
  return out;
}

export interface Puzzle { puzzle: Grid; solution: Grid; givens: boolean[] }

/** Removes cells one by one, keeping a cell removed only if the puzzle still has exactly ONE solution. */
export function makePuzzle(difficulty: Difficulty = "medium", rand: Rand = secureRand): Puzzle {
  const solution = randomSolved(rand);
  const puzzle = solution.slice();
  let clues = 81;
  for (const i of shuffle([...Array(81).keys()], rand)) {
    if (clues <= CLUES[difficulty]) break;
    const keep = puzzle[i];
    puzzle[i] = 0;
    if (countSolutions(puzzle, 2) !== 1) puzzle[i] = keep; else clues--;
  }
  return { puzzle, solution, givens: puzzle.map((v) => v !== 0) };
}

/** Indexes of cells that share a row, column or box with an equal non-zero value. */
export function findConflicts(g: Grid): Set<number> {
  const bad = new Set<number>();
  const groups: number[][] = [];
  for (let k = 0; k < 9; k++) {
    groups.push(Array.from({ length: 9 }, (_, j) => k * 9 + j));                                  // row
    groups.push(Array.from({ length: 9 }, (_, j) => j * 9 + k));                                  // column
    groups.push(Array.from({ length: 9 }, (_, j) => ((k / 3) | 0) * 27 + (k % 3) * 3 + ((j / 3) | 0) * 9 + (j % 3))); // box
  }
  for (const cells of groups) {
    const seen = new Map<number, number>();
    for (const i of cells) {
      const v = g[i];
      if (!v) continue;
      if (seen.has(v)) { bad.add(i); bad.add(seen.get(v)!); } else seen.set(v, i);
    }
  }
  return bad;
}

/** Solved = every cell filled and no conflicts. (With a unique-solution puzzle this equals "matches the answer".) */
export const isSolved = (g: Grid) => g.every((v) => v >= 1 && v <= 9) && findConflicts(g).size === 0;

/** Digits that are still legal in an empty cell (for the optional "notes" helper). */
export function candidates(g: Grid, i: number): number[] {
  if (g[i]) return [];
  const used = new Set<number>();
  for (let j = 0; j < 81; j++) if (g[j] && (ROW(j) === ROW(i) || COL(j) === COL(i) || BOX(j) === BOX(i))) used.add(g[j]);
  return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => !used.has(d));
}
