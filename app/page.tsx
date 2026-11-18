"use client";
import { useEffect, useRef, useState } from "react";
import {
  Attempt, Question, Tag, Target, TutorState, classifyExplanation, decide, grade, newState, nextQuestion, rng,
} from "../lib/engine";

const ROLL = "25M1026";
const KEY = "et617_25m1026_session_v1";
const SHOP_KEY = "et617_25m1026_shop_v1";
const PRACTICE_COUNT = 4;
const STEP_NAMES = ["Warm-up", "Idea", "Practice", "Explain", "Wrap-up"];

// Effort and strategy badges only. Nothing here counts mistakes or scores correctness.
function earnedBadges(h: Attempt[]): { key: string; name: string; why: string }[] {
  const out: { key: string; name: string; why: string }[] = [];
  if (h.some((a) => a.hintUsed)) out.push({ key: "hint", name: "💡 Smart hint-user", why: "You used help when you needed it." });
  if (h.some((a) => a.unsure)) out.push({ key: "unsure", name: "🤔 Honest thinker", why: "You said when you felt unsure." });
  if (h.some((a, i) => i > 0 && a.correct && !h[i - 1].correct)) out.push({ key: "bounce", name: "🔁 Bounced back", why: "You kept going after a miss." });
  if (h.some((a, i) => i > 0 && a.correct && (h[i - 1].tag === "M1" || h[i - 1].tag === "M2"))) out.push({ key: "base", name: "🎯 Base finder", why: "You picked the right base after a mix-up." });
  out.push({ key: "finisher", name: "🏁 Finisher", why: "You finished all five steps." });
  return out;
}

type Screen = "home" | "q" | "fb" | "concept" | "remedy" | "prereq" | "explain" | "efb" | "summary" | "about";
type QV = Question & { src?: "ai" | "template" };
interface FB { correct: boolean; tag: Tag; note: string; action: string; reason: string; given: string }
interface Saved {
  screen: Screen; from?: Screen; step: number; phase: "warm" | "practice"; qn: number;
  tutor: TutorState; q: QV | null; fb: FB | null; warm: Attempt[];
  elapsed: number; log: string[]; remedy: Target; seed: number;
  explain: { text: string; label: string; canned: string; ai?: string } | null;
}

const MIS_TEXT: Record<"M1" | "M2", string> = {
  M1: "Lots of people take profit out of the selling price. That is a very common mix-up, and it is fixable.",
  M2: "Lots of people add the two discounts. That is a very common mix-up, and it is fixable.",
};
const EXPLAIN_Q = `Ria says: "If a shop gives 20% off and then 10% off on a ₹1000 shirt, it is the same as 30% off." Do you agree? Tell us why in one or two sentences.`;
const CANNED = {
  correct: "Yes, you spotted it. After 20% off, the shirt costs ₹800. The second 10% is taken from ₹800, so it is ₹80, not ₹100. Final price ₹720, a little more than the ₹700 that straight 30% off would give.",
  M2: "Good try, and many people think this. Check it: after 20% off ₹1000 the price is ₹800. Is the second 10% of ₹1000 or of ₹800? Compare ₹720 with ₹700 from straight 30% off.",
  unclear: "Thanks for trying. One hint: after the first discount the price is ₹800. The second 10% is taken from which price?",
};

// ---------- Mascot: Paisa the coin (original artwork) ----------
type Mood = "happy" | "think" | "cheer" | "kind";
function Paisa({ mood = "happy", size = 56 }: { mood?: Mood; size?: number }) {
  return (
    <svg className="paisa" width={size} height={size} viewBox="0 0 92 92" role="img" aria-label={`Paisa the coin, looking ${mood}`}>
      <defs>
        <radialGradient id={`g-${mood}`} cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#ffe08a" /><stop offset="0.6" stopColor="#f6bd2d" /><stop offset="1" stopColor="#e0990e" />
        </radialGradient>
      </defs>
      <circle cx="46" cy="46" r="42" fill={`url(#g-${mood})`} stroke="#b9780a" strokeWidth="4" />
      <circle cx="46" cy="46" r="34" fill="none" stroke="#fff8d6" strokeWidth="2" strokeDasharray="3 4" opacity=".8" />
      <text x="46" y="30" textAnchor="middle" fontSize="19" fontWeight="800" fill="#8a5a00" fontFamily="system-ui, sans-serif">₹</text>
      <circle cx="27" cy="59" r="5.5" fill="#f08a7e" opacity=".55" /><circle cx="65" cy="59" r="5.5" fill="#f08a7e" opacity=".55" />
      {mood === "cheer" ? (
        <>
          <path d="M28 51q6-9 12 0" stroke="#5a3200" strokeWidth="3.2" fill="none" strokeLinecap="round" />
          <path d="M52 51q6-9 12 0" stroke="#5a3200" strokeWidth="3.2" fill="none" strokeLinecap="round" />
          <path d="M34 60q12 15 24 0z" fill="#7a2e10" /><path d="M39 66q7 5 14 0" fill="#f08a7e" />
          <path d="M82 14l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fff3b0" /><path d="M8 20l1.5 3.5 3.5 1.5-3.5 1.5L8 30l-1.5-3.5L3 25l3.5-1.5z" fill="#fff3b0" />
        </>
      ) : mood === "think" ? (
        <>
          <circle cx="34" cy="48" r="5" fill="#3b2300" /><circle cx="58" cy="48" r="5" fill="#3b2300" />
          <circle cx="35.5" cy="46" r="1.8" fill="#fff" /><circle cx="59.5" cy="46" r="1.8" fill="#fff" />
          <path d="M52 37q7-5 13-1" stroke="#5a3200" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <path d="M38 63q8 5 16 0" stroke="#5a3200" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : mood === "kind" ? (
        <>
          <circle cx="34" cy="49" r="4" fill="#3b2300" /><circle cx="58" cy="49" r="4" fill="#3b2300" />
          <path d="M28 41q6-4 12-1M52 40q6-3 12 1" stroke="#5a3200" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <path d="M37 62q9 7 18 0" stroke="#5a3200" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M80 18c-3-5-9-1-5 4l5 5 5-5c4-5-2-9-5-4z" fill="#f08a7e" />
        </>
      ) : (
        <>
          <circle cx="34" cy="49" r="4.5" fill="#3b2300" /><circle cx="58" cy="49" r="4.5" fill="#3b2300" />
          <circle cx="35.6" cy="47.4" r="1.6" fill="#fff" /><circle cx="59.6" cy="47.4" r="1.6" fill="#fff" />
          <path d="M35 61q11 11 22 0" stroke="#5a3200" strokeWidth="3.2" fill="none" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function Coach({ mood, children }: { mood: Mood; children: React.ReactNode }) {
  return (
    <div className="coach">
      <Paisa mood={mood} size={58} />
      <div className="bubble">{children}</div>
    </div>
  );
}

function PriceTag() {
  return (
    <div className="hero" aria-label="Sale tag: 20% off">
      <svg viewBox="0 0 270 150" width="100%" height="auto" role="img" aria-hidden="true">
        <defs><linearGradient id="tg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fdba4d" /><stop offset="1" stopColor="#ea580c" /></linearGradient></defs>
        <path d="M18 16h176l54 59-54 59H18a10 10 0 0 1-10-10V26a10 10 0 0 1 10-10z" fill="url(#tg)" stroke="#c2410c" strokeWidth="3" />
        <circle cx="214" cy="75" r="8" fill="#fdf3e1" stroke="#c2410c" strokeWidth="2.5" />
        <text x="26" y="50" fontSize="22" fontWeight="800" fill="#fff" letterSpacing="4" fontFamily="system-ui, sans-serif">SALE</text>
        <text x="24" y="112" fontSize="58" fontWeight="900" fill="#fff" fontFamily="system-ui, sans-serif">20%</text>
        <text x="160" y="112" fontSize="30" fontWeight="800" fill="#fff7ed" fontFamily="system-ui, sans-serif">off</text>
      </svg>
      <div className="hero-coin"><Paisa mood="cheer" size={74} /></div>
    </div>
  );
}

function Viz({ rows }: { rows: { label: string; v: number; cls?: string }[] }) {
  const max = Math.max(...rows.map((r) => r.v));
  return (
    <div className="viz">
      {rows.map((r) => (
        <div className="r" key={r.label}>
          <div className={`b ${r.cls ?? ""}`} style={{ width: `${Math.max(16, (r.v / max) * 62)}%` }}>₹{r.v}</div>
          <span>{r.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function Page() {
  const [s, setS] = useState<Saved | null>(null);
  const [ready, setReady] = useState(false);
  const [hasSaved, setHasSaved] = useState<Saved | null>(null);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState<string>("");
  const [unsure, setUnsure] = useState(false);
  const [hint, setHint] = useState(false);
  const [text, setText] = useState("");
  const [about, setAbout] = useState(false);
  const [shopCount, setShopCount] = useState(0);
  const [toast, setToast] = useState("");
  const sRef = useRef<Saved | null>(null);
  sRef.current = s;

  // load saved session on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw) as Saved;
        if (p && p.screen !== "summary" && (p.screen !== "home" || p.from)) setHasSaved(p);
      }
    } catch { /* ignore */ }
    try {
      const shop = JSON.parse(localStorage.getItem(SHOP_KEY) || "[]");
      if (Array.isArray(shop)) setShopCount(shop.length);
    } catch { /* ignore */ }
    setReady(true);
  }, []);

  // persist
  useEffect(() => {
    if (!s) return;
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
  }, [s]);

  // save earned badge keys when the summary is shown
  useEffect(() => {
    if (!s || s.screen !== "summary") return;
    try {
      const earned = earnedBadges(s.tutor.history).map((b) => b.key);
      const prev = JSON.parse(localStorage.getItem(SHOP_KEY) || "[]");
      const all = Array.from(new Set([...(Array.isArray(prev) ? prev : []), ...earned]));
      localStorage.setItem(SHOP_KEY, JSON.stringify(all));
      setShopCount(all.length);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s?.screen]);

  // gentle elapsed timer (only while learning)
  useEffect(() => {
    const t = setInterval(() => {
      const cur = sRef.current;
      if (!cur || document.hidden) return;
      if (["home", "summary"].includes(cur.screen)) return;
      setS({ ...cur, elapsed: cur.elapsed + 1 });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // after feedback, bring the answer tiles into view above the sheet
  useEffect(() => {
    if (s?.screen !== "fb") return;
    const t = setTimeout(() => document.querySelector(".opt.good, .step.good")?.scrollIntoView({ block: "center", behavior: "auto" }), 340);
    return () => clearTimeout(t);
  }, [s?.screen, s?.qn]);

  // toast auto-hide
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const resetUI = () => { setPick(""); setUnsure(false); setHint(false); setText(""); };

  async function withStory(q: Question): Promise<QV> {
    if (q.noAI) return { ...q, src: "template" };
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 6500);
      const res = await fetch("/api/ai", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: c.signal,
        body: JSON.stringify({ task: "story", facts: q.facts, stem: q.stem }),
      });
      clearTimeout(t);
      const j = await res.json();
      if (j.ok) return { ...q, stem: j.text, src: "ai" };
    } catch { /* fall through */ }
    return { ...q, src: "template" };
  }

  async function showQuestion(base: Saved, q: Question, patch: Partial<Saved>) {
    setBusy(true);
    const qv = await withStory(q);
    setBusy(false);
    resetUI();
    setS({ ...base, ...patch, q: qv, fb: null, screen: "q" });
  }

  async function start() {
    const seed = Date.now() % 1e9;
    const tutor = newState(1);
    const base: Saved = {
      screen: "q", step: 1, phase: "warm", qn: 0, tutor, q: null, fb: null, warm: [], elapsed: 0, log: [], remedy: null, seed, explain: null,
    };
    setHasSaved(null);
    await showQuestion(base, nextQuestion(tutor, rng(seed), "discount_sp"), {});
  }

  function resume() {
    if (!hasSaved) return;
    resetUI();
    setS({ ...hasSaved, screen: hasSaved.screen === "home" ? hasSaved.from ?? "concept" : hasSaved.screen });
    setHasSaved(null);
  }

  function submit() {
    if (!s || !s.q || (!pick && !text)) return;
    const input = s.q.format === "numeric" ? text : pick;
    const g = grade(s.q, input);
    const a: Attempt = { kind: s.q.kind, format: s.q.format, level: s.q.level, correct: g.correct, tag: g.tag, hintUsed: hint, unsure };
    if (s.phase === "warm") {
      setS({ ...s, screen: "fb", warm: [...s.warm, a], fb: { correct: g.correct, tag: g.tag, note: g.note, action: "warm", reason: "Just a warm-up. This helps me pick where to start for you.", given: String(input) } });
      return;
    }
    const d = decide(s.tutor, a);
    setS({
      ...s, tutor: d.state, screen: "fb", log: [...s.log, `${s.q.kind.replace("_", " ")}: ${g.correct ? "correct" : g.tag === "M1" || g.tag === "M2" ? "idea " + g.tag : "not yet"} → ${d.action.replace("_", " ")}`],
      fb: { correct: g.correct, tag: g.tag, note: g.note, action: d.action, reason: d.reason, given: String(input) },
    });
  }

  async function goNext(cur: Saved) {
    const remedial = cur.fb?.action === "alt_explain" || cur.fb?.action === "prereq";
    // after a remedy on the last slot, give one more question so the fix is checked
    if (cur.qn + 1 >= PRACTICE_COUNT && !(remedial && cur.qn + 1 === PRACTICE_COUNT)) { resetUI(); setS({ ...cur, screen: "explain", step: 4, remedy: null }); return; }
    const q = nextQuestion(cur.tutor, rng(cur.seed + cur.qn * 7 + 13));
    await showQuestion(cur, q, { qn: cur.qn + 1, step: 3, remedy: null });
  }

  async function afterFeedback() {
    if (!s || !s.fb) return;
    if (s.phase === "warm") {
      if (s.qn === 0) {
        await showQuestion(s, nextQuestion(s.tutor, rng(s.seed + 5), "profit_mcq"), { qn: 1 });
        return;
      }
      const c = s.warm.filter((w) => w.correct).length;
      const lastTag = s.warm[1]?.tag;
      const tutor: TutorState = { ...newState(c), target: lastTag === "M1" || lastTag === "M2" ? lastTag : null, hits: { M1: lastTag === "M1" ? 1 : 0, M2: 0 }, history: s.warm };
      resetUI();
      setS({ ...s, tutor, screen: "concept", step: 2, log: [...s.log, `warm-up ${c}/2 → start at level ${c}${tutor.target ? " (watching " + tutor.target + ")" : ""}`] });
      return;
    }
    if (s.fb.action === "alt_explain") { setS({ ...s, screen: "remedy", remedy: s.tutor.target }); return; }
    if (s.fb.action === "prereq") { setS({ ...s, screen: "prereq" }); return; }
    await goNext(s);
  }

  async function startPractice() {
    if (!s) return;
    const q = nextQuestion(s.tutor, rng(s.seed + 99));
    await showQuestion(s, q, { phase: "practice", qn: 0, step: 3 });
  }

  async function submitExplain() {
    if (!s || text.trim().length < 2) return;
    const label = classifyExplanation(text);
    const canned = CANNED[label];
    setBusy(true);
    let ai: string | undefined;
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 7000);
      const res = await fetch("/api/ai", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: c.signal,
        body: JSON.stringify({ task: "feedback", label, learnerText: text, canned }),
      });
      clearTimeout(t);
      const j = await res.json();
      if (j.ok) ai = j.text;
    } catch { /* fall back to canned */ }
    setBusy(false);
    const tutor = label === "M2" ? { ...s.tutor, hits: { ...s.tutor.hits, M2: s.tutor.hits.M2 + 1 } } : s.tutor;
    setS({ ...s, tutor, screen: "efb", explain: { text, label, canned, ai }, log: [...s.log, `explanation: ${label}`] });
  }

  const stopNow = () => { resetUI(); setS(s ? { ...s, from: s.screen, screen: "home" } : null); setHasSaved(null); setToast("Saved. Come back anytime."); };
  const mins = s ? Math.floor(s.elapsed / 60) : 0;
  const secs = s ? String(s.elapsed % 60).padStart(2, "0") : "00";

  if (!ready) return <div className="stage"><div className="app" /></div>;

  let body: React.ReactNode = null;
  let dock: React.ReactNode = null;
  let sheet: React.ReactNode = null;

  // ---------- HOME ----------
  if (!s || s.screen === "home") {
    const saved = hasSaved ?? (s && s.screen === "home" ? s : null);
    body = (
      <>
        <PriceTag />
        <h1>Percent, step by step</h1>
        <p>Hi, I am Paisa! This is a short, calm practice on <b>discount, profit and loss</b>. About 10 minutes. No marks, no red crosses. Mistakes just help me show you a better way.</p>
        <div className="box"><b>5 small steps:</b> warm-up · idea · practice · explain · wrap-up</div>
        {shopCount > 0 && <p><span className="pill-inline">🛍️ Your shop so far: {shopCount} badge{shopCount === 1 ? "" : "s"}</span></p>}
        {saved && (
          <div className="card">
            <b>You left off at step {saved.step} of 5.</b>
            <p className="muted">Time so far: {Math.floor(saved.elapsed / 60)} min.</p>
            <button className="btn" onClick={() => { if (s && s.screen === "home") { resetUI(); setS({ ...s, screen: s.from ?? "concept" }); } else resume(); }}>Continue where I left off</button>
            <button className="btn ghost" onClick={start}>Start a fresh session</button>
          </div>
        )}
      </>
    );
    if (!saved) dock = <button className="btn" onClick={start} disabled={busy}>{busy ? "Getting ready…" : "Start my 10 minutes"}</button>;
  }

  // ---------- QUESTION ----------
  else if ((s.screen === "q" || s.screen === "fb") && s.q) {
    const q = s.q;
    const fb = s.screen === "fb" ? s.fb : null;
    const done = !!fb;
    const coach: [Mood, string] = fb
      ? fb.correct ? ["cheer", "Nice thinking. That is how it works."] : ["kind", "No worries. Mistakes help me help you."]
      : s.phase === "warm" ? ["happy", "Just a warm-up. Nothing counts against you."] : ["happy", "Take your time. Hints are free."];
    body = (
      <>
        <Coach mood={coach[0]}>{coach[1]}</Coach>
        <h2>{s.phase === "warm" ? `Warm-up ${s.qn + 1} of 2` : `Practice ${s.qn + 1} of ${Math.max(PRACTICE_COUNT, s.qn + 1)}`}</h2>
        <div className="card">
          <p style={{ marginTop: 0 }}>{q.stem}</p>
          <div className="ask">{q.ask}</div>
          <p style={{ margin: "8px 0 0" }}>
            <span className="badge">{q.noAI ? "📝 fixed worked example (not AI)" : q.src === "ai" ? "✨ story by AI · numbers and answer checked by the app" : "📄 template story (AI off or failed the check)"}</span>
          </p>
        </div>

        {q.format === "mcq" && q.options!.map((o) => (
          <button key={o.id} className={`opt ${!done && pick === o.id ? "sel" : ""} ${done && o.correct ? "good" : ""} ${done && fb!.given === o.id && !o.correct ? "bad" : ""}`}
            disabled={done} onClick={() => setPick(o.id)} aria-pressed={pick === o.id}>
            <span className="letter">{o.id.toUpperCase()}</span><span>{o.text}</span>
          </button>
        ))}

        {q.format === "spot" && q.steps!.map((st, i) => (
          <button key={i} className={`step ${!done && pick === String(i) ? "sel" : ""} ${done && st.wrong ? "good" : ""} ${done && fb!.given === String(i) && !st.wrong ? "bad" : ""}`}
            disabled={done} onClick={() => setPick(String(i))}>
            <span className="letter">{i + 1}</span><span>{st.text}</span>
          </button>
        ))}

        {q.format === "numeric" && (
          <div className="row">
            <span className="unit">{q.unit === "₹" ? "₹" : ""}</span>
            <input type="text" inputMode="decimal" aria-label="Your answer" placeholder="Type your answer" value={text} disabled={done}
              onChange={(e) => setText(e.target.value)} />
            <span className="unit">{q.unit === "%" ? "%" : ""}</span>
          </div>
        )}

        {!done && (
          <>
            <p className="muted" style={{ marginBottom: 0 }}>How sure do you feel? (optional)</p>
            <div className="chips">
              <button className={`chip ${!unsure ? "on" : ""}`} onClick={() => setUnsure(false)}>🙂 Fairly sure</button>
              <button className={`chip ${unsure ? "on" : ""}`} onClick={() => setUnsure(true)}>🤔 Not sure</button>
              <button className={`chip ${hint ? "on" : ""}`} onClick={() => setHint(true)}>💡 Free hint</button>
            </div>
            {hint && (
              <div className="box info">
                {q.hint}
                {q.helperBase && <div className="viz"><b>Helper:</b> 10% of {q.helperBase} = {q.helperBase / 10} · 1% of {q.helperBase} = {q.helperBase / 100}</div>}
              </div>
            )}
          </>
        )}

        {fb && (
          <div className="card">
            <p style={{ margin: 0 }}><b>How it works:</b> {q.model}</p>
            <p className="muted" style={{ margin: "8px 0 0" }}>🧭 Tutor note: {fb.reason}</p>
          </div>
        )}
      </>
    );
    if (!done) {
      dock = <button className="btn" disabled={(q.format === "numeric" ? !text.trim() : !pick) || busy} onClick={submit}>Check my answer</button>;
    } else {
      sheet = (
        <div className={`sheet ${fb!.correct ? "good" : "warn"}`} role="status">
          <div className="sheet-scroll">
            <div className="sheet-head"><span className="sicon" aria-hidden="true">{fb!.correct ? "✓" : "↻"}</span><b>{fb!.correct ? "Yes, that works!" : "Not yet, and that is okay."}</b></div>
            {fb!.correct && <p>You picked the right price to take the percent from.</p>}
            {!fb!.correct && fb!.note && <p>{fb!.note}</p>}
            {!fb!.correct && (fb!.tag === "M1" || fb!.tag === "M2") && <p>{MIS_TEXT[fb!.tag]}</p>}
          </div>
          <button className="btn" onClick={afterFeedback} disabled={busy}>
            {busy ? "Getting your next question…" : fb!.action === "alt_explain" ? "Show me another way" : fb!.action === "prereq" ? "Let's rebuild the basics" : fb!.action === "harder" ? "Level up: next question" : "Continue"}
          </button>
        </div>
      );
    }
  }

  // ---------- CONCEPT ----------
  else if (s.screen === "concept") {
    const watch = s.tutor.target;
    body = (
      <>
        <Coach mood="think">Look at the bars. Which price is the percent taken from?</Coach>
        <h2>The big idea: “percent of <u>what</u>?”</h2>
        <div className="card">
          <p style={{ marginTop: 0 }}>Let us look at one shirt together. Its <b>marked price (MP)</b> is ₹500.</p>
          <Viz rows={[{ label: "Marked price (MP)", v: 500 }, { label: "20% off → you pay", v: 400, cls: "l" }]} />
          <p><b>Discount:</b> 20% of the <b>marked price</b> = ₹100. You pay ₹400.</p>
          <p>Now the shopkeeper <b>bought</b> it for ₹400 (<b>cost price, CP</b>) and sells for ₹500 (<b>selling price, SP</b>). Profit = ₹100.</p>
          <p><b>Profit %</b> = ₹100 out of the <b>cost price</b> ₹400 = <b>25%</b>.</p>
        </div>
        <div className="box"><b>Remember the base:</b><br />Discount % → out of the <b>marked price</b><br />Profit / Loss % → out of the <b>cost price</b><br />Two discounts → the second one is out of the <b>new, lower price</b></div>
        {watch && <div className="box warn">I noticed one idea to watch in your warm-up. We will practise that one gently.</div>}
      </>
    );
    dock = <button className="btn" onClick={startPractice} disabled={busy}>{busy ? "Getting your question…" : "Got it, let's practise"}</button>;
  }

  // ---------- REMEDY (alternative explanation) ----------
  else if (s.screen === "remedy") {
    const m = s.remedy;
    body = m === "M1" ? (
      <>
        <Coach mood="kind">No worries. Here is another way to see it.</Coach>
        <h2>Let us look at it another way</h2>
        <div className="card">
          <p style={{ marginTop: 0 }}>Say a shopkeeper pays <b>₹100</b> and sells it for <b>₹125</b>.</p>
          <Viz rows={[{ label: "Paid (CP)", v: 100, cls: "l" }, { label: "Sold (SP)", v: 125 }]} />
          <p>Profit is ₹25. Is that 25 out of what the shopkeeper <b>paid</b>, or what he <b>sold at</b>?</p>
          <p>His own money started at ₹100. So profit % = 25 out of <b>100</b> = <b>25%</b>.</p>
          <p className="muted">If you divide by ₹125 you get 20%. That tells you about the selling price, not about how much the shopkeeper’s money grew.</p>
        </div>
        <div className="box"><b>Rule:</b> profit % and loss % are always out of the <b>cost price</b>.</div>
      </>
    ) : (
      <>
        <Coach mood="kind">No worries. Here is another way to see it.</Coach>
        <h2>Let us look at it another way</h2>
        <div className="card">
          <p style={{ marginTop: 0 }}>A ₹100 item: <b>20% off</b>, then <b>10% off</b>.</p>
          <Viz rows={[{ label: "Start", v: 100 }, { label: "After 20% off", v: 80, cls: "l" }, { label: "After 10% more (10% of 80 = 8)", v: 72, cls: "l" }, { label: "If it were 30% off", v: 70, cls: "o" }]} />
          <p>The second 10% is taken from ₹80, not from ₹100. That is a smaller amount, so the final price (₹72) is a bit <b>higher</b> than 30% off (₹70).</p>
        </div>
        <div className="box"><b>Rule:</b> each discount is out of the price <b>just before it</b>.</div>
      </>
    );
    dock = <button className="btn" onClick={() => goNext(s)} disabled={busy}>{busy ? "Getting your question…" : "Try one like it"}</button>;
  }

  // ---------- PREREQUISITE ----------
  else if (s.screen === "prereq") {
    body = (
      <>
        <Coach mood="kind">No worries. Let us make the basics easy.</Coach>
        <h2>Quick rebuild: “x% of a number”</h2>
        <div className="card">
          <p style={{ marginTop: 0 }}>Everything in this topic is built on this one skill. Let us make it easy.</p>
          <p><b>10%</b> of a number = divide by <b>10</b>.<br /><b>1%</b> = divide by <b>100</b>.<br /><b>5%</b> = half of 10%.</p>
          <p>Example: <b>15% of ₹200</b> → 10% is 20, 5% is 10 → <b>₹30</b>.</p>
        </div>
        <div className="box"><b>Tip:</b> build the percent from 10% and 1%. The 💡 hint will show them for you.</div>
      </>
    );
    dock = <button className="btn" onClick={() => goNext(s)} disabled={busy}>{busy ? "Getting your question…" : "Try a small one"}</button>;
  }

  // ---------- EXPLAIN ----------
  else if (s.screen === "explain") {
    body = (
      <>
        <Coach mood="happy">Say it your way. Short is fine.</Coach>
        <h2>Explain it in your own words</h2>
        <div className="card"><p style={{ margin: 0 }}>{EXPLAIN_Q}</p></div>
        <div className="chips">
          <button className="chip" onClick={() => setText("I agree because ")}>I agree because…</button>
          <button className="chip" onClick={() => setText("I don't agree because ")}>I don't agree because…</button>
        </div>
        <textarea rows={4} aria-label="Your explanation" placeholder="Type here. Short is fine." value={text} onChange={(e) => setText(e.target.value)} />
        <p className="muted">There is no wrong way to start. I will give you feedback, not a mark.</p>
      </>
    );
    dock = <button className="btn" onClick={submitExplain} disabled={busy || text.trim().length < 2}>{busy ? "Reading your answer…" : "Send my explanation"}</button>;
  }

  else if (s.screen === "efb" && s.explain) {
    const e = s.explain;
    body = (
      <>
        <Coach mood={e.label === "correct" ? "cheer" : "kind"}>{e.label === "correct" ? "You said it your way. Well done." : "Good effort. Let us check it together."}</Coach>
        <h2>Thanks for explaining</h2>
        <div className="card"><span className="muted">You wrote:</span><p style={{ margin: "4px 0 0" }}>“{e.text}”</p></div>
        {e.ai && <div className="box info">{e.ai} <span className="badge">✨ AI wording</span></div>}
        <div className={`box ${e.label === "correct" ? "" : "warn"}`}>
          <b>{e.label === "correct" ? "Your idea matches ✔" : "Let us check this together"}</b>
          <p style={{ margin: "6px 0 0" }}>{e.canned}</p>
          <p className="muted" style={{ margin: "6px 0 0" }}>This check comes from the app’s fixed rules. AI only adds the warm line above it.</p>
        </div>
      </>
    );
    dock = <button className="btn" onClick={() => setS({ ...s, screen: "summary", step: 5 })}>See my wrap-up</button>;
  }

  // ---------- SUMMARY ----------
  else if (s.screen === "summary") {
    const att = s.tutor.history;
    const ok = att.filter((a) => a.correct).length;
    const lvlName = ["Basics", "Discounts", "Profit & loss", "Two-step problems"][s.tutor.level];
    const badges = earnedBadges(att);
    const ideas: string[] = [];
    if (s.tutor.hits.M1) ideas.push("Profit/loss % is out of the cost price. We worked on this.");
    if (s.tutor.hits.M2) ideas.push("The second discount is out of the new, lower price. We worked on this.");
    body = (
      <>
        <Coach mood="cheer">You stayed with it. That counts.</Coach>
        <h1>Well done for finishing 🎉</h1>
        <div className="card">
          <p style={{ marginTop: 0 }}>You tried <b>{att.length}</b> questions and <b>{ok}</b> worked first time. You spent {mins} min {secs} s.</p>
          <p>Where you reached: <b>{lvlName}</b></p>
          {ideas.length ? <div className="box warn"><b>Ideas we worked on today</b><ul className="log">{ideas.map((i) => <li key={i}>{i}</li>)}</ul></div> : <div className="box">No mix-ups showed up today. Nice careful thinking.</div>}
          <b>Next time:</b> {s.tutor.hits.M1 ? "a few profit and loss questions, always asking “out of which price?”" : s.tutor.hits.M2 ? "a few two-discount questions, asking “price just before it?”" : "a harder two-step problem."}
        </div>
        <div className="card shop">
          <b>My shop shelf</b>
          <div className="shelf" role="img" aria-label="Five shelf items: a bag, a pencil, a notebook, a price tag and a receipt">
            {["🛍️", "✏️", "📒", "🏷️", "🧾"].map((e, i) => <span key={e} className="slot" style={{ ["--i" as string]: i }}>{e}</span>)}
          </div>
          <p className="muted" style={{ margin: "8px 0" }}>Your shelf is stocked: one item for each step you finished.</p>
          <div className="pills">
            {badges.map((b) => <div className="pill" key={b.key}><b>{b.name}</b><span>{b.why}</span></div>)}
          </div>
        </div>
        <details className="card"><summary><b>How the tutor chose your path</b></summary>
          <ul className="log">{s.log.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </details>
        <p className="muted">Your session is saved only on this device.</p>
      </>
    );
    dock = <button className="btn" onClick={() => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } setS(null); setHasSaved(null); }}>Back to start</button>;
  }

  if (about) { body = <About />; dock = null; sheet = null; }

  // main remounts on each screen change (q and fb share a key so the answer tiles do not re-animate)
  const mainKey = about ? "about" : !s ? "home" : s.screen === "q" || s.screen === "fb" ? `q-${s.qn}-${s.q?.id}` : `${s.screen}-${s.qn}-${s.step}`;
  const learning = !!s && !["home"].includes(s.screen) && !about;
  const curSeg = s ? (s.screen === "summary" ? 6 : s.step) : 1;

  return (
    <div className="stage">
      <div className="app">
        <header className="appbar">
          {learning ? (
            <>
              <div className="bar-row">
                {s!.screen !== "summary" ? (
                  <button className="x-btn" onClick={stopNow} aria-label="Stop for now. Your place is saved.">✕</button>
                ) : <span className="x-spacer" />}
                <div className="segs" role="progressbar" aria-valuemin={1} aria-valuemax={5} aria-valuenow={Math.min(5, curSeg)} aria-label="Session progress">
                  {STEP_NAMES.map((n, i) => (
                    <span key={n} className={`seg ${i + 1 < curSeg ? "done" : i + 1 === curSeg ? "cur" : ""}`} title={n} />
                  ))}
                </div>
                <span className="timer">⏱ {mins}:{secs}</span>
              </div>
              <div className="steplabel">{s!.screen === "summary" ? "All done · no rush needed" : `Step ${s!.step} of 5 · ${STEP_NAMES[s!.step - 1]}`}</div>
            </>
          ) : (
            <div className="brand"><Paisa mood="happy" size={34} /><b>Percent, step by step</b>{about && <span className="muted"> · About</span>}</div>
          )}
        </header>
        <main key={mainKey} className="main slide">{body}</main>
        {sheet}
        {dock && <div className="dock">{dock}</div>}
        <footer>
          {ROLL} · ET 617 End-Sem ·{" "}
          <button onClick={() => setAbout(!about)}>{about ? "Close About" : "About"}</button>
        </footer>
        {toast && <div className="toast" role="status">{toast}</div>}
      </div>
    </div>
  );
}

function About() {
  return (
    <>
      <h1>About this app</h1>
      <div className="card">
        <p style={{ marginTop: 0 }}><b>Roll number:</b> {ROLL}</p>
        <p><b>Exam card:</b> P4 Adaptive tutor with automatic question generation · T9 Percentages: discount, profit and loss (Class 8) · L5 Learner repeating after failing once · C4 10-minute sessions</p>
        <p><b>For:</b> Kavya, 13, Class 8, retaking the percentages unit.</p>
        <p><b>How it adapts:</b> a 2-question warm-up sets the start level; then your answers, mix-up patterns, hints and “not sure” taps decide whether you get a harder question, another explanation, or a basics rebuild.</p>
        <p><b>What AI does:</b> rewords the story of a question and warms up feedback. <b>What AI never does:</b> compute answers, grade, or decide what comes next. A fixed rule engine does that.</p>
        <p>Rewards are for effort and strategy, never for scores, so nothing can be lost. The shop shelf and badges have no points, streaks or comparisons.</p>
        <p className="muted">ET 617 End-Semester Examination, 18 Nov 2026.</p>
      </div>
    </>
  );
}
