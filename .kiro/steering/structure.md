---
inclusion: always
---

# CampusFlow — Structure Steering

## Repository Layout
```
campusflow/
├── .kiro/
│   ├── steering/          # product.md, tech.md, structure.md (these files)
│   ├── specs/             # one spec folder per feature (see below)
│   └── hooks/             # event-driven automations
├── frontend/              # React + Vite + TS app
│   ├── src/
│   │   ├── screens/       # Ingest.tsx, Chat.tsx, Today.tsx
│   │   ├── components/    # UploadCard, ChatBubble, ProactiveCard, ...
│   │   ├── api/           # typed API client (api Gateway calls)
│   │   └── lib/           # cognito auth, helpers
├── backend/
│   ├── lambdas/
│   │   ├── ingest/        # S3 upload handler → Textract/Claude → DynamoDB
│   │   ├── query/         # RAG Q&A via RetrieveAndGenerate
│   │   ├── actions/       # agent action-group handlers (createReminder, etc.)
│   │   └── proactive/     # EventBridge target → nudge logic → SNS
│   ├── shared/            # dynamo client, bedrock client, models (pydantic)
│   └── infra/             # IaC (CloudFormation/CDK/SAM) for all resources
├── data/
│   ├── synthetic/         # generated JSON datasets
│   └── artifacts/         # rendered PDFs + screenshot images for the demo
├── docs/
│   ├── PRD.md             # the submission PRD (export to PDF)
│   └── architecture.png   # system diagram
└── README.md              # clean, judge-facing
```

## Specs (build one at a time, in this order)
1. `synthetic-data` — generate + render realistic Indian-campus artifacts.
2. `ingestion` — upload → Textract/Claude vision → structured JSON → DynamoDB + Knowledge Base sync.
3. `rag-qa` — Q&A over ingested data with source citations.
4. `proactive-alerts` — scheduling + nudge generation + delivery.
5. `frontend` — three screens wired to the backend.

## Naming Conventions
- Lambda functions: `campusflow-{domain}-{action}` (e.g. `campusflow-ingest-handler`).
- DynamoDB single table `CampusFlow`; PK = `STUDENT#{studentId}`, SK = `{TYPE}#{id}` (e.g. `DEADLINE#...`, `CLASS#...`, `NOTICE#...`).
- S3 keys: `uploads/{studentId}/{timestamp}-{filename}`.
- React components PascalCase; files match component name.

## Team Ownership (avoid merge collisions)
- **Lead / Product:** `docs/`, `frontend/` (UI + polish), `.kiro/steering/`, the demo video, the pitch deck.
- **Dev — Ingestion & RAG:** `backend/lambdas/ingest/`, `backend/lambdas/query/`, Knowledge Base setup, `data/`.
- **Dev — Backend & Proactive:** `backend/infra/`, `backend/lambdas/actions/`, `backend/lambdas/proactive/`, Cognito, Bedrock Agent + action groups, EventBridge/SNS.

## Git Discipline
- Branch per feature: `feat/ingestion`, `feat/rag-qa`, etc. Small commits. PR into `main`. Keep `main` always demo-able.
- Protect the working demo: once a flow works end-to-end, tag it (`v-demo-stable`) so we can roll back.
