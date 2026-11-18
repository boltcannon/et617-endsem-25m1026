import { test } from "node:test";
import assert from "node:assert/strict";
import { rng, nextQuestion, grade, decide, newState, classifyExplanation, type Attempt } from "../lib/engine.ts";

const att = (o: Partial<Attempt>): Attempt => ({ kind: "profit_pct", format: "mcq", level: 2, correct: true, tag: null, hintUsed: false, unsure: false, ...o });

test("golden: profit MCQ has exactly one correct option and an M1 distractor", () => {
  for (let s = 1; s <= 200; s++) {
    const r = rng(s);
    const q = nextQuestion(newState(2), r, "profit_mcq");
    assert.equal(q.options!.filter((o) => o.correct).length, 1);
    assert.equal(q.options!.filter((o) => o.tag === "M1").length, 1);
    assert.equal(new Set(q.options!.map((o) => o.text)).size, 4);
  }
});

test("golden: CP 500, SP 625 -> correct 25%, M1 wrong value 20%", () => {
  // search seeds until the golden numbers appear
  for (let s = 1; s < 5000; s++) {
    const q = nextQuestion(newState(2), rng(s), "profit_mcq");
    if (q.facts[0] === 500 && q.facts[1] === 625) {
      const texts = q.options!.map((o) => o.text);
      assert.ok(texts.includes("25%") && texts.includes("20%"));
      assert.equal(grade(q, q.options!.find((o) => o.text === "20%")!.id).tag, "M1");
      assert.equal(grade(q, q.options!.find((o) => o.text === "25%")!.id).correct, true);
      return;
    }
  }
  assert.fail("golden numbers not generated");
});

test("successive: 20% then 10% on 1000 = 720, additive answer 700 is tagged M2", () => {
  for (let s = 1; s < 5000; s++) {
    const q = nextQuestion(newState(3), rng(s), "succ_num");
    if (q.facts[0] === 1000 && q.facts[1] === 20 && q.facts[2] === 10) {
      assert.equal(q.answer, 720);
      assert.deepEqual(grade(q, "720"), { correct: true, tag: null, note: "" });
      assert.equal(grade(q, "₹700").tag, "M2");
      assert.equal(grade(q, "650").tag, null);
      return;
    }
  }
  assert.fail("golden numbers not generated");
});

test("numeric generators give integer-clean answers", () => {
  for (const key of ["pct_of", "discount_sp", "loss_num", "succ_num"]) {
    for (let s = 1; s <= 100; s++) {
      const q = nextQuestion(newState(1), rng(s), key);
      assert.ok(Number.isInteger(q.answer!), `${key} ${s} -> ${q.answer}`);
      assert.equal(grade(q, q.answer!).correct, true);
    }
  }
});

test("spot-the-error: tapping the wrong-base step is correct, other steps are not", () => {
  for (const key of ["spot_M1", "spot_M2"]) {
    const q = nextQuestion(newState(2), rng(7), key);
    assert.equal(grade(q, 1).correct, true);
    assert.equal(grade(q, 0).correct, false);
    assert.equal(grade(q, 2).correct, false);
  }
});

test("decide: two correct without hints -> harder; hint blocks progress", () => {
  let d = decide(newState(1), att({ level: 1 }));
  assert.equal(d.action, "continue");
  d = decide(d.state, att({ level: 1 }));
  assert.equal(d.action, "harder");
  assert.equal(d.state.level, 2);
  const h = decide(newState(1), att({ hintUsed: true }));
  assert.equal(h.state.streak, 0);
});

test("decide: misconception tag -> alt_explain with target and no level change", () => {
  const d = decide(newState(2), att({ correct: false, tag: "M1" }));
  assert.equal(d.action, "alt_explain");
  assert.equal(d.state.target, "M1");
  assert.equal(d.state.level, 2);
  assert.equal(d.state.hits.M1, 1);
});

test("decide: unrecognised wrong twice, or unsure+wrong -> prereq and level drops", () => {
  let d = decide(newState(2), att({ correct: false, tag: null }));
  assert.equal(d.action, "continue");
  d = decide(d.state, att({ correct: false, tag: null }));
  assert.equal(d.action, "prereq");
  assert.equal(d.state.level, 1);
  const u = decide(newState(1), att({ correct: false, tag: null, unsure: true }));
  assert.equal(u.action, "prereq");
  assert.equal(u.state.level, 0);
});

test("nextQuestion honours the misconception target", () => {
  const s = { ...newState(2), target: "M2" as const };
  for (let i = 1; i < 30; i++) {
    const q = nextQuestion(s, rng(i));
    assert.ok(q.kind === "successive" || (q.kind === "spot_error" && q.trap === "M2"));
  }
});

test("classifyExplanation", () => {
  assert.equal(classifyExplanation("The second 10% is on the reduced price, not on 1000"), "correct");
  assert.equal(classifyExplanation("Yes, 20 and 10 add up to 30"), "M2");
  assert.equal(classifyExplanation("hmm"), "unclear");
});

test("guided help: three wrong answers in a row (untagged) -> guided, level drops, count resets", () => {
  let d = decide(newState(2), att({ correct: false, tag: null }));
  assert.equal(d.action, "continue");
  d = decide(d.state, att({ correct: false, tag: null }));
  assert.equal(d.action, "prereq"); // existing rule still fires on the 2nd untagged wrong
  assert.equal(d.state.level, 1);
  d = decide(d.state, att({ correct: false, tag: null }));
  assert.equal(d.action, "guided");
  assert.equal(d.state.level, 0);
  assert.equal(d.state.wrongRun, 0);
});

test("guided help: a correct answer in between resets the count", () => {
  let d = decide(newState(2), att({ correct: false, tag: null }));
  d = decide(d.state, att({ correct: true }));
  d = decide(d.state, att({ correct: false, tag: null }));
  d = decide(d.state, att({ correct: false, tag: null }));
  assert.notEqual(d.action, "guided");
});

test("guided help: three tagged M1 mistakes -> guided and the misconception stays targeted", () => {
  let d = decide(newState(2), att({ correct: false, tag: "M1" }));
  assert.equal(d.action, "alt_explain");
  d = decide(d.state, att({ correct: false, tag: "M1" }));
  d = decide(d.state, att({ correct: false, tag: "M1" }));
  assert.equal(d.action, "guided");
  assert.equal(d.state.target, "M1");
  assert.equal(d.state.level, 1);
});

test("every question type has a step-by-step walkthrough ending in the answer", () => {
  for (const key of ["pct_of", "discount_sp", "profit_mcq", "loss_num", "succ_mcq", "succ_num", "spot_M1", "spot_M2"]) {
    for (let sd = 1; sd <= 30; sd++) {
      const q = nextQuestion(newState(2), rng(sd), key);
      assert.ok(q.walk && q.walk.length >= 4, `${key} has a walkthrough`);
      assert.ok(q.walk.every((w) => w.length > 8), `${key} steps are non-empty`);
    }
  }
  const q = nextQuestion(newState(2), rng(5), "loss_num");
  assert.ok(q.walk![3].includes(`${q.answer}%`));
});
