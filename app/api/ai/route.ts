import { NextResponse } from "next/server";
import { validateFeedback, validateStory } from "../../../lib/validate";

// Two AI features, both advisory. Correctness always comes from lib/engine.ts.
//  1. story:    reword a question's setup as a short Pune/Maharashtra shop story.
//  2. feedback: rephrase a canned, already-decided explanation feedback warmly.
// Every output is validated here; on any failure the client falls back to template text.

export const runtime = "nodejs";

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

async function llm(system: string, user: string): Promise<string | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3500);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        temperature: 0.6,
        max_tokens: 160,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    return (j.choices?.[0]?.message?.content ?? "").trim() || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: Request) {
  let body: { task?: string; facts?: number[]; stem?: string; label?: string; learnerText?: string; canned?: string; allowed?: number[] };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 }); }

  if (body.task === "story") {
    const facts = (body.facts ?? []).slice(0, 6);
    const out = await llm(
      "You write one short setup (1-2 sentences, under 40 words) for a maths word problem for a Class 8 student in Maharashtra, India. " +
        "Use rupees. Plain simple English, friendly. Use EXACTLY the given numbers and no other numbers. Do not ask a question. Do not give any answer or working.",
      `Reword this setup with a fresh everyday shop context but keep every number the same.\nNumbers that must appear: ${facts.join(", ")}\nSetup: ${body.stem ?? ""}`
    );
    if (!out) return NextResponse.json({ ok: false, reason: "ai_unavailable" });
    if (!validateStory(out, facts)) return NextResponse.json({ ok: false, reason: "failed_validation" });
    return NextResponse.json({ ok: true, text: out });
  }

  if (body.task === "feedback") {
    const allowed = (body.allowed ?? []).slice(0, 20);
    const out = await llm(
      "You are a kind maths tutor for an anxious 13-year-old who failed this topic once. Reply in 2 short sentences. " +
        "Do NOT change the maths or the verdict. Never say 'wrong'. Praise effort first. Use only numbers from the given text.",
      `Verdict (already decided by the app): ${body.label}\nStudent wrote: "${(body.learnerText ?? "").slice(0, 300)}"\nApp's feedback: "${body.canned ?? ""}"\nRewrite the app's feedback warmly in 2 sentences, referring to what the student wrote.`
    );
    if (!out) return NextResponse.json({ ok: false, reason: "ai_unavailable" });
    if (!validateFeedback(out, allowed)) return NextResponse.json({ ok: false, reason: "failed_validation" });
    return NextResponse.json({ ok: true, text: out });
  }

  return NextResponse.json({ ok: false, reason: "unknown_task" }, { status: 400 });
}
