# CampusFlow — Personalization Feature Spec (for Kiro)

> Build this as ONE complete feature. It adds personalization to CampusFlow: an onboarding profile, an intent-memory system, and a personalized proactive engine. Everything integrates with the existing shared store (localStorage) and the existing Groq backend. Test every acceptance check before reporting done.

---

## 1. GOAL (what we're building and why)

Right now CampusFlow's proactive alerts are generic ("DBMS due in 9 hours"). This feature makes them **personal**: CampusFlow learns each student's goals, priorities, and routine, and remembers things they say they need to do — then tailors every nudge to them.

**Two concrete target behaviors (must work):**
1. A placement-focused student, when a placement test is near, gets: *"Your Amazon test is in 3 days — how's your DSA prep going? Want me to block practice time?"*
2. A student who earlier said *"I need to solve PYQs before end-sems"* — when an end-sem timetable is later uploaded — gets: *"Your end-sem timetable just arrived. You mentioned wanting to solve PYQs first — want me to plan that?"*

---

## 2. THE THREE PARTS

### PART A — Onboarding Profile (first-time question set)

On first app open (no profile in store), show a short, friendly onboarding flow (4–6 questions, tappable options — not a long form). Store answers in the shared store under `profile`.

**Questions (keep it short and tappable):**
1. "What's your name?" → text (default "Aarav" for demo)
2. "What are you focused on right now?" → multi-select: `Academics`, `Placements`, `Fitness/Health`, `Clubs & Events`, `Personal projects`
3. "Are you preparing for placements/internships?" → `Yes, actively` / `Soon` / `Not yet`
4. "When are your end-sem exams?" → optional date (or "Not sure yet")
5. "When do you focus best?" → `Morning person` / `Night owl` / `Flexible`
6. "Anything specific you want to stay on top of?" → free text (e.g. "solve PYQs before end-sems", "gym 3x a week") → this seeds the first INTENT (see Part B)

**Storage shape:**
```json
"profile": {
  "name": "Aarav",
  "priorities": ["Academics", "Placements"],
  "placementFocus": "Yes, actively",
  "endSemDate": "2026-07-25",
  "focusTime": "Night owl",
  "createdAt": "..."
}
```

- Onboarding shows only once; store a `profileComplete: true` flag. Add a way to re-open/edit it later (a small "Edit profile" in settings or Today).
- If skipped, use sensible defaults so the demo never blocks.

### PART B — Intent Memory (remember what the student says they need to do)

The student can state intents in natural language, in chat or in onboarding Q6. Examples: "I need to solve PYQs before end-sems", "remind me to prepare for the Amazon test", "I want to hit the gym 3 times a week".

- Detect these via Groq intent classification (add a new intent type `ADD_INTENT` to the existing chat intent detector).
- Store each as an intent item:
```json
"intents": [
  {
    "id": "intent_1",
    "text": "solve PYQs before end-sems",
    "topic": "PYQs",
    "relatedTo": "end-sems",
    "status": "open",
    "createdAt": "..."
  }
]
```
- Intents are **open** until the student says they're done ("I finished the PYQs" → mark `done`) or they're no longer relevant.
- The chat should confirm: "Got it — I'll remind you about solving PYQs before your end-sems."

### PART C — Personalized Proactive Engine (the payoff)

Upgrade the existing proactive Lambda/endpoint so nudges use **profile + intents + upcoming events**. When generating a proactive card/message, build a context object and pass it to Groq:

```
context = {
  profile: {name, priorities, placementFocus, focusTime, endSemDate},
  openIntents: [...],
  upcoming: { deadlines, placementTests, classesToday, newlyUploadedDocs }
}
```

**Groq prompt for personalized nudges (system):**
> "You are CampusFlow, a proactive student assistant. Using the student's profile, their open intents, and upcoming events, write ONE short, warm, specific nudge (max 2 sentences). Personalize to their priorities and reference their stated intents when relevant. If they're placement-focused and a test is near, ask about their prep. If they mentioned an intent (e.g. solving PYQs) and a related event appears (e.g. end-sem timetable), reference it. If fitness is a priority, protect their workout time when suggesting study blocks. Be encouraging, never nagging."

**Trigger rules (when to generate personalized nudges):**
- A deadline/test is within the alert window → nudge referencing their prep/priorities.
- A new document is uploaded that relates to an open intent → nudge connecting them (e.g. end-sem timetable + PYQ intent).
- A daily "here's your focus today" summary that reflects their priorities and focus-time.

---

## 3. INTEGRATION POINTS (use existing systems)

- **Shared store:** add `profile`, `intents` alongside existing classes/deadlines/menu. Persist to localStorage. Everything reads/writes here.
- **Chat intent detector:** extend the existing classifier with `ADD_INTENT` and `COMPLETE_INTENT` (mark intent done).
- **Proactive engine:** modify the existing proactive message generation to include profile + intents in the Groq context. Keep the 60s cache to save rate limits.
- **Groq:** all generation uses the existing Groq text provider. No new external dependency.
- **Onboarding UI:** a new first-run screen; match the existing premium UI style (same fonts/colors/animation feel).

---

## 4. ACCEPTANCE CHECKS (must all pass before done)

- [ ] First app open (cleared store) shows onboarding; answers save to `profile`; onboarding doesn't reappear after completion.
- [ ] Profile can be edited later.
- [ ] In onboarding Q6, entering "solve PYQs before end-sems" creates an open intent.
- [ ] In chat, "I need to solve PYQs before my end-sems" creates an open intent and confirms.
- [ ] With profile.priorities including "Placements" AND a placement test within the window → proactive card asks about prep (e.g. "how's your DSA prep going?").
- [ ] With an open "PYQs before end-sems" intent, uploading an end-sem timetable (a deadline/notice mentioning end-sems) → a proactive nudge references the PYQ intent.
- [ ] "I finished the PYQs" → marks that intent done; it stops appearing in nudges.
- [ ] All personalized messages are real Groq output (not templates), and reflect the actual profile/intents.
- [ ] Everything persists across tab switches + refresh.
- [ ] Nothing breaks existing features (upload, Q&A, deadlines, menu, email).

Report PASS/FAIL for each. Fix all FAILs before saying done.

---

## 5. DEMO SCRIPT THIS ENABLES (for the mentor)

1. Fresh open → onboarding: "I'm placement-focused, end-sems July 25, and I need to solve PYQs before then."
2. Today tab → personalized greeting reflecting priorities.
3. Upload placement notice (Amazon test soon) → proactive card: *"Your Amazon test is in a few days — how's your DSA prep? Want me to block practice time?"*
4. Upload an end-sem timetable → proactive nudge: *"Your end-sem schedule arrived — you wanted to solve PYQs first. Want me to plan that?"*
5. Chat: "I finished the PYQs" → CampusFlow acknowledges and stops nudging about it.

This directly demonstrates the mentor's feedback: personalization + intent-aware proactivity.

---

## 6. EXACT FILES TO CREATE / MODIFY

**Frontend:**
- `frontend/src/screens/Onboarding.tsx` — NEW. First-run question flow (tappable options, matches existing premium UI). Writes to store `profile`.
- `frontend/src/lib/store.ts` — MODIFY. Add `profile` and `intents` to the persisted store, with helpers: `getProfile()`, `setProfile()`, `isProfileComplete()`, `addIntent()`, `getOpenIntents()`, `completeIntent(id)`.
- `frontend/src/App.tsx` — MODIFY. On load, if `!isProfileComplete()` → route to Onboarding first.
- `frontend/src/screens/Today.tsx` — MODIFY. Personalized greeting using profile name + priorities. Add small "Edit profile" affordance.
- `frontend/src/screens/Chat.tsx` — MODIFY. Handle new intents (ADD_INTENT, COMPLETE_INTENT) in the response rendering.

**Backend:**
- `backend/local_server.py` (or the query/proactive handlers) — MODIFY:
  - Extend the chat intent classifier to also return `ADD_INTENT` and `COMPLETE_INTENT`.
  - `/proactive/<studentId>` — build the personalization context (profile + open intents + upcoming) and pass to Groq for nudge generation.
  - Accept profile + intents from the frontend request (since data lives client-side in localStorage, the frontend should POST the relevant profile/intents/data with proactive + query calls, OR keep a synced copy server-side — pick the simplest that works with our current setup; if data is already sent with /query and /proactive, just include profile + intents in that same payload).

---

## 7. TECHNICAL NOTES / DECISIONS

- **Where data lives:** we currently persist everything client-side in localStorage and send needed data to the backend per request. Keep that pattern — the frontend sends `profile` and `intents` along with the existing data payload on `/proactive` and `/query` calls. No new database needed.
- **Intent classification:** reuse the ONE Groq call that already classifies chat intent. Add `ADD_INTENT` (student states something they want to stay on top of) and `COMPLETE_INTENT` (student says they finished something). Return `{intent, fields}` as today.
- **Rate limits:** keep the existing 60s cache on proactive generation. Personalized nudges use the same cached call — don't add extra Groq calls per render.
- **Fallback:** if Groq fails, fall back to a simple non-personalized proactive card (existing behavior) so the demo never breaks.
- **Determinism for demo:** the personalized nudge should reliably reference an open intent when a related doc/deadline exists — make the Groq prompt explicit about this so the demo behaviors in §1 fire consistently.

---

## 8. EDGE CASES TO HANDLE

- No profile yet → onboarding shows; proactive falls back to generic until profile exists.
- Profile exists but no intents → nudges personalize on priorities only.
- Multiple open intents → the nudge references the MOST relevant one to the current event (don't dump all intents).
- Intent already marked done → never referenced again.
- Student edits profile → new priorities take effect on next proactive generation.
- Onboarding skipped → sensible defaults (name "Aarav", priorities ["Academics"]), demo still works.

---

## 9. BUILD ORDER (do in this sequence, test each)

1. Store: add `profile` + `intents` + helpers, persisted to localStorage. Verify persistence.
2. Onboarding screen + first-run routing. Verify it shows once and saves profile.
3. Personalized greeting on Today (quick win, proves profile is read).
4. Intent capture in chat (ADD_INTENT / COMPLETE_INTENT) + onboarding Q6 seeding an intent.
5. Personalized proactive engine (profile + intents in Groq context).
6. Run all acceptance checks in §4 + the demo script in §5.

Report PASS/FAIL for every §4 check. Fix all FAILs before reporting done. Do NOT break any existing feature (upload, extraction, Q&A, deadlines, menu, email alerts, chat persistence).

---

## 10. DEEPER PERSONALIZATION (mentor feedback — MUST ADD)

The current onboarding collects answers but does NOT use them to shape the agent. Fix these three things:

### 10.1 — Custom agent name (user names their assistant)
- In onboarding, add: "What would you like to name your assistant?" → text input (default suggestion "Flow"). Store as `profile.agentName`.
- Use `agentName` everywhere the assistant refers to itself: chat responses ("I'm Flow, here's what's coming up..."), proactive nudges, greetings. The agent has an identity the user chose.
- Example: user names it "Nova" → all messages come from "Nova", e.g. "Nova here — your Amazon test is in 3 days."

### 10.2 — Actually USE the onboarding answers (optimize the agent)
The onboarding answers must change agent behavior, not just sit in storage:
- `priorities` → proactive engine weights nudges toward these (placement-focused → contest/test nudges; fitness → protect workout time; academics → deadline focus).
- `focusTime` (morning/night) → when suggesting study blocks, schedule them in the user's productive window.
- `placementFocus` → if "Yes, actively", surface placement drives + coding-contest updates prominently.
- `endSemDate` → count down to end-sems and prioritize exam-related intents as the date approaches.
- Pass ALL of this in the Groq context for every proactive/personalized generation, and instruct Groq to explicitly use it.

### 10.3 — Adaptive follow-up questions (agent asks its OWN questions based on answers)
The agent must ask NEW questions based on what the user answered — not a fixed list:
- After initial onboarding, run a Groq call: given the user's answers, generate 1–3 smart follow-up questions that deepen personalization.
- Examples:
  - User said "Placements: yes, actively" → agent asks: "Which companies are you targeting?" and "What's your current DSA prep level?"
  - User said "Fitness is a priority" → agent asks: "What days/times do you usually work out, so I can protect them?"
  - User said "I need to solve PYQs before end-sems" → agent asks: "Which subjects' PYQs are highest priority?"
- Store the answers as additional profile fields / intents. These follow-ups make the profile richer over time.
- Implement as: onboarding core questions → Groq generates adaptive follow-ups from the answers → user answers → stored. The agent can also ask a follow-up later in chat when relevant (e.g., after a placement notice is uploaded, "You're targeting SDE roles — want me to track coding contests for practice?").

**Acceptance additions:**
- [ ] User can name the agent; the chosen name is used in all agent messages.
- [ ] Onboarding answers measurably change proactive output (placement-focused user gets different nudges than fitness-focused user — verify with two different profiles).
- [ ] After onboarding, the agent asks at least one adaptive follow-up question derived from the user's answers.
- [ ] Follow-up answers are stored and influence later nudges.

---

## 11. NEW SCOPE — RAG + CODING-CONTEST UPDATES (mentor feedback)

The mentor asked to (a) implement RAG to increase scope, and (b) integrate free coding-contest data so the agent can surface recent/upcoming contests and questions.

### 11.1 — Coding-contest integration (do the simple, reliable version)
- Add a backend endpoint `/contests` that fetches upcoming contests from a FREE public API. Use one of:
  - competeapi: `https://competeapi.vercel.app/contests/upcoming/` (Codeforces + CodeChef + LeetCode, JSON: title, startTime, duration, url)
  - OR Codeforces official API `https://codeforces.com/api/contest.list` (anonymous, public; rate limit 1 req / 2 sec — cache results).
- Cache results (e.g. 1 hour) to respect rate limits.
- Surface contests in the app:
  - A "Coding Contests" section (for users whose priorities include Placements or Competitive Programming).
  - Proactive nudges: "Codeforces Round 1107 (Div 3) starts in 2 days — want a reminder?" (only for interested users, per profile).
  - Q&A: "any contests this week?" → answers from fetched contest data.
- MCP: integrate the Codeforces MCP (Mohamed Hanfy, Docker, public API) and/or LeetCode MCP (jinzcdev, NPM) as the PRIMARY path — see Section 12 for full MCP integration. Contests are one use of MCP; Section 12 expands this to web search + fetch for opportunities and news.

### 11.2 — RAG (increase scope, grounded answers over a knowledge base)
- We already have Bedrock Knowledge Base + OpenSearch provisioned (KB id L3NBNFWWWM) but not fully wired. For now, implement a LIGHTWEIGHT RAG that works with our current Groq setup:
  - Index the student's uploaded documents (chunk + embed) into a local vector store (e.g. FAISS or a simple in-memory cosine-similarity over embeddings) OR keep using the existing structured store for retrieval.
  - For a question, retrieve the most relevant chunks and pass them to Groq for a grounded, cited answer.
  - This upgrades Q&A from "we send all data" to "we retrieve the relevant pieces" — true RAG, scales to many documents.
- For embeddings without Bedrock: use a free embedding option (small sentence-transformers model locally, or a free embedding API). 
- IMPORTANT: RAG scope is NOT limited to the student's own documents. See Section 12 — RAG also covers web-discovered opportunities, alerts, and educational news pulled via MCP. That web-scope RAG is the mentor's main ask for "increasing scope."
- Keep the Bedrock KB path (id L3NBNFWWWM) flag-toggled for when AWS access is restored.

**Acceptance additions:**
- [ ] `/contests` returns real upcoming contests from a free API, cached.
- [ ] Contest info appears in the app and in Q&A ("any contests this week?").
- [ ] Contest nudges only shown to users whose profile indicates interest (placements / competitive programming).
- [ ] (RAG) Q&A retrieves relevant chunks rather than dumping all data, with citations — OR the RAG path is documented and stubbed if not feasible tonight.

---

## 12. MCP INTEGRATION + BROAD-SCOPE RAG (mentor priority — build this properly)

The mentor wants (a) MCP integration (not avoided — actually done), and (b) RAG that INCREASES SCOPE by searching the web for opportunities, alerts, hackathons, scholarships, internships, and educational news relevant to campus students. Build both. MCP is the mechanism the agent uses to reach the outside world.

### 12.1 — MCP servers to integrate (all free, no paid keys)
Connect these real MCP servers so the agent can access external tools:
- **Fetch MCP** (official: `@modelcontextprotocol/server-fetch` / `mcp-server-fetch`) — fetches any web page and converts to markdown. Free, no API key. Use to READ specific pages (a scholarship page, a hackathon listing, a college notice URL).
- **Web Search MCP** (free, DuckDuckGo-based, e.g. `web-search-mcp` using the ddgs library) — searches the web (text + NEWS) with NO API key. Use to DISCOVER opportunities and educational news.
- **Codeforces MCP** (Mohamed Hanfy, Docker, public API, no credentials) — contest standings, ratings, recent submissions, upcoming contests.
- **LeetCode MCP** (jinzcdev, NPM/NPX) — problem details, contests, editorials.
Discover more via the Official MCP Registry (registry.modelcontextprotocol.io) and github.com/modelcontextprotocol/servers.

Config pattern (MCP client config, like Claude Desktop's mcpServers block):
```json
{
  "mcpServers": {
    "fetch":  { "command": "uvx", "args": ["mcp-server-fetch"] },
    "search": { "command": "web-search-mcp" },
    "codeforces": { "command": "docker", "args": ["run","-i","--rm","codeforces-mcp"] },
    "leetcode": { "command": "npx", "args": ["-y","@jinzcdev/leetcode-mcp-server"] }
  }
}
```

**Implementation note for our stack:** our backend calls Groq (not an MCP-native host). Two options — pick the one that works reliably tonight:
- **Option 1 (recommended):** run the MCP servers and call their tools from our backend via an MCP client library (Python MCP SDK / stdio), then feed results to Groq. This is "true MCP" as the mentor asked.
- **Option 2 (fallback if MCP client wiring is too slow tonight):** the SAME servers wrap public APIs (DuckDuckGo, Codeforces API, LeetCode API). If MCP client wiring stalls, call those underlying APIs directly to keep the feature working, and keep the MCP integration as the primary/most-visible path. DO NOT skip MCP just because the direct API is easier — the mentor specifically wants MCP; make MCP the main path and only fall back if it genuinely won't work in time.

### 12.2 — What the agent DISCOVERS (the scope expansion)
Using Web Search MCP + Fetch MCP, the agent proactively finds and surfaces, relevant to the student's profile:
- **Opportunities:** internships, hackathons, scholarships, competitions, open-source programs (GSoC-style), fellowships.
- **Coding-contest updates:** upcoming Codeforces/LeetCode/CodeChef contests (via the CP MCPs), recent problems, ratings.
- **Educational news:** exam notifications, placement news, tech/industry news relevant to students, new courses.
- **Campus/academic alerts:** deadlines, admit cards, results (where publicly searchable).

Personalization gates ALL of this: a placement-focused CSE student sees SDE internships + coding contests; a research-leaning student sees fellowships + papers; fitness priority stays out of their opportunity feed. Use the profile + intents to filter what's surfaced.

### 12.3 — RAG over discovered + uploaded content
- Combine two knowledge sources: (a) the student's uploaded docs, and (b) freshly fetched web content (opportunities/news).
- Chunk + embed both into a vector store; retrieve the most relevant chunks for a query; Groq generates a grounded, cited answer.
- Example queries the agent can now answer: "any hackathons I can apply to this month?", "upcoming Codeforces contests?", "scholarships for CSE students?", "what's the latest on campus placements?"
- Cite the source (which web page / which uploaded doc). Cache fetched content (~1 hour) to respect rate limits.
- Keep the Bedrock Knowledge Base (id L3NBNFWWWM) as the production RAG path, flag-toggled for when AWS access returns; use a local/Groq-compatible vector path until then.

### 12.4 — Proactive use of discovered opportunities
The proactive engine now also surfaces timely external opportunities as nudges (gated by profile):
- "A hackathon matching your interests opens registration in 3 days — want details?"
- "Codeforces Round 1107 (Div 3) starts tomorrow — want a reminder?"
- "New Amazon SDE internship listing just went up — deadline in 5 days."

**Acceptance additions:**
- [ ] At least one MCP server (Fetch or Web Search) is integrated and called by the agent (true MCP path). Demonstrate a real fetch/search through MCP.
- [ ] Codeforces/LeetCode contest data is retrieved (via CP MCP or its API) and surfaced.
- [ ] The agent DISCOVERS external opportunities/news via web search and surfaces them, filtered by profile.
- [ ] RAG answers questions grounded in BOTH uploaded docs AND fetched web content, with citations.
- [ ] Proactive nudges include relevant external opportunities (profile-gated).
- [ ] All external fetches cached; graceful fallback if a server/API is down.
