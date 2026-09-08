import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MatchForm from "../components/MatchForm";

describe("MatchForm", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a labeled textarea and a submit button", () => {
    render(<MatchForm />);

    expect(screen.getByLabelText(/tell us what you're looking for/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /find a match/i })).toBeInTheDocument();
  });

  it("shows an accessible error message when submitted empty, without calling the API", () => {
    render(<MatchForm />);

    fireEvent.click(screen.getByRole("button", { name: /find a match/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/describe what you're looking for/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("renders a matched slot after a successful submission", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        matched: true,
        subject: "Math",
        suggestedSlotIds: ["s1"],
        reasoning: "Great fit for a grade 5 student on Saturdays.",
      }),
    });

    render(<MatchForm />);

    fireEvent.change(screen.getByLabelText(/tell us what you're looking for/i), {
      target: { value: "grade 5, struggling with math, free Saturdays" },
    });
    fireEvent.click(screen.getByRole("button", { name: /find a match/i }));

    await waitFor(() => {
      expect(screen.getByText(/we found a match/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Saturday at 4:00 PM/i)).toBeInTheDocument();
  });

  it("shows a server-provided error message when the API call fails", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "We're having trouble reaching the matching service right now." }),
    });

    render(<MatchForm />);

    fireEvent.change(screen.getByLabelText(/tell us what you're looking for/i), {
      target: { value: "grade 3 english help" },
    });
    fireEvent.click(screen.getByRole("button", { name: /find a match/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/trouble reaching the matching service/i);
    });
  });
});
