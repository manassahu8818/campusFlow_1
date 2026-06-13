"""
campusflow-query-handler

Handles Q&A queries over a student's ingested data.

Two modes:
- "rag" (default when Knowledge Base is set up): Uses Bedrock RetrieveAndGenerate
- "dynamo" (fallback): Queries DynamoDB directly and formats an answer

Toggle via QUERY_MODE env var.
"""

import json
import logging
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from shared.auth import get_student_id
from shared.dynamo import query_items

logger = logging.getLogger()
logger.setLevel(logging.INFO)

QUERY_MODE = os.environ.get("QUERY_MODE", "dynamo")
KNOWLEDGE_BASE_ID = os.environ.get("KNOWLEDGE_BASE_ID", "")


def handler(event: dict, context) -> dict:
    """Lambda handler for Q&A queries."""
    try:
        student_id = get_student_id(event)
        body = json.loads(event.get("body", "{}"))
        question = body.get("question", "").strip()

        if not question:
            return _response(400, {"error": "No question provided"})

        logger.info(f"Query from {student_id}: {question}")

        if QUERY_MODE == "rag" and KNOWLEDGE_BASE_ID:
            answer, sources = _query_rag(question, student_id)
        else:
            answer, sources = _query_dynamo(question, student_id)

        return _response(200, {
            "answer": answer,
            "sources": sources,
            "mode": QUERY_MODE,
        })

    except Exception as e:
        logger.error(f"Query failed: {e}", exc_info=True)
        return _response(500, {"error": "Query failed", "details": str(e)})


def _query_rag(question: str, student_id: str) -> tuple[str, list[str]]:
    """Query using Bedrock Knowledge Bases (RetrieveAndGenerate)."""
    try:
        import boto3
        client = boto3.client("bedrock-agent-runtime", region_name=os.environ.get("AWS_REGION", "us-east-1"))

        response = client.retrieve_and_generate(
            input={"text": question},
            retrieveAndGenerateConfiguration={
                "type": "KNOWLEDGE_BASE",
                "knowledgeBaseConfiguration": {
                    "knowledgeBaseId": KNOWLEDGE_BASE_ID,
                    "modelArn": f"arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0",
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

        answer = response.get("output", {}).get("text", "I don't have enough information to answer that.")
        citations = response.get("citations", [])
        sources = []
        for citation in citations:
            for ref in citation.get("retrievedReferences", []):
                loc = ref.get("location", {}).get("s3Location", {}).get("uri", "")
                if loc:
                    sources.append(loc.split("/")[-1])

        return answer, sources

    except Exception as e:
        logger.error(f"RAG query failed, falling back to DynamoDB: {e}")
        return _query_dynamo(question, student_id)


def _query_dynamo(question: str, student_id: str) -> tuple[str, list[str]]:
    """
    Fallback: Query DynamoDB directly and construct an answer.
    Simple keyword matching — good enough for the demo.
    """
    q_lower = question.lower()
    sources = []

    # Schedule queries
    if any(kw in q_lower for kw in ["class", "schedule", "timetable", "lecture", "today", "tomorrow", "monday", "tuesday", "wednesday", "thursday", "friday"]):
        classes = query_items(student_id, "CLASS#")
        if classes:
            sources.append("timetable")
            # Filter by day if mentioned
            day_filter = None
            for day in ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]:
                if day in q_lower:
                    day_filter = day
                    break

            if day_filter:
                classes = [c for c in classes if c.get("day", "").lower() == day_filter]

            if classes:
                lines = [f"Here's your schedule:"]
                for c in sorted(classes, key=lambda x: x.get("time", "")):
                    lines.append(f"• {c.get('time', '?')} - {c.get('subject', '?')} at {c.get('location', '?')}")
                return "\n".join(lines), sources
            else:
                return f"No classes found for {day_filter.title() if day_filter else 'that day'}.", sources

    # Deadline queries
    if any(kw in q_lower for kw in ["deadline", "assignment", "due", "submit", "homework"]):
        deadlines = query_items(student_id, "DEADLINE#")
        if deadlines:
            sources.append("deadlines")
            lines = ["Here are your upcoming deadlines:"]
            for d in sorted(deadlines, key=lambda x: x.get("due_date", "")):
                lines.append(f"• {d.get('title', '?')} — due {d.get('due_date', '?')}")
                if d.get("description"):
                    lines.append(f"  {d['description']}")
            return "\n".join(lines), sources

    # Menu queries
    if any(kw in q_lower for kw in ["menu", "mess", "food", "lunch", "dinner", "breakfast", "eat"]):
        menu = query_items(student_id, "MENU#")
        if menu:
            sources.append("mess_menu")
            lines = ["Here's the mess menu:"]
            for m in menu:
                items_str = ", ".join(m.get("items", []))
                lines.append(f"• {m.get('day', '?')} {m.get('meal', '?')}: {items_str}")
            return "\n".join(lines), sources

    # Notice queries
    if any(kw in q_lower for kw in ["notice", "announcement", "circular", "placement", "hostel"]):
        notices = query_items(student_id, "NOTICE#")
        if notices:
            sources.append("notices")
            lines = ["Here are the latest notices:"]
            for n in notices:
                lines.append(f"• [{n.get('category', 'general')}] {n.get('title', '?')}")
                lines.append(f"  {n.get('body', '')[:100]}")
            return "\n".join(lines), sources

    # Generic fallback
    return "I don't have enough information about that yet. Try uploading relevant documents first!", []


def _response(status_code: int, body: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Student-Id",
        },
        "body": json.dumps(body, default=str),
    }
