---
inclusion: always
---

# CampusFlow — Tech Steering

## Stack (use these; do not introduce alternatives without a reason)

### Frontend
- **React + Vite + TypeScript**, styled with **Tailwind CSS**.
- Single-page app, mobile-responsive (the demo is shown on a laptop but should look like a phone app).
- Clean, modern, uncluttered UI. Three core screens: (1) Upload/Ingest, (2) Chat/Q&A, (3) Today/Timeline with proactive cards.
- Use `fetch` against API Gateway endpoints. Auth token from Cognito.

### Backend (serverless, all AWS)
- **Amazon API Gateway** (REST) → **AWS Lambda** (Python 3.12) for all backend logic.
- **Amazon DynamoDB** for structured per-student data: schedule items, deadlines, notices, menu, events, preferences. Single-table design keyed by `studentId`.
- **Amazon S3** for raw uploaded files (one prefix per student).
- **Amazon Cognito** user pools for per-student identity and data isolation.

### AI / ML (Amazon Bedrock)
- **Claude (Anthropic) on Bedrock** — primary model for: (a) multimodal extraction from messy screenshots/photos/handwriting → strict JSON; (b) Q&A generation; (c) proactive-nudge reasoning. Prompt it to "return strict JSON; use null for unreadable fields; include a confidence score per field."
- **Amazon Textract** (`AnalyzeDocument` with TABLES + FORMS + LAYOUT) — for clean structured PDFs (timetables, formal notices). Use Textract for precise numeric/table extraction; use Claude vision for messy/unstructured images.
- **Amazon Bedrock Knowledge Bases** — managed RAG. Ingest each student's documents from their S3 prefix → auto-chunk → embed with **Amazon Titan Text Embeddings** → store in **OpenSearch Serverless** → query with `RetrieveAndGenerate` (returns answers WITH source citations).
- **Amazon Bedrock Agents** — orchestration + action-taking. Action groups (backed by Lambda) expose tools: `createReminder`, `scheduleStudyBlock`, `summarizeNotices`, `getTodaySchedule`. This is what makes CampusFlow an OS, not a chatbot.
- **Amazon Nova Micro/Lite on Bedrock** — cheap model for simple high-volume tasks (classification, doc-type routing). Route simple tasks here to show cost-awareness.

### Proactive Engine
- **Amazon EventBridge Scheduler** — one-time + recurring schedules; for each deadline/event, schedule a reminder. On fire → Lambda → invoke Bedrock Agent with student context → if a useful nudge is predicted → **Amazon SNS** publish (and write a proactive card to DynamoDB for the UI).
- **EventBridge rules** for reactive triggers (new notice ingested → re-evaluate alerts).

### Guardrails & Safety
- **Amazon Bedrock Guardrails** on the personal/wellness Q&A path.

## Region
- Use a single region where Bedrock + Claude + Titan + Textract are all available (e.g. `us-east-1`). **Enable Bedrock model access for Claude, Titan Embeddings, and Nova in the console BEFORE coding — this is the #1 early blocker.**

## Cost Discipline (we're on hackathon credits)
- Route simple tasks to Nova Micro. Enable **prompt caching** for repeated context. Use **batch inference** (50% cheaper) for synthetic-data generation. Don't leave OpenSearch Serverless running idle after the build.

## Code Quality
- Type hints + docstrings on all Lambda handlers. One Lambda per logical action. Environment variables for all resource names/ARNs (no hard-coding). Structured logging. Every external call wrapped in try/except with a sensible fallback (the demo must never hard-crash).

## Demo-Safety Fallbacks (build these in from the start)
- If Bedrock Agent orchestration is flaky: fall back to deterministic Lambda + direct `RetrieveAndGenerate` for Q&A, and a pre-seeded EventBridge reminder for the proactive demo.
- If ingestion accuracy is low on a messy image: surface the per-field confidence score and a one-tap "confirm/correct" step — turn the limitation into a feature.
