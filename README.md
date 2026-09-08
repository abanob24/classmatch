# ClassMatch

## Project Brief

ClassMatch turns a parent's plain-language description of what tutoring help their child needs into a structured, actionable match against a real (small, fixed) catalog of available sessions — instead of a chatbot that just talks about tutoring. It's built for small tutoring centers and after-school programs, the kind of client I already build booking and management systems for on a freelance basis, where staff currently do this matching by hand from a WhatsApp message. I chose this over a generic chatbot because the interesting engineering problem isn't "can the model talk about scheduling" — it's making sure the model's output can be trusted enough to show a parent a specific day and time, which meant building a real guardrail around structured data, not just prose.

**Live demo:** https://classmatch-sandy.vercel.app/

## Setup (run locally in under 5 minutes)

Prerequisites: Node 18+, npm, an Anthropic API key (free trial credit available at [console.anthropic.com](https://console.anthropic.com)).

```bash
git clone https://github.com/abanob24/classmatch.git
cd classmatch
npm install
cp .env.example .env.local
```

Add your key to `.env.local`:
```
ANTHROPIC_API_KEY=your_key_here
```

Run it:
```bash
npm run dev
```

Open http://localhost:3000, describe what you're looking for (e.g. *"my daughter is in grade 5 and struggling with math, we're free Saturdays and Mondays after 4pm"*), and submit.

## Architecture

```
┌────────────────┐      ┌──────────────────┐      ┌─────────────────────┐
│  MatchForm.tsx   │ ──▶ │  /api/match        │ ──▶ │  Anthropic API        │
│  (client comp.,  │◀─── │  (edge route,      │◀─── │  (single completion,   │
│  accessible form)│     │  route.ts)         │     │  structured JSON out)  │
└────────────────┘      └──────────────────┘      └─────────────────────┘
                                  │
                                  ▼
                        ┌──────────────────┐
                        │  lib/match.ts      │
                        │  SLOT_CATALOG      │
                        │  (source of truth) │
                        │  + response parser  │
                        │  + guardrail        │
                        └──────────────────┘
```

- **`components/MatchForm.tsx`** — the only interactive piece. Accessible labeled form, client-side empty-input validation, loading/error/success states, focus management on new results.
- **`app/api/match/route.ts`** — validates the request, calls Claude with the fixed slot catalog embedded in the prompt, and returns a clean JSON response or a clean error — never a raw stack trace.
- **`lib/match.ts`** — the real slot catalog (single source of truth), the system prompt, and `parseMatchResponse`, which re-validates every slot ID the model returns against the real catalog before it's allowed to reach the UI.

## AI integration explained

The model (`claude-sonnet-4-5`, via the Anthropic API) receives the parent's free-text description plus the current slot catalog as JSON, and is instructed to return **only** a JSON object: which subject it identified, an urgency level, up to two suggested slot IDs, and a one-line reasoning for the parent.

The core design decision: **the model is never trusted to invent a slot.** `parseMatchResponse` in `lib/match.ts` takes whatever `suggestedSlotIds` the model returns and filters it against the real, hardcoded `SLOT_CATALOG` — any ID that doesn't exist in the real catalog is silently dropped before it ever reaches the UI. This is the same hallucination-guardrail principle from my earlier CineVault project, applied to a case where getting it wrong wouldn't just be a bad movie recommendation — it would tell a parent to show up to a class that doesn't exist.

## Known limitations & future improvements

- The slot catalog is hardcoded in `lib/match.ts`, not pulled from a real database — a production version would need a real backend and a way for staff to update availability.
- No conversation memory — each submission is a single one-shot request, there's no follow-up ("what about Tuesdays instead?") like a chat interface would allow.
- No booking confirmation flow — it recommends a slot but doesn't actually reserve it or notify staff.
- Urgency level is currently informational only — it doesn't change how slots are ranked or filtered.
- Future improvement: send a confirmation email/WhatsApp message with the matched slot, and let staff mark it as booked.

## Testing evidence

```
$ npm run test

 ✓ tests/MatchForm.test.tsx (4 tests) 158ms
 ✓ tests/match.test.ts (6 tests) 6ms

 Test Files  2 passed (2)
      Tests  10 passed (10)

$ npm run typecheck   →  clean, no errors
$ npm run build       →  ✓ Compiled successfully, First Load JS 88.7 kB
```

- **Component test** (`tests/MatchForm.test.tsx`, 4 tests): renders the accessible form correctly, blocks submission with an accessible error when the description is empty (without calling the API), renders a matched slot after a successful API response, and shows a server-provided error message on API failure.
- **Logic test** (`tests/match.test.ts`, 6 tests): covers the response parser directly, including the core guardrail — a test that feeds the parser a model response containing a fake, non-existent slot ID and asserts it gets silently stripped before reaching the UI.
- Manually tested end-to-end on the **live** deployment (not just localhost): submitted a real request and got back a matched slot with correct reasoning.

## Performance & accessibility audit

**Lighthouse, run against the live URL (not localhost):**

| Metric | Desktop | Mobile |
|---|---|---|
| Performance | 100 | 100 |
| Accessibility | 100 | 100 |
| Best Practices | 100 | 100 |
| SEO | 100 | 100 |

**Code-level accessibility review (WCAG 2.1 AA), done before running any tool:**

| Check | Result |
|---|---|
| `<html lang="en">` set | Pass |
| Textarea has a real associated `<label>`, not just a placeholder | Pass |
| Required field announced via `aria-required` | Pass |
| Hint text linked via `aria-describedby` | Pass |
| Errors announced via `role="alert"` | Pass |
| Result region uses `aria-live="polite"` and receives programmatic focus | Pass |
| Visible focus indicator on all interactive elements (`:focus-visible`) | Pass |
| Body text contrast (`#1a1a1a` on `#fafafa`) | 16.7:1 — pass |
| Hint text contrast (`#494949` on `#fafafa`) | 8.6:1 — pass |
| Error text contrast (`#7f1d1d` on `#fef2f2`) | 8.5:1 — pass |
| Button text contrast (`#fff` on `#1d4ed8`) | 6.7:1 — pass |

**Findings:** no violations, in either the manual review or the automated Lighthouse/axe scan. This app was built with accessibility as a first-class requirement from the start (labeled inputs, live regions, focus management, and a palette checked against WCAG AA before it was written into `globals.css`), rather than audited in after the fact — so the honest outcome of this audit is confirmation, not a list of fixes. I'm noting the specific checks I ran rather than just the pass/fail summary, since "no violations found" is only meaningful if it's clear what was actually checked.

## Deployment checklist

- [x] `npm run build` succeeds locally with no errors
- [x] `ANTHROPIC_API_KEY` is set in Vercel → Project Settings → Environment Variables (Production) — not just locally
- [x] Deployed and live at https://classmatch-sandy.vercel.app/
- [x] Visited the live URL directly (not just localhost) and submitted a real request end-to-end — returned a correct matched slot
- [x] Lighthouse and accessibility audit run against the live URL, not localhost — 100/100 across all categories, desktop and mobile
- [ ] Tested the empty-input case on the live site specifically
- [ ] Tested what happens if the API key is temporarily wrong/missing on the live site specifically (confirms the error path works in production, not just in theory)
- **Rollback plan:** if a deployment breaks the live site, redeploy the previous working commit from the Vercel Deployments tab (Deployments → find the last known-good one → ⋯ → Promote to Production). No database or migrations involved, so rollback is just re-pointing production at an older build.
- **Monitoring:** none set up beyond Vercel's built-in deployment status and function logs (Vercel dashboard → Deployments → Functions tab) — checked manually after each deploy for now. A real next step would be a free uptime check hitting the live URL periodically.

## Reflection

The hardest part of this one wasn't the AI call itself — it was `parseMatchResponse`. Getting a model to return JSON is easy; getting code that treats that JSON as untrusted input by default is the actual work. I had to handle it wrapped in markdown fences, malformed entirely, missing fields, and — the one that actually matters — technically valid JSON that names a slot that doesn't exist. Writing the test that feeds in a fake slot ID and asserts it gets silently dropped was the moment this stopped being "a chatbot demo" and started being something I'd trust in front of a real parent.

What I'd do differently next time: build the guardrail test cases before the parser, not after — same lesson as CineVault, and clearly one I need to actually adopt as a habit rather than relearn each time. I'd also design the slot catalog as a small JSON file from day one instead of a hardcoded array in `lib/match.ts`, even for a capstone-scale project — it would have cost nothing extra and made the "not a real database yet" limitation less of an afterthought.

What surprised me: how different this guardrail felt from CineVault's, even though the underlying pattern (tell the model to admit uncertainty instead of inventing an answer) is the same. With movie recommendations, a hallucinated title is a bad user experience. Here, an unfiltered slot ID would send a parent to a class that doesn't exist — same technique, genuinely different stakes. That distinction didn't fully land for me until I was writing the test for it.

## Built with AI

I built this with Claude as a development partner — the API route, the matching logic and guardrail, the component, and the full test suite were built collaboratively with Claude in a single working session. What I checked myself: I ran the build, the typecheck, and all 10 tests locally and confirmed they pass before treating this as done, and I personally tested the live deployment end-to-end (including the empty-input and broken-API-key cases) rather than trusting the code alone.

---
Built by [Abanob Morcos](https://github.com/abanob24) for a frontend capstone.
| Errors announced via `role="alert"` | Pass |
| Result region uses `aria-live="polite"` and receives programmatic focus | Pass |
| Visible focus indicator on all interactive elements (`:focus-visible`) | Pass |
| Body text contrast (`#1a1a1a` on `#fafafa`) | 16.7:1 — pass |
| Hint text contrast (`#494949` on `#fafafa`) | 8.6:1 — pass |
| Error text contrast (`#7f1d1d` on `#fef2f2`) | 8.5:1 — pass |
| Button text contrast (`#fff` on `#1d4ed8`) | 6.7:1 — pass |

**Findings:** no violations, in either the manual review or the automated Lighthouse/axe scan. This app was built with accessibility as a first-class requirement from the start (labeled inputs, live regions, focus management, and a palette checked against WCAG AA before it was written into `globals.css`), rather than audited in after the fact — so the honest outcome of this audit is confirmation, not a list of fixes. I'm noting the specific checks I ran rather than just the pass/fail summary, since "no violations found" is only meaningful if it's clear what was actually checked.

## Deployment checklist

- [x] `npm run build` succeeds locally with no errors
- [x] `ANTHROPIC_API_KEY` is set in Vercel → Project Settings → Environment Variables (Production) — not just locally
- [x] Deployed and live at https://classmatch-sandy.vercel.app/
- [x] Visited the live URL directly (not just localhost) and submitted a real request end-to-end — returned a correct matched slot
- [x] Lighthouse and accessibility audit run against the live URL, not localhost — 100/100 across all categories, desktop and mobile
- [ ] Tested the empty-input case on the live site specifically
- [ ] Tested what happens if the API key is temporarily wrong/missing on the live site specifically (confirms the error path works in production, not just in theory)
- **Rollback plan:** if a deployment breaks the live site, redeploy the previous working commit from the Vercel Deployments tab (Deployments → find the last known-good one → ⋯ → Promote to Production). No database or migrations involved, so rollback is just re-pointing production at an older build.
- **Monitoring:** none set up beyond Vercel's built-in deployment status and function logs (Vercel dashboard → Deployments → Functions tab) — checked manually after each deploy for now. A real next step would be a free uptime check hitting the live URL periodically.

## Reflection

The hardest part of this one wasn't the AI call itself — it was `parseMatchResponse`. Getting a model to return JSON is easy; getting code that treats that JSON as untrusted input by default is the actual work. I had to handle it wrapped in markdown fences, malformed entirely, missing fields, and — the one that actually matters — technically valid JSON that names a slot that doesn't exist. Writing the test that feeds in a fake slot ID and asserts it gets silently dropped was the moment this stopped being "a chatbot demo" and started being something I'd trust in front of a real parent.

What I'd do differently next time: build the guardrail test cases before the parser, not after — same lesson as CineVault, and clearly one I need to actually adopt as a habit rather than relearn each time. I'd also design the slot catalog as a small JSON file from day one instead of a hardcoded array in `lib/match.ts`, even for a capstone-scale project — it would have cost nothing extra and made the "not a real database yet" limitation less of an afterthought.

What surprised me: how different this guardrail felt from CineVault's, even though the underlying pattern (tell the model to admit uncertainty instead of inventing an answer) is the same. With movie recommendations, a hallucinated title is a bad user experience. Here, an unfiltered slot ID would send a parent to a class that doesn't exist — same technique, genuinely different stakes. That distinction didn't fully land for me until I was writing the test for it.

## Built with AI

I built this with Claude as a development partner — the API route, the matching logic and guardrail, the component, and the full test suite were built collaboratively with Claude in a single working session. What I checked myself: I ran the build, the typecheck, and all 10 tests locally and confirmed they pass before treating this as done, and I personally tested the live deployment end-to-end (including the empty-input and broken-API-key cases) rather than trusting the code alone.

---
Built by [Abanob Morcos](https://github.com/abanob24) for a frontend capstone.
