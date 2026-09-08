import Anthropic from "@anthropic-ai/sdk";
import { SLOT_CATALOG, SYSTEM_PROMPT, buildUserPrompt, parseMatchResponse } from "../../../lib/match";

export const runtime = "edge";

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Server misconfigured: ANTHROPIC_API_KEY is not set." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: { description?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body — expected JSON with a `description` field." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const description = (body.description ?? "").trim();
  if (description.length === 0) {
    return new Response(JSON.stringify({ error: "Please describe what you're looking for." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const anthropic = new Anthropic({ apiKey });

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(description, SLOT_CATALOG) }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const raw = textBlock && textBlock.type === "text" ? textBlock.text : "";

    const result = parseMatchResponse(raw, SLOT_CATALOG);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    // Covers network failures, API errors, and rate limits — the user always gets
    // a clean, actionable message instead of a raw stack trace or a hung request.
    return new Response(
      JSON.stringify({
        error: "We're having trouble reaching the matching service right now. Please try again in a moment.",
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
