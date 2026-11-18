# VIVA NOTES — 25M1026 (P4 · T9 · L5 · C4)

## 1. How `decide()` works (`lib/engine.ts`, line ~318)
After every practice answer, `decide(state, attempt)` returns one of four actions:
1. **Harder** — correct with no hint, and `streak >= 2` (two in a row) while `level < 3` → `level + 1`, streak reset. (At level 3 it just continues.)
2. **Alternative explanation** — wrong and the answer is tagged `M1` (profit ÷ selling price) or `M2` (discounts added) → `target` set, `hits[tag]++`, level unchanged; app shows the remedy screen, then a same-idea question.
3. **Prerequisite** — wrong with no tag and `unrecognised >= 2`, **or** wrong and the learner tapped "Not sure" → `level - 1` (minimum 0), app shows "Quick rebuild: x% of a number".
4. **Continue** — correct but a hint was used (streak reset to 0, no level change), or a first untagged wrong answer.
5. **Guided help (viva branch)** — three wrong answers in a row (`wrongRun >= WRONG_RUN_LIMIT`, any kind of wrong; a correct answer resets it) → action `guided`: level − 1 (unless the basics rebuild already lowered it), then a screen that reveals the missed question's `walk` steps one by one, then an easier question. Wrapper `decide()` in `lib/engine.ts` sits on top of `decideCore()`; screen is `screen === "guided"` in `app/page.tsx`.
Start level comes from the 2-question warm-up: `newState(c)` where `c` = number correct (0, 1 or 2) (`app/page.tsx` ~166). Correct answers always come from code, never the AI.

## 2. Likely live changes: where to edit
| Change | Files and place |
|---|---|
| **Add a question format** | `lib/engine.ts`: add to `Format` type (line 6), write a generator, add a key in `build()` (~258) and `KIND_BY_LEVEL` (~251), handle it in `grade()` (~297). `app/page.tsx`: add a render branch next to the `mcq` / `spot` / `numeric` blocks (~256–270). |
| **Change the level-up threshold** | `lib/engine.ts` `decide()`: change `s.streak >= 2` (two places, ~329 and ~333). Update the reason text and the test in `test/engine.test.ts`. |
| **Change the language of the text** | `app/page.tsx`: all screen text, `MIS_TEXT` (~22), `EXPLAIN_Q` (~26), `CANNED` (~27), remedy and concept JSX. `lib/engine.ts`: `stem` / `ask` / `hint` / `model` / `note` strings and the `decide()` reasons. `app/api/ai/route.ts` (~62): prompt says "Class 8 student in Maharashtra", English. `lib/validate.ts`: verdict-word list is English. Keep digits and ₹ unchanged. |
| **Add a fourth misconception (M3)** | `lib/engine.ts`: `Tag` and `Target` types (lines 7–8), `hits` in `TutorState` and `newState` (~38, 44), a generator with a distractor tagged `M3`, the `a.tag === "M1" \|\| "M2"` check in `decide()`, and target routing in `nextQuestion()` (~271). `app/page.tsx`: `MIS_TEXT`, a remedy JSX block, the summary "ideas" list, and the warm-up `hits` init (~166). Add a test. |
| **Change session length** | `app/page.tsx`: `PRACTICE_COUNT = 4` (line 10), `SESSION_MIN = 10` (line 9, display text), "Warm-up n of 2" (~247) and the warm-up `qn === 0` logic (~160). Home text "About 10 minutes". Progress bar uses `step` / 5. |

## 3. Quick facts
- Tests: `npm test` (13). Type check: `npx tsc --noEmit`. Build: `npx next build`.
- Deploy: push to `main` (Vercel is connected) or `npx vercel deploy --prod --yes`.
- Viva changes go on a **`viva` branch**, not `main`: `git switch -c viva`.
- AI key lives only in Vercel env var `GROQ_API_KEY`; model list in `app/api/ai/route.ts` (`openai/gpt-oss-20b` works for this key).
- C4 evidence: step tracker + "no rush" timer, "Stop for now", localStorage autosave (`KEY` in `app/page.tsx`), "Continue where I left off".
