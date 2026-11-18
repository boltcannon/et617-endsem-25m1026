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

// Feedback AI may only add ONE warm sentence with no maths and no verdict.
// All numbers, comparisons and the verdict come from the app's fixed text.
export function validateFeedback(text: string): boolean {
  const t = text.trim();
  if (t.length < 15 || t.length > 160) return false;
  if (/\d|[$€£%₹]/.test(t)) return false; // no numbers or currency at all
  if ((t.match(/[.!?]/g) ?? []).length > 1) return false; // single sentence
  if (/\b(correct|right|wrong|incorrect|great job|well done|perfect|yes|no|stupid|dumb|fail|failed|bad at|more than|less than|higher|lower)\b/i.test(t)) return false;
  return true;
}
