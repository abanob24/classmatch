"use client";

import { useState, useRef } from "react";
import { SLOT_CATALOG, type MatchResult } from "../lib/match";

export default function MatchForm() {
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<MatchResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (description.trim().length === 0) {
      setStatus("error");
      setErrorMessage("Please describe what you're looking for before submitting.");
      return;
    }

    setStatus("loading");
    setErrorMessage("");
    setResult(null);

    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMessage(data.error || "Something went wrong. Please try again.");
        return;
      }

      setResult(data);
      setStatus("done");
      // Move focus to the result so screen reader users land on the new content
      // instead of having to hunt for it after the page updates.
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch {
      setStatus("error");
      setErrorMessage("We couldn't reach the server. Check your connection and try again.");
    }
  }

  const matchedSlots = result?.suggestedSlotIds
    .map((id) => SLOT_CATALOG.find((s) => s.id === id))
    .filter((s): s is (typeof SLOT_CATALOG)[number] => Boolean(s));

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <label htmlFor="description">
          Tell us what you're looking for
          <span aria-hidden="true"> *</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-required="true"
          aria-describedby="description-hint"
          placeholder="e.g. My daughter is in grade 5 and struggling with math, we're free Saturdays and Mondays after 4pm"
        />
        <p id="description-hint">Include subject, grade, and the days/times that work for you.</p>

        <button type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Finding a match…" : "Find a match"}
        </button>
      </form>

      {status === "error" && (
        <p role="alert" className="error-message">
          {errorMessage}
        </p>
      )}

      {status === "done" && result && (
        <div ref={resultRef} tabIndex={-1} aria-live="polite" className="result">
          {result.matched && matchedSlots && matchedSlots.length > 0 ? (
            <>
              <h2>We found a match</h2>
              <p>{result.reasoning}</p>
              <ul>
                {matchedSlots.map((slot) => (
                  <li key={slot.id}>
                    <strong>{slot.subject}</strong> — {slot.day} at {slot.time} ({slot.gradeRange})
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h2>No slot fits yet</h2>
              <p>{result.message || "None of our current slots match — please contact the center directly."}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
