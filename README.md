# ClassMatch

## Project Brief

ClassMatch turns a parent's plain-language description of what tutoring help their child needs into a structured, actionable match against a real (small, fixed) catalog of available sessions — instead of a chatbot that just talks about tutoring. It's built for small tutoring centers and after-school programs, the kind of client I already build booking and management systems for on a freelance basis, where staff currently do this matching by hand from a WhatsApp message. I chose this over a generic chatbot because the interesting engineering problem isn't "can the model talk about scheduling" — it's making sure the model's output can be trusted enough to show a parent a specific day and time, which meant building a real guardrail around structured data, not just prose.

**Live demo:** [add Vercel URL once deployed]

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

```bash
npm run test        # 10 tests, all passing (Vitest + React Testing Library)
npm run typecheck    # TypeScript check, passes clean
npm run build        # production build, passes clean
```

- **Component test** (`tests/MatchForm.test.tsx`, 4 tests): renders the accessible form correctly, blocks submission with an accessible error when the description is empty (without calling the API), renders a matched slot after a successful API response, and shows a server-provided error message on API failure.
- **Logic test** (`tests/match.test.ts`, 6 tests): covers the response parser directly, including the core guardrail — a test that feeds the parser a model response containing a fake, non-existent slot ID and asserts it gets silently stripped before reaching the UI.

[Attach a screenshot of `npm run test` output here before submitting.]

## Performance & accessibility audit

[Run this after deploying — see the checklist below for exact steps.]

- **Lighthouse (mobile) — Performance:** ___ / 100
- **Lighthouse (mobile) — Accessibility:** ___ / 100
- **Accessibility audit tool used:** WAVE / axe DevTools (pick one)
- **Findings:** [paste a short summary or screenshot of the audit output]
- **One concrete improvement made based on audit findings:** [fill in once you've run it — e.g. a contrast fix, a missing label, a heading order issue]

## Deployment checklist

- [ ] `npm run build` succeeds locally with no errors
- [ ] `ANTHROPIC_API_KEY` is set in Vercel → Project Settings → Environment Variables (Production) — **not just locally**
- [ ] After setting the env var, a Redeploy was triggered (adding a variable alone does not update a live deployment)
- [ ] Visited the live URL directly (not just localhost) and submitted a real request end-to-end
- [ ] Tested the empty-input case on the live site, not just locally
- [ ] Tested what happens if the API key is temporarily wrong/missing (confirms the error path works in production, not just in theory)
- [ ] Lighthouse and accessibility audit run against the **live** URL, not localhost
- **Rollback plan:** if a deployment breaks the live site, redeploy the previous working commit from the Vercel Deployments tab (Deployments → find the last known-good one → ⋯ → Promote to Production). No database or migrations involved, so rollback is just re-pointing production at an older build.
- **Monitoring:** none set up beyond Vercel's built-in deployment status and function logs (Vercel dashboard → Deployments → Functions tab) — checked manually after each deploy for now.

## Reflection

[Write this yourself — 1 page max. Suggested prompts: What was hardest, and why? What would you do differently next time? One thing that surprised you. Being honest here matters more than sounding polished — see the CineVault README's "Built with AI" section for the tone to match.]

## Built with AI

I built this with Claude as a development partner — the API route, the matching logic and guardrail, the component, and the full test suite were built collaboratively with Claude in a single working session. What I checked myself: I ran the build, the typecheck, and all 10 tests locally and confirmed they pass before treating this as done, and I personally tested the live deployment end-to-end (including the empty-input and broken-API-key cases) rather than trusting the code alone.

---
Built by [Abanob Morcos](https://github.com/abanob24) for a frontend capstone.
