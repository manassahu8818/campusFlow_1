"""
Document extraction interface for CampusFlow.

This module provides a clean interface for extracting structured data from
uploaded campus documents. It supports:
- A STUB extractor (returns sample data for testing without Bedrock)
- A real BEDROCK extractor (Claude vision + Textract)

Toggle via the EXTRACTOR_MODE environment variable:
  - "stub" (default) → returns sample data
  - "bedrock" → uses real Bedrock Claude + Textract
"""

from __future__ import annotations

import os
import json
import logging
from typing import Optional

from .models import (
    ExtractionResult, ClassEntry, Deadline, Notice, MenuItem,
)

logger = logging.getLogger(__name__)

EXTRACTOR_MODE = os.environ.get("EXTRACTOR_MODE", "stub")


def extract_structured_data(
    file_bytes: bytes,
    filename: str,
    content_type: str = "image/png",
) -> ExtractionResult:
    """
    Main entry point: extract structured data from a campus document.

    Args:
        file_bytes: Raw file content
        filename: Original filename (used for type inference)
        content_type: MIME type of the file

    Returns:
        ExtractionResult with all extracted entities
    """
    if EXTRACTOR_MODE == "bedrock":
        return _extract_with_bedrock(file_bytes, filename, content_type)
    else:
        return _extract_stub(filename)


def _extract_stub(filename: str) -> ExtractionResult:
    """
    Stub extractor: returns realistic sample data for local testing.
    No AWS calls needed.
    """
    logger.info(f"[STUB] Extracting from: {filename}")

    # Infer document type from filename
    fname_lower = filename.lower()
    if "timetable" in fname_lower or "schedule" in fname_lower:
        return _stub_timetable(filename)
    elif "menu" in fname_lower or "mess" in fname_lower:
        return _stub_menu(filename)
    elif "notice" in fname_lower or "circular" in fname_lower:
        return _stub_notice(filename)
    elif "deadline" in fname_lower or "assignment" in fname_lower:
        return _stub_deadline(filename)
    else:
        # Default: return a mixed result
        return _stub_mixed(filename)


def _stub_timetable(filename: str) -> ExtractionResult:
    """Return a realistic Indian college timetable."""
    classes = [
        ClassEntry(day="Monday", time="09:00", subject="Data Structures & Algorithms", location="LH-301", professor="Dr. Sharma", confidence=0.95),
        ClassEntry(day="Monday", time="11:00", subject="Digital Electronics", location="LH-204", professor="Prof. Gupta", confidence=0.92),
        ClassEntry(day="Monday", time="14:00", subject="DSA Lab", location="CC-Lab 2", professor="Dr. Sharma", confidence=0.88),
        ClassEntry(day="Tuesday", time="09:00", subject="Mathematics III", location="LH-301", professor="Dr. Verma", confidence=0.96),
        ClassEntry(day="Tuesday", time="11:00", subject="Computer Networks", location="LH-205", professor="Prof. Singh", confidence=0.91),
        ClassEntry(day="Wednesday", time="09:00", subject="Data Structures & Algorithms", location="LH-301", professor="Dr. Sharma", confidence=0.95),
        ClassEntry(day="Wednesday", time="11:00", subject="Digital Electronics Lab", location="EE-Lab 1", professor="Prof. Gupta", confidence=0.89),
        ClassEntry(day="Thursday", time="09:00", subject="Mathematics III", location="LH-301", professor="Dr. Verma", confidence=0.94),
        ClassEntry(day="Thursday", time="14:00", subject="Computer Networks Lab", location="CC-Lab 3", professor="Prof. Singh", confidence=0.87),
        ClassEntry(day="Friday", time="09:00", subject="Data Structures & Algorithms", location="LH-301", professor="Dr. Sharma", confidence=0.95),
        ClassEntry(day="Friday", time="11:00", subject="Soft Skills", location="LH-102", professor="Ms. Reddy", confidence=0.90),
    ]
    return ExtractionResult(
        document_type="timetable",
        classes=classes,
        overall_confidence=0.92,
        source_file=filename,
        raw_text="[Stub] B.Tech CSE Sem-3 Timetable, Section A",
    )


def _stub_menu(filename: str) -> ExtractionResult:
    """Return a realistic hostel mess menu."""
    menu_items = [
        MenuItem(meal="breakfast", day="Monday", items=["Poha", "Bread-Butter", "Tea", "Banana"], confidence=0.93),
        MenuItem(meal="lunch", day="Monday", items=["Rice", "Dal Tadka", "Aloo Gobi", "Roti", "Salad", "Curd"], confidence=0.91),
        MenuItem(meal="dinner", day="Monday", items=["Rice", "Rajma", "Paneer Butter Masala", "Roti", "Gulab Jamun"], confidence=0.89),
        MenuItem(meal="breakfast", day="Tuesday", items=["Idli-Sambar", "Toast", "Coffee", "Apple"], confidence=0.92),
        MenuItem(meal="lunch", day="Tuesday", items=["Rice", "Sambar", "Bhindi Fry", "Roti", "Papad", "Buttermilk"], confidence=0.90),
        MenuItem(meal="dinner", day="Tuesday", items=["Biryani", "Raita", "Mixed Veg", "Roti", "Ice Cream"], confidence=0.88),
    ]
    return ExtractionResult(
        document_type="menu",
        menu_items=menu_items,
        overall_confidence=0.91,
        source_file=filename,
        raw_text="[Stub] Boys Hostel Mess Menu - Week 12",
    )


def _stub_notice(filename: str) -> ExtractionResult:
    """Return a realistic campus notice."""
    notices = [
        Notice(
            id="notice-001",
            title="Mid-Semester Examination Schedule",
            body="Mid-semester examinations for B.Tech Sem-3 will be held from 15th October to 22nd October 2024. Students must carry their ID cards. Seating arrangement will be displayed on the department notice board.",
            date="2024-10-05",
            category="academic",
            confidence=0.94,
        ),
        Notice(
            id="notice-002",
            title="Hostel Water Supply Disruption",
            body="Due to maintenance work, water supply in Boys Hostel Block C will be disrupted on 8th October from 10 AM to 4 PM. Please store water in advance.",
            date="2024-10-06",
            category="hostel",
            confidence=0.91,
        ),
    ]
    return ExtractionResult(
        document_type="notice",
        notices=notices,
        overall_confidence=0.92,
        source_file=filename,
        raw_text="[Stub] Department of CSE - Official Notice",
    )


def _stub_deadline(filename: str) -> ExtractionResult:
    """Return realistic assignment deadlines."""
    deadlines = [
        Deadline(
            id="hw-dsa-3",
            title="DSA Assignment 3 - Binary Trees",
            subject="Data Structures & Algorithms",
            due_date="2024-10-12",
            description="Implement AVL tree insertion, deletion, and traversal. Submit on Moodle before 11:59 PM.",
            confidence=0.93,
        ),
        Deadline(
            id="hw-cn-lab2",
            title="CN Lab Report - Socket Programming",
            subject="Computer Networks",
            due_date="2024-10-14",
            description="Submit lab report with code and output screenshots. Email to prof.singh@college.edu",
            confidence=0.88,
        ),
    ]
    return ExtractionResult(
        document_type="deadline",
        deadlines=deadlines,
        overall_confidence=0.90,
        source_file=filename,
        raw_text="[Stub] Assignments Due This Week",
    )


def _stub_mixed(filename: str) -> ExtractionResult:
    """Return a mix of data types for unknown documents."""
    return ExtractionResult(
        document_type="mixed",
        classes=[
            ClassEntry(day="Monday", time="09:00", subject="Data Structures & Algorithms", location="LH-301", professor="Dr. Sharma", confidence=0.85),
        ],
        deadlines=[
            Deadline(id="hw-dsa-3", title="DSA Assignment 3", subject="DSA", due_date="2024-10-12", confidence=0.82),
        ],
        notices=[
            Notice(id="notice-gen-1", title="Placement Drive - TCS", body="TCS campus placement drive on 20th October. Eligible: CSE/IT with 7+ CGPA.", date="2024-10-08", category="placement", confidence=0.87),
        ],
        overall_confidence=0.85,
        source_file=filename,
        raw_text="[Stub] Mixed campus document",
    )


def _extract_with_bedrock(
    file_bytes: bytes,
    filename: str,
    content_type: str,
) -> ExtractionResult:
    """
    Real extraction using Amazon Bedrock (Claude vision) + Textract.

    Falls back to stub if Bedrock is unavailable.
    """
    try:
        # Determine if we should use Textract (clean PDF/table) or Claude vision (messy image)
        if content_type == "application/pdf" or filename.lower().endswith(".pdf"):
            raw_text = _call_textract(file_bytes)
        else:
            raw_text = None

        # Use Claude vision for structured extraction
        result = _call_claude_vision(file_bytes, filename, content_type, raw_text)
        return result

    except Exception as e:
        logger.error(f"Bedrock extraction failed, falling back to stub: {e}")
        return _extract_stub(filename)


def _call_textract(file_bytes: bytes) -> Optional[str]:
    """Call Amazon Textract for clean document text extraction."""
    try:
        import boto3
        client = boto3.client("textract", region_name=os.environ.get("AWS_REGION", "us-east-1"))
        response = client.analyze_document(
            Document={"Bytes": file_bytes},
            FeatureTypes=["TABLES", "FORMS", "LAYOUT"],
        )
        # Extract text blocks
        lines = []
        for block in response.get("Blocks", []):
            if block["BlockType"] == "LINE":
                lines.append(block.get("Text", ""))
        return "\n".join(lines)
    except Exception as e:
        logger.error(f"Textract call failed: {e}")
        return None


def _call_claude_vision(
    file_bytes: bytes,
    filename: str,
    content_type: str,
    textract_text: Optional[str] = None,
) -> ExtractionResult:
    """
    Call Claude on Bedrock for multimodal extraction.
    Returns structured JSON parsed into ExtractionResult.
    """
    import base64
    import boto3

    client = boto3.client("bedrock-runtime", region_name=os.environ.get("AWS_REGION", "us-east-1"))

    # Build the prompt
    system_prompt = """You are a document extraction AI for an Indian college student's campus documents. 
Extract structured data from the provided image/document. Return STRICT JSON with the following schema:
{
  "document_type": "timetable|menu|notice|deadline|mixed",
  "classes": [{"day": "", "time": "", "subject": "", "location": "", "professor": "", "confidence": 0.0}],
  "deadlines": [{"id": "", "title": "", "subject": "", "due_date": "YYYY-MM-DD", "description": "", "confidence": 0.0}],
  "notices": [{"id": "", "title": "", "body": "", "date": "YYYY-MM-DD", "category": "academic|hostel|placement|event|general", "confidence": 0.0}],
  "menu_items": [{"meal": "breakfast|lunch|dinner", "day": "", "items": [], "confidence": 0.0}],
  "overall_confidence": 0.0,
  "raw_text": ""
}
Use null for unreadable fields. Include a confidence score (0-1) per field. Only include arrays that have data."""

    user_content = []

    # Add image
    if content_type.startswith("image/"):
        media_type = content_type
        image_data = base64.b64encode(file_bytes).decode("utf-8")
        user_content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": media_type, "data": image_data},
        })

    # Add textract text if available
    text_prompt = f"Extract structured data from this campus document: {filename}"
    if textract_text:
        text_prompt += f"\n\nTextract OCR output:\n{textract_text}"
    user_content.append({"type": "text", "text": text_prompt})

    # Call Claude
    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 4096,
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_content}],
    })

    response = client.invoke_model(
        modelId="anthropic.claude-3-sonnet-20240229-v1:0",
        body=body,
        contentType="application/json",
        accept="application/json",
    )

    response_body = json.loads(response["body"].read())
    assistant_text = response_body["content"][0]["text"]

    # Parse the JSON response
    # Claude sometimes wraps in markdown code blocks
    if "```json" in assistant_text:
        assistant_text = assistant_text.split("```json")[1].split("```")[0]
    elif "```" in assistant_text:
        assistant_text = assistant_text.split("```")[1].split("```")[0]

    data = json.loads(assistant_text.strip())

    # Convert to ExtractionResult
    result = ExtractionResult(
        document_type=data.get("document_type", "unknown"),
        overall_confidence=data.get("overall_confidence", 0.0),
        source_file=filename,
        raw_text=data.get("raw_text", ""),
    )

    for c in data.get("classes", []):
        result.classes.append(ClassEntry(**{k: v for k, v in c.items() if k in ClassEntry.__dataclass_fields__}))
    for d in data.get("deadlines", []):
        result.deadlines.append(Deadline(**{k: v for k, v in d.items() if k in Deadline.__dataclass_fields__}))
    for n in data.get("notices", []):
        result.notices.append(Notice(**{k: v for k, v in n.items() if k in Notice.__dataclass_fields__}))
    for m in data.get("menu_items", []):
        result.menu_items.append(MenuItem(**{k: v for k, v in m.items() if k in MenuItem.__dataclass_fields__}))

    return result
