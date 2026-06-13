"""
campusflow-actions-handler

Bedrock Agent action group Lambda.
Handles tool calls from the Bedrock Agent:
- createReminder
- scheduleStudyBlock
- summarizeNotices
- getTodaySchedule
"""

import json
import logging
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from shared.dynamo import query_items, put_item

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event: dict, context) -> dict:
    """Bedrock Agent action group Lambda handler."""
    logger.info(f"Action event: {json.dumps(event)}")

    action = event.get("actionGroup", "")
    api_path = event.get("apiPath", "")
    parameters = _extract_parameters(event)

    # Route to appropriate action
    if "createReminder" in api_path:
        result = create_reminder(parameters)
    elif "scheduleStudyBlock" in api_path:
        result = schedule_study_block(parameters)
    elif "summarizeNotices" in api_path:
        result = summarize_notices(parameters)
    elif "getTodaySchedule" in api_path:
        result = get_today_schedule(parameters)
    else:
        result = {"error": f"Unknown action: {api_path}"}

    # Return in Bedrock Agent expected format
    return {
        "messageVersion": "1.0",
        "response": {
            "actionGroup": action,
            "apiPath": api_path,
            "httpMethod": event.get("httpMethod", "POST"),
            "httpStatusCode": 200,
            "responseBody": {
                "application/json": {
                    "body": json.dumps(result)
                }
            },
        },
    }


def create_reminder(params: dict) -> dict:
    """Create a reminder for the student."""
    student_id = params.get("studentId", "aarav-demo")
    title = params.get("title", "Reminder")
    remind_at = params.get("remindAt", "")
    description = params.get("description", "")

    reminder_id = f"rem-{int(datetime.now().timestamp())}"

    put_item(student_id, f"REMINDER#{reminder_id}", {
        "type": "REMINDER",
        "title": title,
        "description": description,
        "remind_at": remind_at,
        "created_at": datetime.now().isoformat(),
        "status": "pending",
    })

    return {"success": True, "reminderId": reminder_id, "message": f"Reminder set: {title}"}


def schedule_study_block(params: dict) -> dict:
    """Schedule a study block for exam/assignment prep."""
    student_id = params.get("studentId", "aarav-demo")
    subject = params.get("subject", "General")
    date = params.get("date", "")
    duration_hours = params.get("durationHours", 2)

    block_id = f"study-{int(datetime.now().timestamp())}"

    put_item(student_id, f"STUDYBLOCK#{block_id}", {
        "type": "STUDYBLOCK",
        "subject": subject,
        "date": date,
        "duration_hours": duration_hours,
        "created_at": datetime.now().isoformat(),
    })

    return {"success": True, "blockId": block_id, "message": f"Study block scheduled: {subject} for {duration_hours}h"}


def summarize_notices(params: dict) -> dict:
    """Summarize recent notices for the student."""
    student_id = params.get("studentId", "aarav-demo")
    notices = query_items(student_id, "NOTICE#")

    if not notices:
        return {"summary": "No notices found. Upload some campus notices to get started."}

    summary_lines = [f"You have {len(notices)} notice(s):"]
    for n in notices[:5]:
        summary_lines.append(f"• [{n.get('category', 'general')}] {n.get('title', 'Untitled')}")

    return {"summary": "\n".join(summary_lines), "count": len(notices)}


def get_today_schedule(params: dict) -> dict:
    """Get today's schedule for the student."""
    student_id = params.get("studentId", "aarav-demo")
    today_name = datetime.now().strftime("%A")

    classes = query_items(student_id, "CLASS#")
    today_classes = [c for c in classes if c.get("day", "").lower() == today_name.lower()]
    today_classes.sort(key=lambda x: x.get("time", ""))

    schedule = []
    for c in today_classes:
        schedule.append({
            "time": c.get("time", ""),
            "subject": c.get("subject", ""),
            "location": c.get("location", ""),
            "professor": c.get("professor", ""),
        })

    return {"day": today_name, "schedule": schedule, "count": len(schedule)}


def _extract_parameters(event: dict) -> dict:
    """Extract parameters from Bedrock Agent event format."""
    params = {}
    for param in event.get("parameters", []):
        params[param["name"]] = param["value"]
    # Also check requestBody
    request_body = event.get("requestBody", {})
    if request_body:
        content = request_body.get("content", {})
        json_content = content.get("application/json", {})
        properties = json_content.get("properties", [])
        for prop in properties:
            params[prop["name"]] = prop["value"]
    return params
