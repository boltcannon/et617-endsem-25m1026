// Deterministic tutor engine for Percentages (discount, profit, loss) - Class 8.
// All numbers, answers, misconception tags and adaptive decisions come from this file.
// The LLM (see app/api/ai/route.ts) only words stories and feedback; it never grades.

export type Kind = "pct_of" | "discount_sp" | "profit_pct" | "loss_pct" | "successive" | "spot_error";
export type Format = "mcq" | "numeric" | "spot";
export type Tag = "M1" | "M2" | "slip" | null;
export type Target = "M1" | "M2" | null;

export interface Option { id: string; text: string; tag: Tag; correct: boolean; note?: string }
export interface Step { text: string; wrong: boolean; note: string }
export interface Question {
  id: string;
  kind: Kind;
  format: Format;
  level: number; // 0 prerequisite, 1 easy, 2 medium, 3 harder
  stem: string; // story / setup (the part an LLM may reword)
  ask: string; // the actual question sentence (always template text)
  facts: number[]; // the only numbers a reworded story may contain
  options?: Option[];
  steps?: Step[];
  answer?: number;
  wrongValues?: { value: number; tag: Tag; note: string }[];
  unit: "₹" | "%" | "";
  hint: string;
  helperBase?: number; // base used by the "10% / 1%" helper strip
  model: string; // model answer
  trap?: Target; // which misconception this item is built to expose
  noAI?: boolean;
  walk?: string[]; // short step-by-step walkthrough, used for guided help after 3 wrong answers in a row
}

export interface Attempt { kind: Kind; format: Format; level: number; correct: boolean; tag: Tag; hintUsed: boolean; unsure: boolean }
export interface TutorState {
  level: number;
  streak: number;
  unrecognised: number;
  target: Target;
  hits: { M1: number; M2: number };
  wrongRun?: number; // consecutive wrong answers in practice
  history: Attempt[];
}
export type Action = "harder" | "alt_explain" | "prereq" | "guided" | "continue";
export interface Decision { action: Action; reason: string; state: TutorState }

export const newState = (level = 1): TutorState => ({ level, streak: 0, unrecognised: 0, target: null, hits: { M1: 0, M2: 0 }, history: [] });

// ---------- helpers ----------
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick<T>(r: () => number, a: T[]): T { return a[Math.floor(r() * a.length)]; }
function shuffle<T>(r: () => number, a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}
export const r1 = (x: number) => Math.round(x * 10) / 10;
const isInt = (x: number) => Math.abs(x - Math.round(x)) < 1e-9;
const NAMES = ["Meena", "Sameer", "Asha", "Rohan", "Neha", "Imran"];
const ITEMS = ["a school bag", "a pair of sandals", "a steel water bottle", "a cricket bat", "a kurta", "a set of notebooks"];
let uid = 0;
const nid = () => `q${Date.now().toString(36)}${(uid++).toString(36)}`;

// ---------- generators ----------
function genPctOf(r: () => number): Question {
  for (;;) {
    const x = pick(r, [5, 10, 15, 20, 25, 50]);
    const y = pick(r, [40, 60, 80, 120, 160, 200, 300]);
    const a = (x * y) / 100;
    if (!isInt(a)) continue;
    return {
      id: nid(), kind: "pct_of", format: "numeric", level: 0, unit: "₹", answer: a,
      stem: `A shopkeeper has a pencil box that costs ₹${y}.`,
      ask: `What is ${x}% of ₹${y}?`,
      facts: [y],
      hint: `Start small: 10% of ${y} is ${y / 10}, and 1% is ${y / 100}. Now build up to ${x}%.`,
      helperBase: y,
      model: `${x}% of ₹${y} = ${x}/100 × ${y} = ₹${a}.`,
      walk: [`Find 10% of ₹${y}: ${y} ÷ 10 = ${y / 10}.`, `Find 1% of ₹${y}: ${y} ÷ 100 = ${y / 100}.`, `Build ${x}% from those pieces.`, `So ${x}% of ₹${y} = ₹${a}.`],
      wrongValues: [],
    };
  }
}

function genDiscountSP(r: () => number): Question {
  for (;;) {
    const mp = pick(r, [300, 400, 500, 600, 800, 1000, 1200]);
    const d = pick(r, [10, 20, 25, 30, 40]);
    const disc = (mp * d) / 100;
    if (!isInt(disc)) continue;
    const sp = mp - disc;
    const item = pick(r, ITEMS);
    return {
      id: nid(), kind: "discount_sp", format: "numeric", level: 1, unit: "₹", answer: sp,
      stem: `At a shop in Pune, ${item} has a marked price of ₹${mp}. The shopkeeper gives ${d}% discount.`,
      ask: `How much will you pay?`,
      facts: [mp, d],
      hint: `Percent of what? The discount is a percent of the marked price. 10% of ${mp} is ${mp / 10}.`,
      helperBase: mp,
      model: `Discount = ${d}% of ${mp} = ₹${disc}. You pay ${mp} − ${disc} = ₹${sp}.`,
      walk: [`The discount is a percent of the marked price, ₹${mp}.`, `Discount = ${d}% of ${mp} = ₹${disc}.`, `You pay the marked price minus the discount: ${mp} − ${disc}.`, `So you pay ₹${sp}.`],
      wrongValues: [{ value: disc, tag: "slip", note: `That ₹${disc} is the discount, the money you save. The question asks what you pay.` }],
    };
  }
}

function profitParams(r: () => number) {
  for (;;) {
    const cp = pick(r, [200, 250, 400, 500, 800, 1000]);
    const p = pick(r, [10, 20, 25, 40, 50]);
    const profit = (cp * p) / 100;
    if (!isInt(profit)) continue;
    return { cp, p, profit, sp: cp + profit };
  }
}

function genProfitMCQ(r: () => number): Question {
  const { cp, p, profit, sp } = profitParams(r);
  const wrongM1 = r1((profit / sp) * 100);
  const texts = [`${p}%`, `${wrongM1}%`, `₹${profit}`, `${100 + p}%`];
  if (new Set(texts).size < 4) return genProfitMCQ(r);
  const opts: Option[] = [
    { id: "x", text: texts[0], tag: null, correct: true },
    { id: "x", text: texts[1], tag: "M1", correct: false },
    { id: "x", text: texts[2], tag: "slip", correct: false, note: `₹${profit} is the profit in rupees. The question asks for percent.` },
    { id: "x", text: texts[3], tag: "slip", correct: false, note: `${100 + p}% is SP as a percent of CP. Profit is only the extra part.` },
  ];
  const ids = ["a", "b", "c", "d"];
  const shuffled = shuffle(r, opts).map((o, i) => ({ ...o, id: ids[i] }));
  const name = pick(r, NAMES);
  return {
    id: nid(), kind: "profit_pct", format: "mcq", level: 2, unit: "%", trap: "M1",
    stem: `${name} buys a set of notebooks for ₹${cp} and sells it for ₹${sp}.`,
    ask: `What is the profit percent?`,
    facts: [cp, sp], options: shuffled,
    hint: `First find the profit in rupees (SP − CP). Then ask: profit is a percent of which price, the one paid or the one sold at?`,
    helperBase: cp,
    model: `Profit = ${sp} − ${cp} = ₹${profit}. Profit % = profit ÷ CP × 100 = ${profit}/${cp} × 100 = ${p}%.`,
    walk: [`Profit = SP − CP = ${sp} − ${cp} = ₹${profit}.`, `Profit is a percent of which price? The cost price ₹${cp}, the money that was paid.`, `Profit % = ${profit} ÷ ${cp} × 100.`, `So the profit is ${p}%.`],
  };
}

function genLossNumeric(r: () => number): Question {
  for (;;) {
    const cp = pick(r, [200, 400, 500, 800, 1000, 1200]);
    const l = pick(r, [10, 20, 25]);
    const loss = (cp * l) / 100;
    if (!isInt(loss)) continue;
    const sp = cp - loss;
    const wrongM1 = r1((loss / sp) * 100);
    const name = pick(r, NAMES);
    return {
      id: nid(), kind: "loss_pct", format: "numeric", level: 3, unit: "%", answer: l, trap: "M1",
      stem: `${name} bought a second-hand bicycle for ₹${cp} and sold it for ₹${sp}.`,
      ask: `What is the loss percent?`,
      facts: [cp, sp],
      hint: `Loss = CP − SP. Loss percent is a percent of the price ${name} originally paid.`,
      helperBase: cp,
      model: `Loss = ${cp} − ${sp} = ₹${loss}. Loss % = loss ÷ CP × 100 = ${loss}/${cp} × 100 = ${l}%.`,
      walk: [`Loss = CP − SP = ${cp} − ${sp} = ₹${loss}.`, `Loss is a percent of the cost price, ₹${cp}.`, `Loss % = ${loss} ÷ ${cp} × 100.`, `So the loss is ${l}%.`],
      wrongValues: [
        { value: wrongM1, tag: "M1", note: "" },
        { value: loss, tag: "slip", note: `₹${loss} is the loss in rupees. The question asks for percent.` },
      ],
    };
  }
}

function successiveParams(r: () => number) {
  for (;;) {
    const mp = pick(r, [400, 500, 600, 800, 1000, 2000]);
    const d1 = pick(r, [10, 20, 25, 30]);
    const d2 = pick(r, [5, 10, 20]);
    const a = (mp * (100 - d1)) / 100;
    const fin = (mp * (100 - d1) * (100 - d2)) / 10000;
    const wrong = (mp * (100 - d1 - d2)) / 100;
    if (!isInt(a) || !isInt(fin) || !isInt(wrong) || d1 === d2) continue;
    return { mp, d1, d2, a, b: a - fin, fin, wrong };
  }
}

function genSuccessive(r: () => number, format: "mcq" | "numeric"): Question {
  const { mp, d1, d2, a, b, fin, wrong } = successiveParams(r);
  const texts = [`₹${fin}`, `₹${wrong}`, `₹${a}`, `₹${(mp * (d1 + d2)) / 100}`];
  const base: Question = {
    id: nid(), kind: "successive", format, level: format === "mcq" ? 2 : 3, unit: "₹", trap: "M2",
    stem: `A kurta in Pune is marked at ₹${mp}. First, a ${d1}% festival discount is given. Then a further ${d2}% discount is given at the counter for paying by UPI.`,
    ask: `What is the final price?`,
    facts: [mp, d1, d2],
    hint: `After the first discount the price is no longer ₹${mp}. The second ${d2}% is a percent of which price?`,
    helperBase: a,
    model: `After ${d1}% off: ₹${a}. The second ${d2}% is taken off ₹${a} (not ₹${mp}): ${d2}% of ${a} = ₹${b}. Final = ${a} − ${b} = ₹${fin}.`,
    walk: [`After the first ${d1}% off: ₹${mp} becomes ₹${a}.`, `The second ${d2}% is taken from ₹${a}, not from ₹${mp}.`, `${d2}% of ${a} = ₹${b}.`, `Final price = ${a} − ${b} = ₹${fin}.`],
  };
  if (format === "numeric") {
    return { ...base, answer: fin, wrongValues: [
      { value: wrong, tag: "M2", note: "" },
      { value: a, tag: "slip", note: `₹${a} is the price after only the first discount.` },
    ] };
  }
  if (new Set(texts).size < 4) return genSuccessive(r, format);
  const opts: Option[] = [
    { id: "x", text: texts[0], tag: null, correct: true },
    { id: "x", text: texts[1], tag: "M2", correct: false },
    { id: "x", text: texts[2], tag: "slip", correct: false, note: `₹${a} is the price after only the first discount. There is a second one.` },
    { id: "x", text: texts[3], tag: "slip", correct: false, note: `That is the total money taken off, not the price you pay.` },
  ];
  const ids = ["a", "b", "c", "d"];
  return { ...base, options: shuffle(r, opts).map((o, i) => ({ ...o, id: ids[i] })) };
}

function genSpot(r: () => number, which: "M1" | "M2"): Question {
  if (which === "M1") {
    const { cp, profit, sp } = profitParams(r);
    const wrongPct = r1((profit / sp) * 100);
    return {
      id: nid(), kind: "spot_error", format: "spot", level: 2, unit: "", trap: "M1", noAI: true,
      stem: `Aman solved: "Ravi buys a toy for ₹${cp} and sells it for ₹${sp}. Find the profit percent." His answer does not match the book.`,
      ask: `Tap the step where Aman went wrong.`,
      facts: [cp, sp],
      steps: [
        { text: `Profit = SP − CP = ${sp} − ${cp} = ₹${profit}`, wrong: false, note: "This step is fine. The profit amount is right." },
        { text: `Profit % = Profit ÷ SP × 100`, wrong: true, note: "This is it. Profit percent is out of the cost price (what was paid), not the selling price." },
        { text: `= ${profit} ÷ ${sp} × 100 = ${wrongPct}%`, wrong: false, note: "The arithmetic here is fine, but it follows from the step before. Look earlier." },
      ],
      hint: `Check each line: is the percent taken out of the right price?`,
      model: `Step 2 is wrong. It should be Profit ÷ CP × 100 = ${profit} ÷ ${cp} × 100 = ${r1((profit / cp) * 100)}%.`,
      walk: [`Read each step slowly and ask: is the percent out of the right price?`, `Step 1 finds the profit, ₹${profit}. That part is fine.`, `Step 2 divides by the selling price. Profit % must be out of the cost price, ₹${cp}.`, `So step 2 is the wrong one.`],
      answer: 1,
    };
  }
  const { mp, d1, d2, a, wrong } = successiveParams(r);
  const aOff = mp - a;
  const bWrong = (mp * d2) / 100;
  return {
    id: nid(), kind: "spot_error", format: "spot", level: 3, unit: "", trap: "M2", noAI: true,
    stem: `Neha solved: "A jacket marked ₹${mp} gets ${d1}% off, then a further ${d2}% off. Find the final price." Her answer does not match the book.`,
    ask: `Tap the step where Neha went wrong.`,
    facts: [mp, d1, d2],
    steps: [
      { text: `First discount = ${d1}% of ${mp} = ₹${aOff}`, wrong: false, note: "This step is fine." },
      { text: `Second discount = ${d2}% of ${mp} = ₹${bWrong}`, wrong: true, note: "This is it. The second discount is taken on the price after the first discount, not on the marked price." },
      { text: `Final price = ${mp} − ${aOff} − ${bWrong} = ₹${wrong}`, wrong: false, note: "The subtraction is fine, but it follows from the step before. Look earlier." },
    ],
    hint: `Check each line: the second discount is a percent of which price?`,
    model: `Step 2 is wrong. After the first discount the price is ₹${a}. ${d2}% of ${a} = ₹${(a * d2) / 100}. Final = ₹${a - (a * d2) / 100}.`,
    walk: [`Read each step slowly and ask: which price is the second discount taken from?`, `Step 1 finds the first discount. That part is fine.`, `Step 2 takes the second discount from ₹${mp}. It should be taken from the new price, ₹${a}.`, `So step 2 is the wrong one.`],
    answer: 1,
  };
}

// ---------- question selection ----------
const KIND_BY_LEVEL: Record<number, string[]> = {
  0: ["pct_of"],
  1: ["discount_sp"],
  2: ["profit_mcq", "succ_mcq", "spot_M1"],
  3: ["loss_num", "succ_num", "spot_M2"],
};

function build(key: string, r: () => number): Question {
  switch (key) {
    case "pct_of": return genPctOf(r);
    case "discount_sp": return genDiscountSP(r);
    case "profit_mcq": return genProfitMCQ(r);
    case "loss_num": return genLossNumeric(r);
    case "succ_mcq": return genSuccessive(r, "mcq");
    case "succ_num": return genSuccessive(r, "numeric");
    case "spot_M1": return genSpot(r, "M1");
    default: return genSpot(r, "M2");
  }
}

export function nextQuestion(state: TutorState, r: () => number, force?: string): Question {
  if (force) return build(force, r);
  const last = state.history[state.history.length - 1];
  let keys: string[];
  if (state.target === "M1") keys = state.level >= 3 ? ["loss_num", "spot_M1", "profit_mcq"] : ["profit_mcq", "spot_M1"];
  else if (state.target === "M2") keys = state.level >= 3 ? ["succ_num", "spot_M2"] : ["succ_mcq", "spot_M2"];
  else keys = KIND_BY_LEVEL[Math.max(0, Math.min(3, state.level))];
  // avoid repeating the exact same item type twice in a row
  const lastKey = last ? `${last.kind}:${last.format}` : "";
  const fresh = keys.filter((k) => {
    const q = build(k, rng(1));
    return `${q.kind}:${q.format}` !== lastKey;
  });
  return build(pick(r, fresh.length ? fresh : keys), r);
}

// ---------- grading (deterministic) ----------
export function parseNum(s: string | number): number | null {
  if (typeof s === "number") return s;
  const t = s.replace(/[₹,%\s]|rs\.?/gi, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export interface Graded { correct: boolean; tag: Tag; note: string }
export function grade(q: Question, input: string | number): Graded {
  if (q.format === "mcq") {
    const o = q.options!.find((x) => x.id === input);
    if (!o) return { correct: false, tag: null, note: "" };
    return { correct: o.correct, tag: o.tag, note: o.note ?? "" };
  }
  if (q.format === "spot") {
    const idx = Number(input);
    const s = q.steps![idx];
    if (!s) return { correct: false, tag: null, note: "" };
    return { correct: s.wrong, tag: null, note: s.note };
  }
  const n = parseNum(input);
  if (n === null) return { correct: false, tag: null, note: "Type a number, like 450." };
  const tol = q.unit === "%" ? 0.06 : 0.001;
  if (Math.abs(n - q.answer!) <= tol) return { correct: true, tag: null, note: "" };
  const w = (q.wrongValues ?? []).find((v) => Math.abs(v.value - n) <= tol);
  return w ? { correct: false, tag: w.tag, note: w.note } : { correct: false, tag: null, note: "" };
}

// ---------- adaptive decision rule ----------
function decideCore(s0: TutorState, a: Attempt): Decision {
  const s: TutorState = { ...s0, hits: { ...s0.hits }, history: [...s0.history, a] };
  if (a.correct) {
    if (a.hintUsed) {
      s.streak = 0;
      if (s.target && ((s.target === "M1" && (a.kind === "profit_pct" || a.kind === "loss_pct" || a.kind === "spot_error")) || (s.target === "M2" && (a.kind === "successive" || a.kind === "spot_error")))) s.target = null;
      return { action: "continue", reason: "Correct, but you used a hint, so we stay at this level.", state: s };
    }
    s.streak += 1;
    s.unrecognised = 0;
    s.target = null;
    if (s.streak >= 2 && s.level < 3) {
      s.level += 1; s.streak = 0;
      return { action: "harder", reason: "Two correct in a row without hints: moving up a level.", state: s };
    }
    if (s.streak >= 2) { s.streak = 0; return { action: "continue", reason: "Two correct in a row at the top level. Keeping variety going.", state: s }; }
    return { action: "continue", reason: "Correct. One more at this level to be sure.", state: s };
  }
  s.streak = 0;
  if (a.tag === "M1" || a.tag === "M2") {
    s.hits[a.tag] += 1;
    s.target = a.tag;
    s.unrecognised = 0;
    return { action: "alt_explain", reason: a.tag === "M1" ? "Your answer matches taking the percent out of the wrong price (selling price instead of cost price). A different explanation comes next." : "Your answer matches taking both discounts off the original price. A different explanation comes next.", state: s };
  }
  s.unrecognised += 1;
  if (s.unrecognised >= 2 || a.unsure) {
    s.unrecognised = 0;
    s.level = Math.max(0, s.level - 1);
    s.target = null;
    return { action: "prereq", reason: a.unsure ? "You said you were not sure and it did not work out, so let us rebuild the basics first." : "Two answers in a row we could not link to one idea, so let us rebuild the basics first.", state: s };
  }
  return { action: "continue", reason: "Not yet. Let us try another one like it.", state: s };
}

// Three wrong answers in a row (of any kind) -> guided, step-by-step help on the question just missed.
// Any correct answer resets the count. The wrong-answer count is only used by the tutor and is never shown to the learner.
export const WRONG_RUN_LIMIT = 3;
export function decide(s0: TutorState, a: Attempt): Decision {
  const d = decideCore(s0, a);
  const run = a.correct ? 0 : (s0.wrongRun ?? 0) + 1;
  const s: TutorState = { ...d.state, wrongRun: run };
  if (run >= WRONG_RUN_LIMIT) {
    s.wrongRun = 0;
    s.streak = 0;
    if (d.action !== "prereq") s.level = Math.max(0, s.level - 1);
    return { action: "guided", reason: "Three answers in a row did not work out. That is okay. Let us solve one together, step by step.", state: s };
  }
  return { ...d, state: s };
}

// ---------- explanation check (deterministic first) ----------
export type ExplainLabel = "correct" | "M2" | "unclear";
export function classifyExplanation(text: string): ExplainLabel {
  const t = text.toLowerCase().trim();
  if (t.split(/\s+/).filter(Boolean).length < 3) return "unclear";
  const base = /(after|reduced|new price|lower price|smaller|already|discounted|left|remaining|less than|800|\b80\b|not (the )?(original|1000|marked))/;
  if (base.test(t)) return "correct";
  if (/(yes|right|same|add|total|combined|together|30|equal)/.test(t)) return "M2";
  return "unclear";
}
