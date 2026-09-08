import { describe, it, expect } from "vitest";
import { parseMatchResponse, SLOT_CATALOG } from "../lib/match";

describe("parseMatchResponse", () => {
  it("parses a valid, well-formed model response", () => {
    const raw = JSON.stringify({
      matched: true,
      subject: "Math",
      urgency: "soon",
      suggestedSlotIds: ["s1"],
      reasoning: "This Saturday math slot fits a grade 5 student.",
    });

    const result = parseMatchResponse(raw, SLOT_CATALOG);

    expect(result.matched).toBe(true);
    expect(result.suggestedSlotIds).toEqual(["s1"]);
    expect(result.reasoning).toContain("Saturday");
  });

  it("strips slot IDs the model invented that are not in the real catalog (the core guardrail)", () => {
    const raw = JSON.stringify({
      matched: true,
      subject: "Math",
      suggestedSlotIds: ["s1", "fake-slot-99"],
      reasoning: "Two options for you.",
    });

    const result = parseMatchResponse(raw, SLOT_CATALOG);

    expect(result.suggestedSlotIds).toEqual(["s1"]);
    expect(result.suggestedSlotIds).not.toContain("fake-slot-99");
  });

  it("caps suggestions at 2 slots even if the model returns more", () => {
    const raw = JSON.stringify({
      matched: true,
      suggestedSlotIds: ["s1", "s2", "s3", "s4"],
      reasoning: "Several options.",
    });

    const result = parseMatchResponse(raw, SLOT_CATALOG);

    expect(result.suggestedSlotIds).toHaveLength(2);
  });

  it("handles a model response wrapped in markdown code fences", () => {
    const raw = "```json\n" + JSON.stringify({ matched: false, suggestedSlotIds: [], reasoning: "" }) + "\n```";

    const result = parseMatchResponse(raw, SLOT_CATALOG);

    expect(result.matched).toBe(false);
  });

  it("falls back to a safe error result when the model returns invalid JSON", () => {
    const result = parseMatchResponse("this is not json at all", SLOT_CATALOG);

    expect(result.matched).toBe(false);
    expect(result.suggestedSlotIds).toEqual([]);
    expect(result.message).toBeTruthy();
  });

  it("falls back safely when suggestedSlotIds is missing entirely", () => {
    const raw = JSON.stringify({ matched: true, reasoning: "no ids field at all" });

    const result = parseMatchResponse(raw, SLOT_CATALOG);

    expect(result.suggestedSlotIds).toEqual([]);
  });
});
