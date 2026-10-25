import { describe, expect, it } from "vitest";
import { flip, newMemory, resolve, stars } from "./memory";
import { mulberry32, shuffle } from "./rng";
import { candidates, countSolutions, findConflicts, isSolved, makePuzzle, randomSolved, solve, CLUES } from "./sudoku";
import { ANSWERS } from "./words";
import { mergeKeys, scoreGuess, statusOf } from "./wordle";

describe("shuffle", () => {
  it("keeps every element exactly once and does not mutate the input", () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8]; const out = shuffle(src, mulberry32(1));
    expect(out.slice().sort()).toEqual(src); expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it("is unbiased enough: each element lands first roughly 1/n of the time", () => {
    const r = mulberry32(42), n = 4, hits = [0, 0, 0, 0], N = 20000;
    for (let i = 0; i < N; i++) hits[shuffle([0, 1, 2, 3], r)[0]]++;
    hits.forEach((h) => expect(Math.abs(h / N - 1 / n)).toBeLessThan(0.02));
  });
});

describe("memory match", () => {
  const syms = ["a", "b", "c", "d"];
  const find = (s: ReturnType<typeof newMemory>, sym: string) => s.cards.map((c, i) => (c.symbol === sym ? i : -1)).filter((i) => i >= 0);

  it("deals every symbol exactly twice", () => {
    const s = newMemory(syms, mulberry32(3));
    expect(s.cards).toHaveLength(8);
    syms.forEach((x) => expect(find(s, x)).toHaveLength(2));
  });
  it("matches a pair, counts one move, and stays unlocked", () => {
    let s = newMemory(syms, mulberry32(3)); const [i, j] = find(s, "a");
    s = flip(flip(s, i), j);
    expect(s.cards[i].matched && s.cards[j].matched).toBe(true);
    expect(s.moves).toBe(1); expect(s.locked).toBe(false); expect(s.open).toEqual([]);
  });
  it("locks on a mismatch, ignores clicks until resolve, then turns both face-down", () => {
    let s = newMemory(syms, mulberry32(3)); const a = find(s, "a")[0], b = find(s, "b")[0], c = find(s, "c")[0];
    s = flip(flip(s, a), b);
    expect(s.locked).toBe(true); expect(s.open).toEqual([a, b]);
    expect(flip(s, c)).toBe(s);                    // third card is ignored while locked
    s = resolve(s);
    expect(s.locked).toBe(false); expect(s.open).toEqual([]); expect(s.moves).toBe(1);
  });
  it("ignores double-clicks on the same card and clicks on matched cards", () => {
    let s = newMemory(syms, mulberry32(3)); const [i, j] = find(s, "a");
    s = flip(s, i); expect(flip(s, i)).toBe(s);   // same card twice must not count as a pair
    s = flip(s, j); expect(flip(s, i)).toBe(s);   // already matched
    expect(flip(s, 99)).toBe(s);
  });
  it("detects the win and rewards fewer moves", () => {
    let s = newMemory(syms, mulberry32(9));
    for (const x of syms) { const [i, j] = find(s, x); s = flip(flip(s, i), j); }
    expect(s.won).toBe(true); expect(s.moves).toBe(4); expect(stars(4, 8)).toBe(3); expect(stars(40, 8)).toBe(1);
  });
});

describe("word guess scoring", () => {
  it("marks exact and misplaced letters", () => {
    expect(scoreGuess("crane", "crate")).toEqual(["correct", "correct", "correct", "absent", "correct"]);
    expect(scoreGuess("toast", "stoat")).toEqual(["present", "present", "present", "present", "correct"]);
  });
  it("handles repeated letters: only as many yellows as real copies", () => {
    // answer has ONE 'e' (last place); guess has three. Only the exact one is green, the others are grey.
    expect(scoreGuess("eerie", "chose")).toEqual(["absent", "absent", "absent", "absent", "correct"]);
    // answer has TWO 'e's, both matched exactly, so the middle 'e' gets nothing; the misplaced 'i' is yellow
    expect(scoreGuess("eerie", "elite")).toEqual(["correct", "absent", "absent", "present", "correct"]);
    // answer has two 'b's, guess has three: green + yellow + grey (not three marks)
    expect(scoreGuess("bobby", "abbey")).toEqual(["present", "absent", "correct", "absent", "correct"]);
    // a green later in the word must take priority over an earlier misplaced copy
    expect(scoreGuess("allee", "apple")).toEqual(["correct", "present", "absent", "absent", "correct"]);
  });
  it("keyboard never downgrades a letter", () => {
    let k = mergeKeys({}, "crane", ["correct", "absent", "absent", "absent", "absent"]);
    k = mergeKeys(k, "cooks", ["absent", "absent", "absent", "absent", "absent"]);
    expect(k.c).toBe("correct");
  });
  it("win / loss", () => {
    expect(statusOf(["crane", "crate"], "crate")).toBe("won");
    expect(statusOf(Array(6).fill("crane"), "crate")).toBe("lost");
    expect(statusOf(["crane"], "crate")).toBe("playing");
  });
  it("answer pool is clean", () => {
    expect(ANSWERS.length).toBeGreaterThan(300);
    expect(ANSWERS.every((w) => /^[a-z]{5}$/.test(w))).toBe(true);
    expect(new Set(ANSWERS).size).toBe(ANSWERS.length);
  });
});

describe("sudoku", () => {
  it("random solved grids are valid", () => {
    for (let s = 1; s <= 5; s++) { const g = randomSolved(mulberry32(s)); expect(isSolved(g)).toBe(true); }
  });
  for (const d of ["easy", "medium", "hard"] as const) {
    it(`${d}: puzzle has exactly one solution, equal to the stored one, with the right clue count`, () => {
      for (let s = 1; s <= 3; s++) {
        const t0 = Date.now();
        const { puzzle, solution, givens } = makePuzzle(d, mulberry32(s * 7));
        expect(countSolutions(puzzle, 2)).toBe(1);
        expect(solve(puzzle)).toEqual(solution);
        puzzle.forEach((v, i) => { if (v) expect(v).toBe(solution[i]); expect(givens[i]).toBe(v !== 0); });
        expect(puzzle.filter(Boolean).length).toBeLessThanOrEqual(CLUES[d] + 2);
        expect(Date.now() - t0).toBeLessThan(4000);
      }
    });
  }
  it("finds row, column and box conflicts, and nothing in a clean grid", () => {
    const g = Array(81).fill(0);
    g[0] = 5; g[8] = 5;  expect([...findConflicts(g)].sort()).toEqual([0, 8]);               // row
    const c = Array(81).fill(0); c[0] = 3; c[72] = 3; expect(findConflicts(c).size).toBe(2); // column
    const b = Array(81).fill(0); b[0] = 7; b[10] = 7; expect(findConflicts(b).size).toBe(2); // box
    expect(findConflicts(randomSolved(mulberry32(5))).size).toBe(0);
  });
  it("a filled grid with a wrong digit is not solved; candidates respect the rules", () => {
    const g = randomSolved(mulberry32(11)); const bad = g.slice(); bad[0] = bad[0] === 9 ? 1 : bad[0] + 1;
    expect(isSolved(bad)).toBe(false);
    const p = makePuzzle("easy", mulberry32(2)); const i = p.puzzle.findIndex((v) => v === 0);
    expect(candidates(p.puzzle, i)).toContain(p.solution[i]);
  });
  it("rejects boards whose clues already clash", () => {
    const g = Array(81).fill(0); g[0] = 1; g[1] = 1;
    expect(countSolutions(g)).toBe(0);
  });
});
