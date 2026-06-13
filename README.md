# CampusFlow

> Every other campus tool waits for you to ask. CampusFlow runs ahead of you.

A proactive, multimodal AI operating system for student life. Built with AWS serverless + Amazon Bedrock for HackOn with Amazon Season 6.

## Quick Start

```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend (local testing)
cd backend/lambdas/ingest && pip install -r requirements.txt
python local_test.py
```

## Architecture

- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Backend:** API Gateway → Lambda (Python 3.12) → DynamoDB + S3
- **AI/ML:** Amazon Bedrock (Claude, Titan Embeddings, Nova Micro), Amazon Textract
- **Orchestration:** Bedrock Knowledge Bases (RAG), Bedrock Agents, EventBridge Scheduler

## Deploy

```bash
cd backend/infra
sam build && sam deploy --guided
```
