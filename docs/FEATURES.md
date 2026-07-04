# CampusFlow — Complete Feature List

> A proactive, personalized AI operating system for student life.
> Built for HackOn with Amazon Season 6.

---

## 🎯 Core Philosophy

CampusFlow is NOT a chatbot that waits to be asked. It's a **proactive, personal agent** that:
- Learns who you are (onboarding + conversation memory)
- Extracts structure from chaos (upload any campus doc → structured data)
- Anticipates what you need (proactive alerts, study plans, deadline reminders)
- Reaches into the world for you (coding contests, opportunities, web search)

---

## 🚀 Feature Breakdown

### 1. PERSONALIZED ONBOARDING (7 steps)

| Step | What | How It's Used |
|------|------|---------------|
| Name | "What's your name?" | Personalized greeting on Today |
| Agent Name | "Name your assistant" | Agent refers to itself by this name everywhere |
| Priorities | Multi-select: Academics, Placements, Fitness, Clubs, Projects | Gates what content is surfaced (contests, opportunities) |
| Placement Focus | Yes actively / Soon / Not yet | Surfaces coding contests + placement drives |
| End-Sem Date | Date picker | Ramps exam focus as date approaches |
| Focus Time | Morning / Night owl / Flexible | Suggests study blocks in productive window |
| Initial Goal | Free text ("solve PYQs before end-sems") | Seeds first intent for proactive nudges |

- Shows only once (persisted `profileComplete` flag)
- Skippable with sensible defaults
- Answers directly change agent behavior (not decorative)

---

### 2. MULTIMODAL DOCUMENT INGESTION

**Upload any campus document → AI extracts structured data**

| Document Type | What's Extracted |
|---------------|-----------------|
| Mess Menu (PDF/image) | Day × Meal × Items (breakfast/lunch/snacks/dinner) |
| Class Timetable | Day × Time × Subject × Room × Professor |
| Placement Notice | Company, Role, CTC, CGPA cutoff, Test date, Registration deadline |
| Hostel Notice | Title, Body, Date, Category + embedded deadlines |
| Assignment/Deadline | Title, Subject, Due date, Description |

**How it works:**
- PDF → PyMuPDF text extraction → Ollama/Groq text model → structured JSON
- Image (PNG/JPG) → Groq Vision (Llama 4 Scout) → structured JSON
- Scanned PDF (no text) → rendered to image → Groq Vision
- Per-field confidence scores (0-1)
- Low-confidence fields show "Confirm" button
- Graceful fallback to stub data if AI fails

---

### 3. INTELLIGENT Q&A CHATBOT

**Ask anything about your campus life — grounded answers from YOUR data**

| Capability | Example |
|-----------|---------|
| Schedule queries | "What classes do I have on Tuesday?" |
| Menu queries | "What's for dinner today?" |
| Deadline queries | "When is my DBMS assignment due?" |
| Placement queries | "When is the Amazon test?" |
| Contest queries | "Any upcoming coding contests?" |
| Notice queries | "Any hostel notices?" |
| Contextual follow-up | Remembers last 10 messages for conversation continuity |

**Anti-hallucination:**
- Answers ONLY from uploaded/stored data
- Source tags on every answer (mess_menu, timetable, placements, etc.)
- "I don't have that information" when data is missing
- Today's date injected so "today/tomorrow" works correctly

---

### 4. INTENT MEMORY & ACTION SYSTEM

**The agent remembers goals and acts on them**

| Intent Type | Example | What Happens |
|-------------|---------|--------------|
| ADD_DEADLINE | "add deadline for CGV assignment Monday" | Creates with resolved date, shows in Today |
| ADD_PLAN | "create a 3 day gym plan" | Generates steps via AI, stored as checkable subtasks |
| ADD_INTENT | "I need to solve PYQs before end-sems" | Stored as open goal, referenced in proactive nudges |
| COMPLETE_INTENT | "I finished the PYQs" | Marks done, stops nudging |
| ADD_EVENT | "add event hackathon July 15" | Stored in events |
| UPDATE_MENU | "update Monday lunch to Rice, Dal" | Replaces that meal entry |
| UPDATE_TIMETABLE | "change Monday 9am to Maths in LH-301" | Updates that slot |
| UPDATE_PLACEMENT | "update Amazon test date to July 20" | Updates field |
| REMOVE_DEADLINE | "remove the maths deadline" | Fuzzy match removes it |
| REMOVE_ALL_DEADLINES | "remove all deadlines" | Only deadlines (menu/timetable untouched) |
| REMOVE_TIMETABLE | "clear my schedule" | Only classes |
| REMOVE_MENU | "remove mess menu" | Only menu |
| REMOVE_ALL | "clear everything" | Full reset |

---

### 5. PROACTIVE AI ENGINE

**The agent acts AHEAD of you — doesn't wait to be asked**

| Trigger | What Happens |
|---------|--------------|
| Deadline within 72h | Alert card: "⚠️ DBMS due in 2 days!" |
| Deadline within 24h | Urgent card: "🚨 Due tomorrow!" |
| Placement test approaching | "Your Amazon test is in 3 days — how's your DSA prep?" |
| Open intent + related event | "You wanted to solve PYQs — your end-sem schedule just arrived" |
| Coding contest upcoming | "Codeforces Div 3 starts tomorrow — want a reminder?" |
| Daily schedule | "3 classes today. First: DSA at 9:00 in LH-301" |

**Personalization:**
- Uses profile priorities to weight what's surfaced
- References open intents when relevant
- Uses agent's chosen name in all messages
- Placement-focused users get contest nudges; fitness users get workout reminders

---

### 6. GOAL TRACKING WITH SUBTASKS

**Plans appear as expandable checklists in the Today tab**

- ▶ Click to expand goal → see individual steps with checkboxes
- Check individual steps → progress bar fills
- Check ALL steps → goal auto-completes and disappears
- Progress shown as "2/5 done" badge
- Works for gym plans, study plans, project plans — anything

---

### 7. EMAIL ALERTS (AWS SNS)

**Real email notifications for approaching deadlines**

- Triggered when visiting Today tab (checks all deadlines)
- Sends to confirmed email via AWS SNS
- Urgency levels: "Due in 3 days" → "Due tomorrow" → "🚨 URGENT"
- One email per deadline (never spams)
- Includes: title, subject, due date, description

---

### 8. CODING CONTEST INTEGRATION

**Real-time contest data from Codeforces + LeetCode**

| Source | Data |
|--------|------|
| Codeforces API | Upcoming rounds (Div 1/2/3), start times, duration, direct links |
| LeetCode GraphQL | Weekly/Biweekly contests, start times, links |

- Visible in Today tab (🏆 Upcoming Contests section)
- Clickable links open contest pages
- Only shown for placement/CP-focused users (profile-gated)
- Cached 1 hour to respect rate limits
- Answerable via chat: "any contests this week?"

---

### 9. WEB DISCOVERY & OPPORTUNITIES

**Agent discovers relevant content from the internet, filtered by your profile**

| Priority | What's Surfaced |
|----------|----------------|
| Placements | Internship articles, coding interview prep, career tips |
| Academics | Programming tutorials, CS content, study resources |
| Fitness/Health | Fitness articles, health tips, productivity content |
| Clubs & Events | Hackathon listings, open source, community posts |
| Personal Projects | Side project ideas, webdev tutorials, beginner guides |

- Sources: dev.to API (free, no key required)
- Profile-gated: different priorities → different feed
- Intent-aware: gym intent → fitness articles appear
- Cached 1 hour
- Visible in Today tab (🌐 Discover section)
- MCP-equivalent: `/fetch` endpoint reads any URL, `/search` endpoint discovers content

---

### 10. CONVERSATIONAL MEMORY

**The agent remembers what was said earlier in the conversation**

- Last 10 messages sent with every query
- Recent 4 messages included in intent classifier (prevents mis-classification of follow-up answers)
- Chat history persists across tab switches and page refreshes (localStorage)
- Agent can ask follow-up questions and process your answers contextually

---

### 11. ADAPTIVE FOLLOW-UP QUESTIONS

**Agent deepens personalization through conversation**

- After onboarding, first chat message is a personalized intro + follow-up question
- Questions derived from profile: "You're placement-focused — which companies are you targeting?"
- Answers stored to influence future nudges
- Agent asks relevant follow-ups later (after placement notice upload: "Want me to track coding contests?")

---

### 12. TODAY DASHBOARD

**Everything at a glance — your day, personalized**

| Section | Content |
|---------|---------|
| Greeting | "Good morning, [Name]" + day + date |
| ⚡ Heads Up | Urgency-sorted proactive cards (deadlines, placements, events) |
| 🤖 [Agent] Says | AI-generated personalized nudges |
| 📅 Today's Classes | Filtered to today's weekday |
| ⏰ Deadlines | All upcoming, sorted by date |
| 🍽️ Today's Menu | Correct day's breakfast/lunch/snacks/dinner |
| 📢 Notices | Category-tagged (hostel, academic, placement, event) |
| 🎯 Your Goals | Expandable checklists with subtask progress |
| 🏆 Upcoming Contests | Codeforces + LeetCode (placement users) |
| 🌐 Discover | Profile-gated articles and opportunities |

---

## 🏗️ Technical Architecture

### Frontend
- React 18 + Vite 5 + TypeScript + Tailwind CSS
- Single-page app, mobile-responsive (phone form factor)
- Single localStorage store (source of truth for all data)
- `useSyncExternalStore` for reactive updates

### Backend (Local)
- FastAPI (Python) on port 8000
- Ollama (gemma3:4b) for text — unlimited, local, no API key
- Groq (Llama 4 Scout) for vision — free tier
- PyMuPDF for PDF text extraction
- `local_db.json` for server-side persistence

### AWS Infrastructure (Provisioned)
- S3 bucket (`campusflow-uploads-070025263888`)
- DynamoDB table (defined in SAM, single-table design)
- Bedrock Knowledge Base (`L3NBNFWWWM`) + OpenSearch Serverless
- Cognito User Pool (provisioned, not enforced)
- SNS Topic (email alerts, confirmed subscription)
- EventBridge Scheduler (hourly proactive checks)
- SAM template ready for `sam deploy`

### AI Models

| Task | Model | Provider |
|------|-------|----------|
| Q&A, intents, plans, proactive | gemma3:4b | Ollama (local) |
| Image/document vision | Llama 4 Scout 17B | Groq (free) |
| Embeddings (RAG, future) | Titan Text V2 | AWS Bedrock |
| Production extraction (future) | Claude 3 Sonnet | AWS Bedrock |

### External APIs (Free, No Keys)
- Codeforces API — contest data
- LeetCode GraphQL — contest data
- dev.to API — tech articles/opportunities
- AWS SNS — email alerts

---

## 🔄 Fallback Chain

```
Ollama (local, unlimited)
  ↓ (if down)
Groq (free tier, 12K TPM)
  ↓ (if rate limited)
Client-side stub data (never crashes)
```

---

## 📱 Demo Flow (3 minutes)

1. **Onboarding** → Name: Sparsh, Agent: Luffy, Priorities: Placements + Academics
2. **Upload mess menu** → AI extracts 7 days × 4 meals → Today shows Friday's food
3. **Upload timetable** → Today shows Friday's classes
4. **Upload placement notice** → Amazon SDE appears + proactive card asks about prep
5. **Chat: "create a 3 day gym plan"** → AI generates steps → Goals section with checkboxes
6. **Chat: "any coding contests?"** → Real Codeforces data returned
7. **Chat: "when is Amazon test?"** → Grounded answer with source
8. **Chat: "I need to solve PYQs before end-sems"** → Stored as intent
9. **Today tab** → Contests, opportunities, goals, AI nudges all visible
10. **Check email** → Deadline alert received via SNS

---

## 📊 By The Numbers

| Metric | Value |
|--------|-------|
| Frontend screens | 4 (Onboarding, Today, Upload, Chat) |
| Backend endpoints | 8 (ingest, query, proactive, contests, search, fetch, opportunities, data) |
| Intent types handled | 14 |
| Document types extracted | 5 (menu, timetable, placement, notice, deadline) |
| AI models used | 3 (gemma3:4b, Llama 4 Scout, Titan V2) |
| External APIs | 4 (Codeforces, LeetCode, dev.to, AWS SNS) |
| AWS services provisioned | 7 (S3, DynamoDB, Knowledge Base, OpenSearch, Cognito, SNS, EventBridge) |
| Rate limit: text calls | ∞ (local Ollama) |
| Rate limit: vision calls | 12K TPM (Groq free) |
| Data persistence | localStorage + local_db.json |

---

*Built by Team CampusFlow — HackOn with Amazon Season 6*
*July 2026*
