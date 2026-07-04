# CampusFlow — Complete Technical Pipeline Documentation

## Table of Contents
1. [Pipeline 1: Multimodal Ingestion](#pipeline-1-multimodal-ingestion)
2. [Pipeline 2: RAG Q&A (Retrieval Augmented Generation)](#pipeline-2-rag-qa)
3. [Pipeline 3: Proactive Alerts](#pipeline-3-proactive-alerts)
4. [Knowledge Base Setup](#knowledge-base-setup)
5. [AWS Services Used](#aws-services-used)
6. [Current Status](#current-status)

---

## Pipeline 1: Multimodal Ingestion

### What It Does
Takes a messy photo/PDF/screenshot of any campus document (timetable, mess menu,
notice board, assignment sheet) and converts it into clean, structured JSON data.

### The Flow (End-to-End)

```
Student uploads "timetable.jpg" (from phone camera / WhatsApp forward)
        │
        ▼
┌── FRONTEND (Ingest.tsx) ────────────────────────────────────────────┐
│  1. User drops file / selects from gallery                          │
│  2. File preview shown                                              │
│  3. Click "Extract Data"                                            │
│  4. POST /ingest/upload (file as base64)                            │
│     OR: stubExtract(file) ← client-side fallback for demo           │
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌── API GATEWAY ──────────────────────────────────────────────────────┐
│  POST /ingest/upload                                                │
│  Headers: X-Student-Id, Authorization                               │
│  Body: base64-encoded file                                          │
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌── LAMBDA: campusflow-ingest-handler ────────────────────────────────┐
│  File: backend/lambdas/ingest/handler.py                            │
│                                                                     │
│  Step 1: get_student_id(event) → "aarav-demo"                       │
│  Step 2: _parse_upload(event) → file_bytes, filename, content_type  │
│  Step 3: upload_file() → store raw file in S3                       │
│  Step 4: extract_structured_data() → call Claude/Textract           │
│  Step 5: batch_put_items() → save structured data to DynamoDB       │
│  Step 6: return JSON response with extracted data                   │
└─────────────────────────────────────────────────────────────────────┘
```

### Code Locations

| File | Purpose |
|------|---------|
| `frontend/src/screens/Ingest.tsx` | Upload UI, preview, results display |
| `frontend/src/lib/stubExtractor.ts` | Client-side fallback (filename → fake data) |
| `backend/lambdas/ingest/handler.py` | Lambda handler (orchestrates the pipeline) |
| `backend/shared/extractor.py` | AI extraction logic (stub + Bedrock modes) |
| `backend/shared/s3_client.py` | S3 upload/download wrapper |
| `backend/shared/dynamo.py` | DynamoDB read/write wrapper |
| `backend/shared/models.py` | Data models (ClassEntry, Deadline, Notice, MenuItem) |

### How Extraction Works (Two Modes)

**Mode 1: Stub (EXTRACTOR_MODE=stub) — DEFAULT**
- Reads the FILENAME (not the actual file content)
- Routes by keyword: "timetable" → returns hardcoded timetable JSON
- Used for demo/local testing without AWS
- Zero cost, instant response

**Mode 2: Bedrock (EXTRACTOR_MODE=bedrock) — PRODUCTION**
- For PDFs: calls Amazon Textract first (reads tables/forms precisely)
- For images: sends directly to Claude Vision
- Claude receives: the image (base64) + system prompt demanding strict JSON
- Returns structured data with per-field confidence scores

### The Claude Vision Prompt (What We Send to AI)

```python
system_prompt = """You are a document extraction AI for an Indian college student's 
campus documents. Extract structured data from the provided image/document. 
Return STRICT JSON with the following schema:
{
  "document_type": "timetable|menu|notice|deadline|mixed",
  "classes": [{"day": "", "time": "", "subject": "", "location": "", 
               "professor": "", "confidence": 0.0}],
  "deadlines": [{"id": "", "title": "", "subject": "", "due_date": "YYYY-MM-DD", 
                 "description": "", "confidence": 0.0}],
  "notices": [{"id": "", "title": "", "body": "", "date": "YYYY-MM-DD", 
              "category": "academic|hostel|placement|event|general", "confidence": 0.0}],
  "menu_items": [{"meal": "breakfast|lunch|dinner", "day": "", "items": [], 
                  "confidence": 0.0}],
  "overall_confidence": 0.0,
  "raw_text": ""
}
Use null for unreadable fields. Include a confidence score (0-1) per field."""
```

Claude receives the IMAGE + this prompt → returns structured JSON.

### How Input Reaches Claude

```python
# 1. Image encoded as base64
image_data = base64.b64encode(file_bytes).decode("utf-8")

# 2. Multimodal message (image + text together)
user_content = [
    {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": image_data}},
    {"type": "text", "text": "Extract structured data from this campus document: timetable.jpg"}
]

# 3. One API call to Bedrock
response = client.invoke_model(
    modelId="anthropic.claude-3-sonnet-20240229-v1:0",
    body=json.dumps({"messages": [{"role": "user", "content": user_content}]})
)
```

### Why We Store Raw Files in S3

```python
key = f"uploads/{student_id}/{timestamp}-{filename}"
# e.g. uploads/aarav-demo/1719840000-timetable.jpg
```

Reasons:
1. **Re-extraction** — if Claude misreads or better models arrive, re-process without re-upload
2. **RAG Knowledge Base** — KB reads from S3 to build its vector index
3. **Source citation** — Q&A answers link back to the original file
4. **Audit trail** — student can verify what was uploaded
5. **Cheap** — S3 costs ~$0.023/GB/month

### DynamoDB Storage Format (Single-Table Design)

```
PK: STUDENT#aarav-demo
SK: CLASS#monday-0900      → {day: "Monday", time: "09:00", subject: "DSA", location: "LH-301"}
SK: CLASS#monday-1100      → {day: "Monday", time: "11:00", subject: "DBMS", location: "LH-204"}
SK: DEADLINE#hw-dsa-3      → {title: "DSA Assignment 3", due_date: "2024-10-12", subject: "DSA"}
SK: NOTICE#notice-001      → {title: "Mid-Sem Exams", category: "academic", body: "..."}
SK: MENU#monday-breakfast  → {meal: "breakfast", items: ["Poha", "Tea", "Banana"]}
```

### Confidence Scores & "Confirm" UX

Every extracted field has a confidence score (0.0 to 1.0).
- ≥ 0.9 → shown normally (green)
- 0.6-0.9 → shown with amber indicator
- < 0.6 → highlighted with "Confirm" button (student can verify/correct)

This turns AI uncertainty into a feature — the student feels in control.

---

## Pipeline 2: RAG Q&A (Retrieval Augmented Generation)

### What It Does
Student asks a natural-language question ("When is my DSA assignment due?") and gets
an answer grounded ONLY in their own uploaded documents — never hallucinated.

### What is RAG?

The problem: Claude knows nothing about Aarav's personal schedule. If you just ask
Claude "When is my DSA assignment due?", it'll make up an answer.

RAG solves this: **first find the relevant data, then feed it to Claude so it answers
based on facts.**

```
Without RAG:  Question → Claude (knows nothing) → hallucinated answer ❌
With RAG:     Question → search documents → find relevant chunks → 
              feed chunks + question to Claude → grounded answer ✅
```

### The Flow (End-to-End)

```
Student types: "When is the Amazon placement test?"
        │
        ▼
┌── FRONTEND (Chat.tsx) ──────────────────────────────────────────────┐
│  1. User types question in chat input                               │
│  2. POST /query/ask {question: "When is the Amazon..."}             │
│     OR: answerFromStore() ← client-side fallback for demo           │
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌── LAMBDA: campusflow-query-handler ─────────────────────────────────┐
│  File: backend/lambdas/query/handler.py                             │
│                                                                     │
│  QUERY_MODE = "rag" or "dynamo"                                     │
│                                                                     │
│  if mode == "rag":                                                  │
│      → _query_rag(question, student_id)                             │
│  else:                                                              │
│      → _query_dynamo(question, student_id)  ← fallback              │
└─────────────────────────────────────────────────────────────────────┘
```

### RAG Mode: How It Works Internally

RAG has two phases: **Indexing** (one-time setup) and **Querying** (every question).

#### Phase 1: Indexing (happens after file upload)

```
File uploaded to S3
        │
        ▼ (S3 event triggers KBSyncFunction Lambda)
        │
        ▼
┌── Knowledge Base Ingestion ─────────────────────────────────────────┐
│                                                                     │
│  a) CHUNK — splits document into small pieces:                      │
│     Chunk 1: "Amazon SDE Intern hiring. CTC ₹1.2L/mo"              │
│     Chunk 2: "Eligibility: CSE/IT, 7.5 CGPA"                       │
│     Chunk 3: "Online test on 25th October, HackerRank"              │
│                                                                     │
│  b) EMBED — converts each chunk to a vector (list of numbers)       │
│     using Amazon Titan Text Embeddings V2:                          │
│     "Amazon SDE Intern..." → [0.23, -0.41, 0.87, ... 1024 dims]    │
│                                                                     │
│  c) STORE — saves vectors in OpenSearch Serverless                  │
│     Each entry = {vector, original_text, source_file, studentId}    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

Why vectors? Because "When is the Amazon test?" and "Online test on 25th October"
have SIMILAR vectors even though the words are different. This enables semantic search.

#### Phase 2: Querying (happens on every question)

```
Student asks: "When is the Amazon placement test?"
        │
        ▼
┌── Step 1: EMBED the question ───────────────────────────────────────┐
│   "When is the Amazon placement test?"                              │
│       → Titan Embeddings → [0.44, -0.15, 0.89, ...]                │
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌── Step 2: SEARCH OpenSearch ────────────────────────────────────────┐
│   Find vectors closest to the question vector                       │
│   Filter: studentId = "aarav-demo" (data isolation!)                │
│                                                                     │
│   Results (ranked by similarity):                                   │
│     1. "Online test on 25th October, HackerRank"         score 0.94 │
│     2. "Amazon SDE Intern hiring. CTC ₹1.2L/mo"         score 0.87 │
│     3. "Register on placement portal by 20th Oct"        score 0.82 │
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌── Step 3: GENERATE answer with Claude ──────────────────────────────┐
│   Claude receives:                                                  │
│     System: "Answer using ONLY the provided context."               │
│     Context: [the 3 retrieved chunks above]                         │
│     Question: "When is the Amazon placement test?"                  │
│                                                                     │
│   Claude answers: "The Amazon placement online test is on 25th      │
│   October 2024 on HackerRank. Register by 20th Oct."               │
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌── Step 4: RETURN answer + source citations ─────────────────────────┐
│   answer: "The Amazon test is on 25th October..."                   │
│   sources: ["placement_circular.pdf"]                               │
└─────────────────────────────────────────────────────────────────────┘
```

### The RAG Code (Key Function)

```python
# File: backend/lambdas/query/handler.py → _query_rag()

def _query_rag(question: str, student_id: str) -> tuple[str, list[str]]:
    client = boto3.client("bedrock-agent-runtime", region_name="us-east-1")

    response = client.retrieve_and_generate(
        input={"text": question},
        retrieveAndGenerateConfiguration={
            "type": "KNOWLEDGE_BASE",
            "knowledgeBaseConfiguration": {
                "knowledgeBaseId": "L3NBNFWWWM",  # Our KB
                "modelArn": "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0",
                "retrievalConfiguration": {
                    "vectorSearchConfiguration": {
                        "filter": {
                            "equals": {"key": "studentId", "value": student_id}
                        }
                    }
                },
            },
        },
    )

    answer = response["output"]["text"]
    sources = [ref["location"]["s3Location"]["uri"].split("/")[-1] 
               for citation in response["citations"]
               for ref in citation["retrievedReferences"]]
    return answer, sources
```

One API call does everything: embed → search → retrieve → generate → cite.

### DynamoDB Fallback Mode (QUERY_MODE=dynamo)

Simple keyword matching when Knowledge Base isn't available:

```python
def _query_dynamo(question: str, student_id: str):
    q_lower = question.lower()
    
    if "class" or "schedule" or "timetable" in q_lower:
        classes = query_items(student_id, "CLASS#")  # DynamoDB prefix query
        # Format as readable text
        
    if "deadline" or "assignment" or "due" in q_lower:
        deadlines = query_items(student_id, "DEADLINE#")
        # Format as readable text
        
    if "menu" or "mess" or "food" in q_lower:
        menu = query_items(student_id, "MENU#")
        # Format as readable text
```

### Why studentId Filter Matters

```python
"filter": {"equals": {"key": "studentId", "value": student_id}}
```

Without this, Aarav's question might pull Priya's documents.
Each student only searches THEIR OWN uploaded docs. Privacy by design.

### Code Locations

| File | Purpose |
|------|---------|
| `frontend/src/screens/Chat.tsx` | Chat UI + local Q&A engine (answerFromStore) |
| `backend/lambdas/query/handler.py` | Lambda: RAG mode + DynamoDB fallback |
| `backend/shared/dynamo.py` | query_items() for DynamoDB fallback |
| `backend/lambdas/kb_sync/handler.py` | Triggers KB re-index when new file lands in S3 |

### RAG vs DynamoDB Fallback — Comparison

| Aspect | RAG (Bedrock KB) | DynamoDB Fallback |
|--------|-------------------|-------------------|
| Search type | Semantic (meaning-based) | Keyword matching |
| Handles typos | Yes | No |
| Handles "what should I study?" | Yes (understands intent) | No |
| Source citations | Real file references | Category labels |
| Cost | ~$0.003/query | Free (DynamoDB reads) |
| Requires | KB + OpenSearch + Titan | Just DynamoDB |

---

## Pipeline 3: Proactive Alerts

### What It Does
Instead of waiting for the student to ask, CampusFlow LOOKS AHEAD at their data
and pushes timely warnings/suggestions BEFORE they ask. This is what makes it an
"OS" not a chatbot.

Examples:
- "🚨 DBMS Assignment due in 9 hours! Submit before midnight."
- "📚 3 classes today. First: DSA at 9:00 in LH-301"
- "🎯 Amazon placement — register by Oct 20 (2 days left)"
- "🎪 CodeStorm Hackathon in 3 days — have you registered?"

### The Flow (End-to-End)

```
┌── TRIGGER 1: EventBridge Scheduler (automatic, every hour) ─────────┐
│                                                                      │
│  EventBridge fires → Lambda invoked with:                            │
│  {"student_id": "aarav-demo"}                                        │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌── TRIGGER 2: Frontend loads Today tab (on-demand) ──────────────────┐
│                                                                      │
│  GET /proactive/cards                                                │
│  Header: X-Student-Id: aarav-demo                                    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌── LAMBDA: campusflow-proactive-handler ─────────────────────────────┐
│  File: backend/lambdas/proactive/handler.py                         │
│                                                                     │
│  1. Detect trigger type (EventBridge or API Gateway)                │
│  2. Get student_id                                                  │
│  3. _generate_cards(student_id)                                     │
│  4. If scheduled: store cards in DynamoDB + publish to SNS          │
│     If API call: return cards directly as JSON                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Card Generation Logic (Two Modes)

#### Mode 1: Deterministic (PROACTIVE_MODE=deterministic) — DEFAULT

Rule-based logic. Reliable, no AI dependency.

```python
def _generate_deterministic(student_id):
    cards = []
    now = datetime.now()

    # Rule 1: Upcoming deadlines
    deadlines = query_items(student_id, "DEADLINE#")
    for d in deadlines:
        days_until = (due_date - now).days
        if 0 <= days_until <= 2:
            cards.append({"type": "alert", "title": "⚠️ Due in X days!"})
        elif 3 <= days_until <= 5:
            cards.append({"type": "reminder", "title": "📝 Start early..."})

    # Rule 2: Today's schedule
    today_classes = [c for c in classes if c.day == today]
    if today_classes:
        cards.append({"type": "suggestion", "title": "📚 N classes today"})

    # Rule 3: Placement notices
    if placement_notices:
        cards.append({"type": "alert", "title": "🎯 Placement Update"})

    # Rule 4: No data yet → onboarding
    if no_data:
        cards.append({"type": "suggestion", "title": "👋 Welcome! Upload first doc"})

    return cards
```

#### Mode 2: Bedrock (PROACTIVE_MODE=bedrock) — AI-POWERED

Uses Claude Haiku (cheapest model) to reason about what nudges to send:

```python
def _generate_with_bedrock(student_id):
    # Gather ALL student data
    context = {
        "student_id": student_id,
        "current_time": datetime.now().isoformat(),
        "deadlines": [...],  # from DynamoDB
        "notices": [...],
        "classes_count": 15,
    }

    prompt = f"""You are a proactive campus assistant. Based on this student's data,
    generate 1-3 useful proactive nudge cards.
    
    Student context: {json.dumps(context)}
    
    Return STRICT JSON array:
    [{{"id": "...", "type": "reminder|alert|suggestion", 
       "title": "short title with emoji", "body": "helpful message"}}]
    
    Rules:
    - Only genuinely useful nudges
    - Be specific (mention actual subjects/deadlines)
    - Prioritize urgency"""

    # Uses Claude Haiku (cheap: ~$0.001 per call)
    response = client.invoke_model(
        modelId="anthropic.claude-3-haiku-20240307-v1:0",
        body=json.dumps({"messages": [{"role": "user", "content": prompt}]})
    )
```

Falls back to deterministic if Bedrock fails.

### Card Types

| Type | Color | When |
|------|-------|------|
| `alert` | Red | Deadline < 2 days, urgent notice |
| `reminder` | Amber | Deadline 3-5 days, placement registration closing |
| `suggestion` | Blue | Today's schedule summary, study block suggestion |
| `placement` | Purple | New placement drive detected |

### What Happens After Cards Are Generated

**Scheduled trigger (EventBridge):**
```python
# Store in DynamoDB so frontend can fetch later
for card in cards:
    put_item(student_id, f"CARD#{card['id']}", card)

# TODO: Push notification via SNS
# sns.publish(TopicArn=..., Message=json.dumps(card))
```

**API trigger (frontend):**
```python
# Return directly to the frontend
return {"cards": cards}
```

### EventBridge Schedule (from template.yaml)

```yaml
ScheduledCheck:
  Type: Schedule
  Properties:
    Schedule: rate(1 hour)      # Fires every hour
    Input: '{"student_id": "aarav-demo"}'
```

Every hour, AWS automatically runs the proactive Lambda. It checks:
- Any deadlines approaching?
- Any new notices to flag?
- Any schedule to prepare for?

### Code Locations

| File | Purpose |
|------|---------|
| `frontend/src/screens/Today.tsx` | Displays cards + generates them locally |
| `backend/lambdas/proactive/handler.py` | Lambda: deterministic + Bedrock modes |
| `backend/shared/dynamo.py` | Reads student data for card generation |
| `backend/infra/template.yaml` | EventBridge schedule definition |

### Frontend Local Cards (Today.tsx)

The frontend ALSO generates proactive cards locally (same logic, runs in browser):

```typescript
function generateCards(data: StudentData): Card[] {
    // Check deadlines: hours remaining
    // Check placements: days until registration closes
    // Check events: days until event
    // Check schedule: today's classes
    return cards.slice(0, 5)  // max 5 cards
}
```

This means the Today tab works instantly without waiting for the backend.

---

## Knowledge Base Setup

### What Was Created (Live in AWS Account 070025263888)

| Resource | ID/Name | Status |
|----------|---------|--------|
| S3 Bucket | `campusflow-uploads-070025263888` | ✅ Active |
| OpenSearch Collection | `s09c1cy3cxo66u8voi5h` | ✅ Active |
| Vector Index | `campusflow-index` (1024 dims, FAISS HNSW) | ✅ Created |
| Knowledge Base | `L3NBNFWWWM` (CampusFlowKB) | ✅ Active |
| Data Source | `11NERLJBOE` (CampusFlowUploads) | ✅ Available |
| IAM Role | `CampusFlowKnowledgeBaseRole` | ✅ Active |

### How Knowledge Base Stays in Sync with S3

Knowledge Base does NOT auto-watch S3. We use event-driven sync:

```
File uploaded to S3 (uploads/ prefix)
        │
        ▼ (S3 Event Notification — automatic)
        │
KBSyncFunction Lambda (backend/lambdas/kb_sync/handler.py)
        │
        ▼
client.start_ingestion_job(
    knowledgeBaseId="L3NBNFWWWM",
    dataSourceId="11NERLJBOE"
)
        │
        ▼
Knowledge Base re-reads S3 → chunks → embeds → updates OpenSearch
```

The KBSyncFunction is triggered automatically by S3 events — no polling,
no manual sync needed.

### Knowledge Base Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BEDROCK KNOWLEDGE BASE                            │
│                    ID: L3NBNFWWWM                                    │
│                                                                     │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │   S3 Bucket  │    │  Titan Embeddings │    │   OpenSearch     │  │
│  │   (source)   │ →  │  (vectorize)      │ →  │   Serverless     │  │
│  │              │    │  1024 dimensions   │    │   (store/search) │  │
│  └──────────────┘    └──────────────────┘    └──────────────────┘  │
│                                                                     │
│  Data Source: 11NERLJBOE                                            │
│  Bucket: campusflow-uploads-070025263888                             │
│  Prefix: uploads/                                                   │
│  Index: campusflow-index                                            │
│  Embedding Model: amazon.titan-embed-text-v2:0                      │
│  Vector Dimensions: 1024                                            │
│  Search Algorithm: FAISS HNSW (L2 distance)                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### IAM Role Permissions (CampusFlowKnowledgeBaseRole)

```json
{
  "Statement": [
    {
      "Action": ["s3:GetObject", "s3:ListBucket"],
      "Resource": ["arn:aws:s3:::campusflow-uploads-070025263888/*"]
    },
    {
      "Action": ["bedrock:InvokeModel"],
      "Resource": "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0"
    },
    {
      "Action": ["aoss:APIAccessAll"],
      "Resource": "arn:aws:aoss:us-east-1:070025263888:collection/s09c1cy3cxo66u8voi5h"
    }
  ]
}
```

---

## AWS Services Used

### Compute & API
| Service | Purpose | Why |
|---------|---------|-----|
| **AWS Lambda** | Runs backend code (Python 3.12) | Serverless: pay only when invoked, scales to zero, no servers to manage |
| **API Gateway** | REST API endpoints for frontend | Routes HTTP requests to Lambda, handles CORS, rate limiting |
| **EventBridge Scheduler** | Triggers proactive checks every hour | Fully managed cron/schedule service, no EC2 needed |

### Storage
| Service | Purpose | Why |
|---------|---------|-----|
| **Amazon S3** | Raw file storage (uploaded photos/PDFs) | Unlimited storage at ~$0.023/GB, feeds Knowledge Base |
| **Amazon DynamoDB** | Structured data (schedules, deadlines) | Single-digit millisecond reads, single-table design, pay-per-request |

### AI / ML (Amazon Bedrock)
| Service | Purpose | Why |
|---------|---------|-----|
| **Claude 3 Sonnet** (via Bedrock) | Vision extraction — reads images → JSON | Best multimodal model for understanding messy handwritten/printed docs |
| **Claude 3 Haiku** (via Bedrock) | Proactive nudge generation | Cheapest Claude model (~$0.001/call), good enough for simple reasoning |
| **Amazon Titan Embeddings V2** | Text → vector (1024 dims) for RAG | AWS-native, fast, cheap, no separate API key needed |
| **Amazon Textract** | PDF table/form extraction | Specialized for structured documents (forms, tables) — more precise than Claude for clean PDFs |
| **Bedrock Knowledge Bases** | Managed RAG (chunk → embed → store → search → generate) | One API call does the entire RAG pipeline |

### Auth & Notifications
| Service | Purpose | Why |
|---------|---------|-----|
| **Amazon Cognito** | User authentication (provisioned, not enforced) | Per-student data isolation, JWT tokens |
| **Amazon SNS** | Push notifications for proactive alerts | Topic-based pub/sub, can add email/SMS subscribers |

### Infrastructure
| Service | Purpose | Why |
|---------|---------|-----|
| **AWS SAM** | Infrastructure-as-Code (deploys everything) | CloudFormation + Lambda packaging in one tool |
| **OpenSearch Serverless** | Vector database for RAG | Managed, scales automatically, no cluster management |

### What is AWS Lambda?

Lambda is a "function-as-a-service":
- You upload your Python code
- AWS runs it only when triggered (API call, schedule, S3 event)
- You pay only for execution time (per millisecond)
- Scales from 0 to thousands of concurrent executions
- No servers to manage, patch, or scale

Each Lambda in CampusFlow handles ONE thing:
- `campusflow-ingest-handler` — file upload + extraction
- `campusflow-query-handler` — Q&A queries
- `campusflow-proactive-handler` — alert generation
- `campusflow-actions-handler` — Bedrock Agent tools
- `campusflow-kb-sync` — triggers Knowledge Base re-index

### What is Amazon Bedrock?

Bedrock is AWS's managed AI service:
- Access to Claude, Titan, Llama, Mistral via ONE API
- No GPU servers to manage
- No model weights to download
- One API call = response
- Billed per token (input + output)
- Data stays within AWS (privacy)
- Same IAM permissions as other AWS services

```python
# That's it — one call to Claude
response = client.invoke_model(
    modelId="anthropic.claude-3-sonnet-20240229-v1:0",
    body=json.dumps({"messages": [{"role": "user", "content": [...]}]})
)
```

### What is Amazon S3?

Simple Storage Service — infinite object storage:
- Store any file type (images, PDFs, JSON, videos)
- Organized by key prefix: `uploads/aarav-demo/1719840000-timetable.jpg`
- 99.999999999% durability (11 nines)
- Costs ~$0.023/GB/month
- Can trigger events (Lambda) on file upload
- Feeds into Knowledge Base for RAG

---

## Current Status

### What's Working (Demo-Ready)

| Feature | Frontend | Backend | Real AI |
|---------|----------|---------|---------|
| Upload + Extract | ✅ stubExtractor (client-side) | ✅ Code complete | ❌ Bedrock payment issue |
| Q&A Chat | ✅ answerFromStore (client-side) | ✅ Code complete | ❌ Bedrock payment issue |
| Proactive Cards | ✅ generateCards (client-side) | ✅ Code complete | ❌ Bedrock payment issue |
| S3 Storage | N/A | ✅ Code complete | ✅ Bucket created |
| DynamoDB | N/A | ✅ Code complete | ⏳ Not deployed yet (sam deploy) |
| Knowledge Base | N/A | ✅ Code complete | ✅ KB created (L3NBNFWWWM) |
| EventBridge Schedule | N/A | ✅ Template defined | ⏳ Not deployed yet |
| Cognito Auth | Hardcoded demo user | ✅ Pool in template | ⏳ Not deployed yet |

### The Blocker

**Bedrock model access** — AWS Marketplace payment validation fails with Indian
Visa debit card despite ₹2 verification succeeding and $140 credits available.
Support case needed.

### How to Flip to Production (When Payment Resolves)

1. Change in template.yaml:
   ```yaml
   EXTRACTOR_MODE: bedrock      # was: stub
   QUERY_MODE: rag              # was: dynamo  (already changed)
   PROACTIVE_MODE: bedrock      # was: deterministic
   ```

2. Deploy:
   ```bash
   cd backend/infra && sam build && sam deploy
   ```

3. That's it. Code handles both modes with graceful fallback.

### Architecture Diagram (All Three Pipelines Together)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
│                     React + Vite + TypeScript + Tailwind                     │
│                                                                             │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐                         │
│  │  Upload  │      │   Chat   │      │  Today   │                         │
│  │ (Ingest) │      │  (Q&A)   │      │ (Cards)  │                         │
│  └────┬─────┘      └────┬─────┘      └────┬─────┘                         │
└───────┼──────────────────┼──────────────────┼───────────────────────────────┘
        │                  │                  │
        ▼                  ▼                  ▼
┌── API GATEWAY ──────────────────────────────────────────────────────────────┐
│  POST /ingest/upload    POST /query/ask    GET /proactive/cards             │
└───────┬──────────────────┬──────────────────┬───────────────────────────────┘
        │                  │                  │
        ▼                  ▼                  ▼
┌── LAMBDA ───────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌─────────────┐   ┌─────────────┐   ┌──────────────┐   ┌──────────────┐ │
│  │   Ingest    │   │    Query    │   │  Proactive   │   │   KB Sync    │ │
│  │  Handler    │   │   Handler   │   │   Handler    │   │   Handler    │ │
│  └──────┬──────┘   └──────┬──────┘   └──────┬───────┘   └──────┬───────┘ │
│         │                  │                  │                   │         │
└─────────┼──────────────────┼──────────────────┼───────────────────┼─────────┘
          │                  │                  │                   │
          ▼                  ▼                  ▼                   ▼
┌── AWS SERVICES ─────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌────────┐  ┌──────────┐  ┌──────────────┐  ┌─────────────────────────┐  │
│  │   S3   │  │ DynamoDB │  │   Bedrock    │  │    Knowledge Base       │  │
│  │ (raw   │  │(structured│  │ (Claude +    │  │ (Titan Embed +          │  │
│  │ files) │  │  data)    │  │  Textract)   │  │  OpenSearch Serverless) │  │
│  └────────┘  └──────────┘  └──────────────┘  └─────────────────────────┘  │
│                                                                             │
│  ┌────────────┐  ┌────────┐  ┌──────────┐                                 │
│  │EventBridge │  │  SNS   │  │ Cognito  │                                 │
│  │(scheduler) │  │(alerts)│  │ (auth)   │                                 │
│  └────────────┘  └────────┘  └──────────┘                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### How the Three Pipelines Connect

```
INGESTION fills the data stores:
  Upload → S3 (raw) + DynamoDB (structured) + Knowledge Base (vectors)

RAG Q&A reads from the data stores:
  Question → Knowledge Base (semantic search) → Claude (generate answer)
  Fallback: Question → DynamoDB (keyword match) → formatted text

PROACTIVE reads from DynamoDB and reasons:
  Schedule → DynamoDB (deadlines, classes, notices) → Rules/Claude → Cards
```

They form a cycle:
1. Student uploads → data enters the system (Ingestion)
2. Student asks → data is retrieved and answered (RAG)
3. System anticipates → data is analyzed proactively (Alerts)

---

*Document generated for CampusFlow — HackOn with Amazon Season 6*
*Account: 070025263888 | Region: us-east-1*
