# CampusFlow — Steering: Personalization & Intelligence Layer

> Steering document. Defines HOW to build CampusFlow's personalization, MCP, and broad-scope RAG. Keep in .kiro/steering/. Detailed tasks are in PERSONALIZATION_SPEC.md.

## Product principle
CampusFlow is a PROACTIVE, PERSONAL agent — not a generic chatbot. Every feature must make the assistant feel like it knows THIS student and acts ahead of them, reaching into the wider world for opportunities relevant to them.

## The agent has an identity
- The user names the agent in onboarding (`profile.agentName`, default "Flow").
- The agent refers to itself by that name in ALL messages.
- Voice: warm, encouraging, concise. Never naggy, never generic.

## Onboarding answers are DIRECTIVES, not decoration
- Every onboarding answer MUST change agent behavior. If an answer doesn't affect output, it's wrong.
- priorities → weight nudges. placementFocus → surface placements + contests + internships. focusTime → schedule study blocks in the user's productive window. endSemDate → ramp exam focus as it nears.
- Pass full profile + open intents into Groq context for every personalized generation; instruct Groq to use them explicitly.

## The agent asks its OWN questions (adaptive)
- After core onboarding, generate 1–3 follow-up questions from the user's answers (Groq). Ask more later in chat when relevant.
- The profile deepens over time through conversation, not a static one-time form.

## Intent memory
- Remember what the user says they need to do ("solve PYQs before end-sems") as trackable intents (open/done).
- Connect open intents to NEW events: when a related doc/deadline/opportunity appears, reference the intent in a nudge. Make this reliable — it's the magic moment.

## MCP is a first-class mechanism — DO IT, don't avoid it
- The agent reaches the outside world through MCP servers. Integrate real, FREE MCP servers:
  - Fetch MCP (official, no key) — read any web page.
  - Web Search MCP (DuckDuckGo/ddgs, no key) — search web + news.
  - Codeforces MCP (Hanfy, Docker, public API) and LeetCode MCP (jinzcdev, NPM) — contests/problems.
- MCP is the PRIMARY path. Only if MCP client wiring genuinely won't work in time, fall back to the same servers' underlying public APIs — but keep MCP as the main, visible integration. Do NOT talk yourself out of MCP; the mentor specifically wants it.

## RAG = BROAD scope (the mentor's "increase scope" ask)
- RAG is NOT limited to the student's own uploaded docs. The agent SEARCHES THE WEB (via MCP) for opportunities, alerts, and educational news for campus students: internships, hackathons, scholarships, competitions, coding contests, exam/placement news, industry/tech news.
- Combine two knowledge sources in RAG: uploaded docs + freshly fetched web content. Chunk → embed → retrieve → generate with Groq → CITE the source.
- Personalization gates what's surfaced: placement-focused CSE student sees SDE internships + coding contests; research student sees fellowships/papers. Profile + intents filter the feed.
- Proactive engine surfaces timely external opportunities as nudges (profile-gated): "a hackathon matching your interests opens in 3 days...", "Codeforces Round tomorrow — want a reminder?", "new SDE internship, deadline in 5 days."
- Cache fetched content (~1 hour). Keep Bedrock KB (id L3NBNFWWWM) as the flag-toggled production RAG path.

## Engineering rules (don't break these)
- ONE shared persistent store (localStorage) is the single source of truth. Every screen reads/writes it. Never a second, out-of-sync store.
- All generation uses the existing Groq provider behind our interface. Bedrock path stays flag-toggled for when access returns.
- Respect rate limits: 60s proactive cache; ~1 hour cache on web/contest fetches.
- Every capability FALLS BACK gracefully (if an MCP server / API / Groq fails, show a sensible non-personalized version — never crash the demo).
- Never show fake/stub data when real data exists.
- Persist across tab switches + refresh, always.

## Definition of done
- Two different profiles produce visibly different proactive output (personalization is real).
- The agent uses its user-chosen name everywhere.
- The agent asks at least one adaptive follow-up derived from answers.
- A remembered intent is referenced when a related event/opportunity appears.
- At least one MCP server (Fetch or Web Search) is genuinely integrated and called — demonstrate a real search/fetch through MCP.
- Coding-contest data retrieved (via CP MCP or API) and surfaced.
- The agent DISCOVERS external opportunities/news via web search and surfaces them, profile-gated.
- RAG answers grounded in BOTH uploaded docs AND fetched web content, with citations.
- Nothing existing breaks (upload, extraction, Q&A, deadlines, menu, email, chat persistence).
- Report PASS/FAIL for every acceptance check in PERSONALIZATION_SPEC.md §4, §10, §11, §12.
