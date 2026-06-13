"""
campusflow-proactive-handler

Generates proactive nudges for a student based on their data.

Triggered by:
- EventBridge Scheduler (periodic check)
- API Gateway (frontend requesting current cards)

Modes:
- "bedrock": Uses Bedrock Agent to reason about what nudges to send
- "deterministic" (default): Rule-based logic (reliable for demo)
"""

import json
import logging
import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from shared.auth import get_student_id
from shared.dynamo import query_items, put_item

logger = logging.getLogger()
logger.setLevel(logging.INFO)

PROACTIVE_MODE = os.environ.get("PROACTIVE_MODE", "deterministic")


def handler(event: dict, context) -> dict:
    """Lambda handler for proactive alerts."""
    try:
        # Determine if this is an API call or EventBridge trigger
        if "httpMethod" in event or "requestContext" in event:
            return _handle_api_request(event)
        else:
            return _handle_scheduled_trigger(event)

    except Exception as e:
        logger.error(f"Proactive handler failed: {e}", exc_info=True)
        return _response(500, {"error": "Failed to generate alerts"})


def _handle_api_request(event: dict) -> dict:
    """Handle GET /proactive/cards — return current proactive cards for the student."""
    student_id = get_student_id(event)
    cards = _generate_cards(student_id)
    return _response(200, {"cards": cards})


def _handle_scheduled_trigger(event: dict) -> dict:
    """Handle EventBridge scheduled trigger — evaluate all students or a specific one."""
    student_id = event.get("student_id", "aarav-demo")
    cards = _generate_cards(student_id)

    # Store cards in DynamoDB for the frontend to fetch
    for card in cards:
        try:
            put_item(student_id, f"CARD#{card['id']}", card)
        except Exception as e:
            logger.warning(f"Failed to store card: {e}")

    # TODO: Publish to SNS for push notification
    logger.info(f"Generated {len(cards)} proactive cards for {student_id}")
    return {"statusCode": 200, "cards_generated": len(cards)}


def _generate_cards(student_id: str) -> list[dict]:
    """Generate proactive cards based on student's data."""
    if PROACTIVE_MODE == "bedrock":
        return _generate_with_bedrock(student_id)
    else:
        return _generate_deterministic(student_id)


def _generate_deterministic(student_id: str) -> list[dict]:
    """
    Rule-based proactive card generation.
    Reliable for the demo — no Bedrock dependency.
    """
    cards = []
    now = datetime.now()

    # Check upcoming deadlines
    deadlines = query_items(student_id, "DEADLINE#")
    for d in deadlines:
        due_date_str = d.get("due_date", "")
        if due_date_str:
            try:
                due_date = datetime.strptime(due_date_str, "%Y-%m-%d")
                days_until = (due_date - now).days

                if 0 <= days_until <= 2:
                    cards.append({
                        "id": f"deadline-alert-{d.get('id', 'unknown')}",
                        "type": "alert",
                        "title": f"⚠️ Due in {days_until} day{'s' if days_until != 1 else ''}!",
                        "body": d.get("title", "Assignment due soon"),
                        "time": due_date_str,
                        "actionLabel": "View details",
                    })
                elif 3 <= days_until <= 5:
                    cards.append({
                        "id": f"deadline-reminder-{d.get('id', 'unknown')}",
                        "type": "reminder",
                        "title": f"📝 {d.get('title', 'Assignment')} due in {days_until} days",
                        "body": f"Subject: {d.get('subject', 'Unknown')}. Start early to avoid last-minute rush!",
                        "time": due_date_str,
                        "actionLabel": "Set study block",
                    })
            except ValueError:
                pass

    # Check today's schedule for prep suggestions
    today_name = now.strftime("%A")
    classes = query_items(student_id, "CLASS#")
    today_classes = [c for c in classes if c.get("day", "").lower() == today_name.lower()]

    if today_classes:
        first_class = sorted(today_classes, key=lambda x: x.get("time", ""))[0]
        cards.append({
            "id": f"schedule-today-{now.strftime('%Y%m%d')}",
            "type": "suggestion",
            "title": f"📚 {len(today_classes)} classes today",
            "body": f"First up: {first_class.get('subject', '?')} at {first_class.get('time', '?')} in {first_class.get('location', '?')}",
            "time": first_class.get("time", ""),
            "actionLabel": "View full schedule",
        })

    # Check notices for recent important ones
    notices = query_items(student_id, "NOTICE#")
    placement_notices = [n for n in notices if n.get("category") == "placement"]
    if placement_notices:
        latest = placement_notices[0]
        cards.append({
            "id": f"notice-placement-{latest.get('id', 'unknown')}",
            "type": "alert",
            "title": "🎯 Placement Update",
            "body": latest.get("title", "New placement notice"),
            "actionLabel": "Read more",
        })

    # If no data yet, show onboarding card
    if not cards and not deadlines and not classes:
        cards.append({
            "id": "onboarding-upload",
            "type": "suggestion",
            "title": "👋 Welcome to CampusFlow!",
            "body": "Upload your timetable, mess menu, or any campus document to get started. I'll keep track of everything for you.",
            "actionLabel": "Upload now",
        })

    return cards


def _generate_with_bedrock(student_id: str) -> list[dict]:
    """
    Use Bedrock Agent to reason about proactive nudges.
    Falls back to deterministic if Bedrock fails.
    """
    try:
        import boto3

        # Gather student context
        classes = query_items(student_id, "CLASS#")
        deadlines = query_items(student_id, "DEADLINE#")
        notices = query_items(student_id, "NOTICE#")

        context = {
            "student_id": student_id,
            "current_time": datetime.now().isoformat(),
            "classes_count": len(classes),
            "deadlines": [{"title": d.get("title"), "due_date": d.get("due_date")} for d in deadlines],
            "notices": [{"title": n.get("title"), "category": n.get("category")} for n in notices],
        }

        client = boto3.client("bedrock-runtime", region_name=os.environ.get("AWS_REGION", "us-east-1"))

        prompt = f"""You are a proactive campus assistant. Based on this student's data, generate 1-3 useful proactive nudge cards.

Student context:
{json.dumps(context, indent=2)}

Return STRICT JSON array:
[{{"id": "unique-id", "type": "reminder|alert|suggestion", "title": "short title with emoji", "body": "helpful message", "actionLabel": "button text"}}]

Rules:
- Only generate genuinely useful nudges
- Be specific (mention actual subjects/deadlines)
- Prioritize urgency (approaching deadlines > general suggestions)
"""

        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1024,
            "messages": [{"role": "user", "content": prompt}],
        })

        response = client.invoke_model(
            modelId="anthropic.claude-3-haiku-20240307-v1:0",  # Cheap model for this task
            body=body,
            contentType="application/json",
            accept="application/json",
        )

        response_body = json.loads(response["body"].read())
        text = response_body["content"][0]["text"]

        # Parse JSON from response
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]

        cards = json.loads(text.strip())
        return cards if isinstance(cards, list) else []

    except Exception as e:
        logger.error(f"Bedrock proactive generation failed: {e}")
        return _generate_deterministic(student_id)


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
