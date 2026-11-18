// Output checks run on every AI response BEFORE the learner sees it.
const numbersIn = (s: string) => (s.match(/\d[\d,]*\.?\d*/g) ?? []).map((x) => Number(x.replace(/,/g, "")));

export function validateStory(text: string, facts: number[]): boolean {
  if (text.length < 20 || text.length > 300) return false;
  if (/[?=]/.test(text)) return false; // no question, no working
  const found = numbersIn(text);
  if (found.some((n) => !facts.includes(n))) return false; // no invented numbers
  if (!facts.every((f) => found.includes(f))) return false; // every given number present
  return true;
}

export function validateFeedback(text: string, allowed: number[]): boolean {
  if (text.length < 15 || text.length > 320) return false;
  if (numbersIn(text).some((n) => !allowed.includes(n))) return false;
  if (/\b(stupid|dumb|wrong|fail|failed|bad at)\b/i.test(text)) return false;
  return true;
}
