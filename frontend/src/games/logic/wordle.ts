export type Mark = "correct" | "present" | "absent";
export const WORD_LEN = 5;
export const MAX_TRIES = 6;

export const isWellFormed = (g: string) => /^[a-z]{5}$/.test(g);

/**
 * Two-pass scoring so repeated letters are handled correctly:
 *   answer "ABBEY", guess "BOBBY" -> only as many yellows/greens as there are real copies of the letter.
 */
export function scoreGuess(guess: string, answer: string): Mark[] {
  const g = guess.toLowerCase(), a = answer.toLowerCase();
  const marks: Mark[] = Array(g.length).fill("absent");
  const left: Record<string, number> = {};
  for (let i = 0; i < a.length; i++) {
    if (g[i] === a[i]) marks[i] = "correct";
    else left[a[i]] = (left[a[i]] ?? 0) + 1;      // letters of the answer not yet matched exactly
  }
  for (let i = 0; i < g.length; i++) {
    if (marks[i] === "correct") continue;
    if ((left[g[i]] ?? 0) > 0) { marks[i] = "present"; left[g[i]]--; }
  }
  return marks;
}

const RANK: Record<Mark, number> = { absent: 0, present: 1, correct: 2 };

/** Keyboard colours only ever improve: a letter that was green stays green. */
export function mergeKeys(prev: Record<string, Mark>, guess: string, marks: Mark[]): Record<string, Mark> {
  const next = { ...prev };
  [...guess.toLowerCase()].forEach((ch, i) => {
    if (!next[ch] || RANK[marks[i]] > RANK[next[ch]]) next[ch] = marks[i];
  });
  return next;
}

export type Status = "playing" | "won" | "lost";
export const statusOf = (guesses: string[], answer: string): Status =>
  guesses.includes(answer.toLowerCase()) ? "won" : guesses.length >= MAX_TRIES ? "lost" : "playing";
