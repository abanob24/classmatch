// The real, fixed catalog of available tutoring slots.
// This is the single source of truth — the model is never allowed to invent a slot
// outside this list. This is the guardrail: structured data integrity, not just tone.
export interface Slot {
  id: string;
  subject: string;
  day: string;
  time: string;
  gradeRange: string;
}

export const SLOT_CATALOG: Slot[] = [
  { id: "s1", subject: "Math", day: "Saturday", time: "4:00 PM", gradeRange: "Grades 4-6" },
  { id: "s2", subject: "Math", day: "Monday", time: "5:30 PM", gradeRange: "Grades 7-9" },
  { id: "s3", subject: "English", day: "Saturday", time: "5:00 PM", gradeRange: "Grades 4-6" },
  { id: "s4", subject: "English", day: "Wednesday", time: "4:30 PM", gradeRange: "Grades 7-9" },
  { id: "s5", subject: "Science", day: "Monday", time: "4:00 PM", gradeRange: "Grades 4-6" },
  { id: "s6", subject: "Science", day: "Thursday", time: "5:00 PM", gradeRange: "Grades 7-9" },
  { id: "s7", subject: "Arabic", day: "Sunday", time: "4:00 PM", gradeRange: "Grades 1-3" },
  { id: "s8", subject: "Arabic", day: "Tuesday", time: "5:00 PM", gradeRange: "Grades 4-6" },
];

export interface MatchResult {
  matched: boolean;
  subject?: string;
  urgency?: "flexible" | "soon" | "asap";
  suggestedSlotIds: string[];
  reasoning: string;
  message?: string;
}

export const SYSTEM_PROMPT = `You are a scheduling assistant for a small after-school tutoring center. A parent or student will describe, in plain language, what kind of help they're looking for and when they're available.

Your job: read their description and return ONLY a JSON object (no prose, no markdown fences) with this exact shape:

{
  "matched": boolean,
  "subject": string,
  "urgency": "flexible" | "soon" | "asap",
  "suggestedSlotIds": string[],
  "reasoning": string,
  "message": string
}

Rules you must follow exactly:
1. You will be given the current slot catalog as a JSON array. "suggestedSlotIds" must ONLY contain "id" values that literally appear in that catalog. Never invent a slot, a day, a time, or a subject that isn't in the catalog. This is the single most important rule.
2. Suggest at most 2 slots, and only ones that plausibly match the subject and the parent's stated availability. If they mention specific days, prefer slots on those days.
3. If nothing in the catalog reasonably fits (wrong subject entirely, or every slot conflicts with their stated availability), set "matched" to false, leave "suggestedSlotIds" as an empty array, and explain why in "message" — for example, suggest they contact the center directly to discuss a custom time.
4. "urgency" should reflect the tone: "asap" if they mention an upcoming exam, falling behind, or urgency; "soon" for a general near-term need; "flexible" if they mention no time pressure.
5. "reasoning" is 1-2 short sentences explaining your subject/slot choice in plain language, written to the parent.
6. Output raw JSON only. No markdown code fences, no extra commentary before or after.`;

export function buildUserPrompt(description: string, catalog: Slot[]): string {
  return `Parent's request: "${description.trim()}"\n\nCurrent slot catalog:\n${JSON.stringify(catalog, null, 2)}`;
}

/**
 * Parses and validates the model's raw text response into a safe MatchResult.
 * Never trusts the model's output blindly — re-validates every suggested slot ID
 * against the real catalog before it's allowed to reach the UI.
 */
export function parseMatchResponse(raw: string, catalog: Slot[]): MatchResult {
  let parsed: unknown;
  try {
    // Models occasionally wrap JSON in code fences despite instructions — strip them defensively.
    const cleaned = raw.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return {
      matched: false,
      suggestedSlotIds: [],
      reasoning: "",
      message: "We couldn't generate a recommendation from that description. Please try rephrasing it.",
    };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return {
      matched: false,
      suggestedSlotIds: [],
      reasoning: "",
      message: "We couldn't generate a recommendation from that description. Please try rephrasing it.",
    };
  }

  const obj = parsed as Record<string, unknown>;
  const validIds = new Set(catalog.map((s) => s.id));
  const rawIds = Array.isArray(obj.suggestedSlotIds) ? obj.suggestedSlotIds : [];

  // Guardrail enforcement: silently drop any slot ID the model invented that isn't real.
  const safeIds = rawIds.filter((id): id is string => typeof id === "string" && validIds.has(id)).slice(0, 2);

  return {
    matched: typeof obj.matched === "boolean" ? obj.matched : safeIds.length > 0,
    subject: typeof obj.subject === "string" ? obj.subject : undefined,
    urgency:
      obj.urgency === "flexible" || obj.urgency === "soon" || obj.urgency === "asap"
        ? obj.urgency
        : undefined,
    suggestedSlotIds: safeIds,
    reasoning: typeof obj.reasoning === "string" ? obj.reasoning : "",
    message: typeof obj.message === "string" ? obj.message : undefined,
  };
}
