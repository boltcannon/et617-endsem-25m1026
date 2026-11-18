# DESIGN.md — ET 617 End-Sem · Roll 25M1026

**Card:** P4 Adaptive tutor with automatic question generation · T9 Percentages: discount, profit and loss (Class 8) · L5 Learner repeating the topic after failing once (high anxiety, low self-efficacy) · C4 10-minute sessions

## 1. Problem (D1 draft)
Class 8 learners who have already failed a percentages test tend to freeze at word problems on discount, profit and loss. They do not lack arithmetic so much as a stable idea of *which quantity the percentage is of*. Repeating the same textbook exercises and seeing a red score confirms "I am bad at maths". We need a short, low-stakes tutor that finds *which* wrong idea the learner holds, shows why it fails, and gives the next task at the right level — in sessions short enough to fit a tired evening.

**Outcomes (measurable):**
1. Calculate discount, selling price, profit and loss % correctly, choosing the right base (marked price or cost price), on 3 unseen problems.
2. Explain in one or two sentences why two successive discounts (20% then 10%) are not the same as 30% off.
3. Identify and correct the wrong step in a worked solution that uses the wrong base.

**Context of use:** at home in the evening, on a phone, in one 10-minute sitting; may stop and resume the next day.

## 2. Persona (D2 draft)
**Kavya Deshmukh, 13, Class 8**, Pune, government school, English-medium textbook but speaks Marathi at home. Scored 9/30 on the percentages unit test; retaking in 3 weeks. Uses her mother's phone after dinner for ~10 minutes. Can do "x% of y" for round numbers (10%, 50%) and knows percent means "per hundred", but panics when a shop-story has two prices. Motivation: does not want to fail again; wants to feel she *can* do it. Language: plain, short English; Marathi words for shops (dukaan, sale) are fine.

**Two likely misconceptions**
- **M1 – Wrong base for profit/loss:** "Profit % = profit ÷ *selling price* × 100" (uses SP instead of CP).
- **M2 – Successive discounts add:** "20% off then 10% off = 30% off" (both taken off the original price).

## 3. Content plan (D3 draft)
- Concept card: "Percent of *what*?" — the base question. CP is the base for profit/loss; MP (marked price) is the base for discount. Worked example with ₹500 shirt.
- Task formats (≥2; planned 4): (a) MCQ with distractors mapped to M1/M2; (b) numeric answer; (c) spot-the-wrong-step in a worked solution; (d) short explanation ("why not 30%?") checked by the tutor.
- Question *generation*: engine picks template + level + numbers; code computes the right answer and the misconception-distractors; the LLM only wraps the numbers in a short Indian-context story and writes the feedback wording. Output is validated (every number in story must match; no new numbers) and falls back to a template string when it fails.
- Feedback written for: correct answer, M1, M2, and "not sure" (prerequisite gap).

## 4. Adaptive rule (design challenge)
After each task the tutor records: correct?, misconception tag (from which distractor/wrong value), hints used, confidence tap (sure / not sure).
- **Harder question** — 2 correct in a row at the current level without a hint → level +1 (or move from MCQ to a numeric/explain task).
- **Alternative explanation** — a wrong answer that matches a known misconception tag → show a *different representation* (bar/contrast worked example) targeting that misconception, then a same-level question.
- **Prerequisite instruction** — wrong with no recognised tag twice, or "not sure" + wrong → drop to prerequisite ("x% of y", percent as fraction of 100), then return.

## 5. Learner L5 + constraint C4 shaping
- Calm tone; "Not yet" instead of "Wrong"; hints are free and never lower anything; no scores or red marks, only "steps understood".
- Optional confidence tap before answer; tutor praises effort and strategy, not "smart".
- C4: sequence = 5 steps (~2 min each): warm-up check → concept → practice (adaptive) → explain → wrap-up. Visible 10-minute progress bar; "Stop for now" saves progress to the browser; "Resume where I left off" on the home screen.

## 6. Screens (≥5)
1. Home / resume · 2. Warm-up diagnostic · 3. Concept card · 4. Practice (adaptive question) · 5. Feedback + alternative explanation · 6. Explain-it · 7. Session summary · 8. About (identity). Footer on every screen: **25M1026**.

## 7. Stack
Next.js (App Router) + TypeScript, deployed on Vercel at et617-25m1026.vercel.app. LLM API key only in Vercel env vars. Deterministic fallbacks if AI call fails.
