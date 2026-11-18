import { NextResponse } from "next/server";
import { validateFeedback, validateStory } from "../../../lib/validate";

// Two AI features, both advisory. Correctness always comes from lib/engine.ts.
//  1. story:    reword a question's setup as a short Pune/Maharashtra shop story.
//  2. feedback: rephrase a canned, already-decided explanation feedback warmly.
// Every output is validated here; on any failure the client falls back to template text.

export const runtime = "nodejs";

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

let lastErr = "";
const MODELS = [process.env.GROQ_MODEL, "openai/gpt-oss-20b", "openai/gpt-oss-120b", "llama-3.1-8b-instant", "llama-3.3-70b-versatile"].filter(Boolean) as string[];

async function llm(system: string, user: string): Promise<string | null> {
  const key = process.env.GROQ_API_KEY;
  lastErr = "";
  if (!key) { lastErr = "no_key"; return null; }
  for (const model of MODELS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          temperature: 0.6,
          max_tokens: model.startsWith("openai/gpt-oss") ? 900 : 160,
          ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
        }),
      });
      if (!res.ok) {
        lastErr += ` | ${model} http_${res.status}: ${(await res.text()).slice(0, 70)}`;
        if (res.status === 404 || res.status === 403 || res.status === 400) continue; // try next model
        return null;
      }
      const j = await res.json();
      const out = (j.choices?.[0]?.message?.content ?? "").trim();
      if (out) return out;
      lastErr += ` | ${model} empty`;
    } catch (e) {
      lastErr = `${model} fetch_error: ${String(e).slice(0, 80)}`;
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
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
    if (!out) return NextResponse.json({ ok: false, reason: "ai_unavailable", detail: lastErr });
    if (!validateStory(out, facts)) return NextResponse.json({ ok: false, reason: "failed_validation" });
    return NextResponse.json({ ok: true, text: out });
  }

  if (body.task === "feedback") {
        const out = await llm(
      "You are a kind tutor for an anxious 13-year-old who failed this topic once. Write EXACTLY ONE short sentence (max 20 words) that warmly acknowledges the effort or what the student wrote. " +
        "Do not use any digits or currency symbols. Do not say whether the answer is right or wrong. Do not explain any maths.",
      `The student wrote: "${(body.learnerText ?? "").slice(0, 300)}"
Write the one warm sentence.`
    );
    if (!out) return NextResponse.json({ ok: false, reason: "ai_unavailable", detail: lastErr });
    if (!validateFeedback(out)) return NextResponse.json({ ok: false, reason: "failed_validation" });
    return NextResponse.json({ ok: true, text: out });
  }

  return NextResponse.json({ ok: false, reason: "unknown_task" }, { status: 400 });
}
