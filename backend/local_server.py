"""
CampusFlow Local Backend Server (v2 — all bugs fixed)

FastAPI server with real Groq AI pipelines.
Handles: PDFs (text extraction + fallback to page-as-image), images (Groq vision),
Q&A with full context, intent detection for add/remove operations.

Start: /Library/Developer/CommandLineTools/usr/bin/python3 -m uvicorn local_server:app --host 0.0.0.0 --port 8000
"""

import sys
import os
import json
import base64
import logging
import re
import ssl
import urllib.parse
import urllib.request
import urllib.error
from pathlib import Path
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "shared"))
sys.path.insert(0, "/Users/sparshgarg/Library/Python/3.9/lib/python/site-packages")

os.environ.setdefault("EXTRACTOR_MODE", "free")
os.environ.setdefault("LLM_PROVIDER_TEXT", "groq")
os.environ.setdefault("LLM_PROVIDER_VISION", "groq")

from fastapi import FastAPI, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from shared.llm_provider import call_text_llm, call_vision_llm
from shared.models import ExtractionResult, ClassEntry, Deadline, Notice, MenuItem

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="CampusFlow Local Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = Path(__file__).parent / "local_db.json"


# ═══════════════════════════════════════════════════════════════════════════════
# LOCAL JSON DATABASE
# ═══════════════════════════════════════════════════════════════════════════════

def _load_db() -> dict:
    if DB_PATH.exists():
        return json.loads(DB_PATH.read_text())
    return {}

def _save_db(db: dict):
    DB_PATH.write_text(json.dumps(db, indent=2, default=str))

def _get_student(sid: str) -> dict:
    db = _load_db()
    if sid not in db:
        db[sid] = {"classes": [], "deadlines": [], "notices": [],
                   "menu_items": [], "events": [], "placements": [], "profile": {}}
        _save_db(db)
    return db[sid]

def _save_student(sid: str, data: dict):
    db = _load_db()
    db[sid] = data
    _save_db(db)


# ═══════════════════════════════════════════════════════════════════════════════
# BUG 1 FIX: SMART PDF/IMAGE EXTRACTION
# ═══════════════════════════════════════════════════════════════════════════════

EXTRACTION_PROMPT = """You are a document extraction AI for Indian college campus documents.
Analyze the content and extract structured data. Return STRICT JSON only — no prose, no markdown fences.

Determine the document type and use the matching schema:

IF MESS MENU → use this structure:
{"doc_type":"mess_menu","days":[{"day":"Monday","breakfast":["item1","item2"],"lunch":["item1","item2"],"snacks":["item1","item2"],"dinner":["item1","item2"]},{"day":"Tuesday","breakfast":[...],"lunch":[...],"snacks":[...],"dinner":[...]},...]}
- Map each meal to its OWN items — do NOT put dinner items under lunch.
- Each meal should have 2-8 items from THAT specific cell/column.
- Include snacks if present in the document.
- If 7 days present, output exactly 7 day entries.
- Keep item names SHORT (e.g. "Aloo Paratha" not "Aloo Paratha with green chutney and curd").

IF TIMETABLE → use this structure:
{"doc_type":"timetable","classes":[{"day":"Monday","time":"09:00","subject":"DSA","location":"LH-301","professor":"Dr. Sharma"},...]}}

IF NOTICE/CIRCULAR → use:
{"doc_type":"notice","notices":[{"title":"...","body":"...","date":"YYYY-MM-DD","category":"academic|hostel|placement|event"}],"deadlines":[{"title":"...","subject":"...","due_date":"YYYY-MM-DD","description":"..."}]}
NOTE: If a notice ALSO contains a deadline/reminder (e.g. "Assignment due on..."), extract BOTH the notice AND the deadline.

IF DEADLINE/ASSIGNMENT → use:
{"doc_type":"deadline","deadlines":[{"title":"...","subject":"...","due_date":"YYYY-MM-DD","description":"..."}]}

IF PLACEMENT → use:
{"doc_type":"placement","placements":[{"company":"...","role":"...","ctc":"...","cgpa_cutoff":"...","registration_deadline":"YYYY-MM-DD","test_date":"YYYY-MM-DD"}]}

RULES:
- Return ONLY the JSON object. No explanation, no markdown code fences.
- If a field is missing or unreadable, use an empty array or null — never guess.
- Use the EXACT structure above for the detected type."""


def _extract_from_file(file_bytes: bytes, filename: str, content_type: str) -> dict:
    """
    Smart extraction: handles PDFs (text-first, image-fallback) and images.
    Returns raw parsed JSON dict from LLM.
    """
    is_pdf = content_type == "application/pdf" or filename.lower().endswith(".pdf")

    if is_pdf:
        return _extract_pdf(file_bytes, filename)
    else:
        return _extract_image(file_bytes, filename, content_type)


def _extract_pdf(file_bytes: bytes, filename: str) -> dict:
    """Extract from PDF: try text layer first, then render pages as images."""
    import fitz  # PyMuPDF

    doc = fitz.open(stream=file_bytes, filetype="pdf")
    
    # Step 1: Try extracting text (works for text-based PDFs)
    all_text = ""
    for page in doc:
        all_text += page.get_text() + "\n"
    all_text = all_text.strip()

    if len(all_text) > 50:
        # Good text content — send to Groq text model
        logger.info(f"[PDF] Text layer found ({len(all_text)} chars), using text model")
        prompt = EXTRACTION_PROMPT + f"\n\nDocument ({filename}):\n{all_text[:6000]}"
        response = call_text_llm("Return ONLY strict JSON, no explanation.", prompt)
        result = _parse_llm_json(response)
        if result:
            return result

    # Step 2: Scanned PDF — render first page as image, send to vision
    logger.info(f"[PDF] No usable text, rendering page as image for vision model")
    page = doc[0]
    pix = page.get_pixmap(dpi=150)
    img_bytes = pix.tobytes("png")
    doc.close()

    return _extract_image(img_bytes, filename, "image/png")


def _extract_image(file_bytes: bytes, filename: str, content_type: str) -> dict:
    """Extract from image using Groq vision model."""
    logger.info(f"[IMAGE] Sending to Groq vision ({len(file_bytes)} bytes)")
    prompt = EXTRACTION_PROMPT + f"\n\nFilename: {filename}"
    response = call_vision_llm(file_bytes, prompt, content_type or "image/png")
    result = _parse_llm_json(response)
    if result:
        return result
    return {}


def _parse_llm_json(response: str) -> dict:
    """Safely parse JSON from LLM response. Strips code fences, handles truncation."""
    if not response:
        return {}
    text = response.strip()
    # Strip markdown fences
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0]
    elif "```" in text:
        parts = text.split("```")
        if len(parts) >= 2:
            text = parts[1]
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to fix truncated JSON by progressively trimming from end
        # This handles cases where the response was cut off mid-JSON
        for i in range(len(text) - 1, max(0, len(text) - 200), -1):
            if text[i] in ('}', ']'):
                candidate = text[:i+1]
                # Try to close any open structures
                open_braces = candidate.count('{') - candidate.count('}')
                open_brackets = candidate.count('[') - candidate.count(']')
                candidate += ']' * open_brackets + '}' * open_braces
                try:
                    return json.loads(candidate)
                except json.JSONDecodeError:
                    continue
        logger.error(f"JSON parse failed completely.\nRaw:\n{response[:300]}")
        return {}


def _normalize_extraction(raw: dict, filename: str) -> dict:
    """Convert raw LLM JSON into the standard frontend shape."""
    doc_type = raw.get("doc_type", raw.get("document_type", "unknown"))

    result = {
        "document_type": doc_type,
        "classes": [],
        "deadlines": [],
        "notices": [],
        "menu_items": [],
        "events": [],
        "placements": [],
        "overall_confidence": 0.85,
        "source_file": filename,
        "raw_text": "",
    }

    # Mess menu: convert days[] structure → flat menu_items[]
    if doc_type == "mess_menu" and "days" in raw:
        for day_obj in raw["days"]:
            day_name = day_obj.get("day", "")
            for meal in ["breakfast", "lunch", "snacks", "dinner"]:
                items = day_obj.get(meal, [])
                if items:
                    result["menu_items"].append({
                        "meal": meal, "day": day_name,
                        "items": items, "confidence": 0.9,
                    })

    # Timetable
    if "classes" in raw:
        for c in raw["classes"]:
            result["classes"].append({
                "day": c.get("day", ""), "time": c.get("time", ""),
                "subject": c.get("subject", ""), "location": c.get("location", ""),
                "professor": c.get("professor", ""), "confidence": 0.9,
            })

    # Deadlines
    if "deadlines" in raw:
        for i, d in enumerate(raw["deadlines"]):
            result["deadlines"].append({
                "id": d.get("id", f"dl-{i}"), "title": d.get("title", ""),
                "subject": d.get("subject", ""), "due_date": d.get("due_date", ""),
                "description": d.get("description", ""), "confidence": 0.9,
            })

    # Notices
    if "notices" in raw:
        for i, n in enumerate(raw["notices"]):
            result["notices"].append({
                "id": n.get("id", f"notice-{i}"), "title": n.get("title", ""),
                "body": n.get("body", ""), "date": n.get("date", ""),
                "category": n.get("category", "general"), "confidence": 0.9,
            })

    # Placements
    if "placements" in raw:
        for i, p in enumerate(raw["placements"]):
            result["placements"].append({
                "id": p.get("id", f"placement-{i}"), "company": p.get("company", ""),
                "role": p.get("role", ""), "ctc": p.get("ctc", ""),
                "cgpa_cutoff": p.get("cgpa_cutoff", ""),
                "registration_deadline": p.get("registration_deadline", ""),
                "test_date": p.get("test_date", ""), "confidence": 0.9,
            })

    return result


# ═══════════════════════════════════════════════════════════════════════════════
# BUG 3 FIX: FULL CONTEXT Q&A  +  BUG 4 FIX: INTENT DETECTION
# ═══════════════════════════════════════════════════════════════════════════════

def _build_full_context(student_data: dict) -> str:
    """Build complete context string from ALL student data."""
    parts = []

    if student_data.get("classes"):
        parts.append("TIMETABLE/CLASSES:")
        for c in student_data["classes"]:
            parts.append(f"  {c.get('day')} {c.get('time')} — {c.get('subject')} at {c.get('location','')} (Prof: {c.get('professor','')})")

    if student_data.get("deadlines"):
        parts.append("\nDEADLINES:")
        for d in student_data["deadlines"]:
            parts.append(f"  • {d.get('title')} [{d.get('subject')}] — due {d.get('due_date')} — {d.get('description','')}")

    if student_data.get("menu_items"):
        parts.append("\nMESS MENU:")
        for m in student_data["menu_items"]:
            parts.append(f"  {m.get('day')} {m.get('meal')}: {', '.join(m.get('items',[]))}")

    if student_data.get("notices"):
        parts.append("\nNOTICES:")
        for n in student_data["notices"]:
            parts.append(f"  [{n.get('category','general')}] {n.get('title')}: {n.get('body','')[:120]}")

    if student_data.get("placements"):
        parts.append("\nPLACEMENTS:")
        for p in student_data["placements"]:
            parts.append(f"  {p.get('company')} — {p.get('role')} — CTC: {p.get('ctc')} — Test: {p.get('test_date')} — Register by: {p.get('registration_deadline')}")

    if student_data.get("events"):
        parts.append("\nEVENTS:")
        for e in student_data["events"]:
            parts.append(f"  {e.get('name')} — {e.get('venue')} — {e.get('datetime')}")

    return "\n".join(parts) if parts else ""


def _detect_intent_and_respond(question: str, student_data: dict) -> dict:
    """
    Classify user intent and respond accordingly.
    Intents: QUESTION, ADD_DEADLINE, ADD_EVENT, REMOVE_DEADLINE, REMOVE_ALL
    """
    today = datetime.now()
    today_str = today.strftime("%A, %d %B %Y")

    intent_prompt = f"""Classify this user message and extract structured data.
Today is {today_str}.
IMPORTANT: Look at the recent conversation context below. If the user is RESPONDING to a previous question from the assistant (e.g. answering a follow-up like "what equipment do you have?"), classify as QUESTION so the assistant can continue the conversation contextually.

Recent conversation:
{chr(10).join(f"{'User' if m.get('role')=='user' else 'Assistant'}: {m.get('content','')[:100]}" for m in student_data.get('_chat_history', [])[-4:])}

User message: "{question}"

Return STRICT JSON (no explanation):
{{
  "intent": "QUESTION|ADD_DEADLINE|ADD_EVENT|ADD_INTENT|ADD_PLAN|COMPLETE_INTENT|UPDATE_MENU|UPDATE_PLACEMENT|UPDATE_TIMETABLE|REMOVE_DEADLINE|REMOVE_ALL_DEADLINES|REMOVE_TIMETABLE|REMOVE_MENU|REMOVE_PLACEMENTS|REMOVE_ALL",
  "fields": {{
    "title": "extracted title if adding/updating",
    "subject": "course/subject if mentioned",
    "due_date": "YYYY-MM-DD (resolve relative dates)",
    "event_name": "event name if adding event",
    "event_date": "YYYY-MM-DD",
    "remove_title": "title to remove if removing specific item",
    "day": "day of week if updating menu/timetable for specific day",
    "meal": "breakfast|lunch|snacks|dinner if updating menu",
    "items": ["list of items if updating menu"],
    "time": "HH:MM if updating timetable",
    "location": "room/location if updating timetable",
    "company": "company name if updating placement",
    "test_date": "YYYY-MM-DD if updating placement test date",
    "registration_deadline": "YYYY-MM-DD if updating placement registration",
    "intent_text": "the full intent/goal statement if ADD_INTENT",
    "intent_topic": "short topic keyword for the intent",
    "complete_topic": "topic of intent to mark as done if COMPLETE_INTENT"
  }}
}}

Rules:
- QUESTION: asking for info (what's for lunch, when is test, etc.)
- ADD_DEADLINE: "add deadline/assignment/homework for X"
- ADD_EVENT: "add event X"
- UPDATE_MENU: "update Monday lunch to ...", "change dinner for Tuesday to ..."
- UPDATE_PLACEMENT: "update Amazon test date to ...", "change placement info ..."
- UPDATE_TIMETABLE: "change Monday 9am class to ...", "update my schedule ..."
- REMOVE_DEADLINE: "remove/delete the maths deadline"
- REMOVE_ALL_DEADLINES: "remove all deadlines", "clear all deadlines"
- REMOVE_TIMETABLE: "remove timetable", "clear my schedule", "delete classes"
- REMOVE_MENU: "remove mess menu", "clear menu data"
- REMOVE_PLACEMENTS: "remove placement data", "clear placements"
- REMOVE_ALL: "clear everything", "remove all data", "reset"
- ADD_INTENT: student states something they want to stay on top of / remember (e.g. "I need to solve PYQs before end-sems", "remind me to prepare for Amazon test", "I want to gym 3x a week"). NOT a specific deadline with a date — more of a goal/reminder.
- ADD_PLAN: student asks to CREATE A PLAN or CHECKLIST (e.g. "create a 3 day gym plan", "make a DSA study plan for this week", "plan my exam prep"). This generates structured steps.
- COMPLETE_INTENT: student says they finished something they previously said they needed to do (e.g. "I finished the PYQs", "done with gym this week")
- Resolve relative dates: 'coming Monday' = next Monday, 'tomorrow' = tomorrow
- Today = {today.strftime('%Y-%m-%d')} ({today_str})"""

    response = call_text_llm("Return only JSON.", intent_prompt)
    parsed = _parse_llm_json(response)

    if not parsed or parsed.get("intent") == "QUESTION":
        # Check for system intro request (adaptive follow-up)
        if question == "__SYSTEM_INTRO__":
            return _generate_adaptive_intro(student_data)
        # Regular Q&A
        return _answer_question(question, student_data)

    intent = parsed.get("intent", "QUESTION")
    fields = parsed.get("fields", {})

    if intent == "ADD_DEADLINE":
        return _add_deadline(fields, student_data)
    elif intent == "ADD_EVENT":
        return _add_event(fields, student_data)
    elif intent == "ADD_INTENT":
        return _add_intent(fields, student_data)
    elif intent == "ADD_PLAN":
        return _add_plan(fields, student_data)
    elif intent == "COMPLETE_INTENT":
        return _complete_intent(fields, student_data)
    elif intent == "UPDATE_MENU":
        return _update_menu(fields, student_data)
    elif intent == "UPDATE_PLACEMENT":
        return _update_placement(fields, student_data)
    elif intent == "UPDATE_TIMETABLE":
        return _update_timetable(fields, student_data)
    elif intent == "REMOVE_DEADLINE":
        return _remove_deadline(fields, student_data)
    elif intent == "REMOVE_ALL_DEADLINES":
        return _remove_all_deadlines(student_data)
    elif intent == "REMOVE_TIMETABLE":
        return _remove_category(student_data, "classes", "timetable/classes")
    elif intent == "REMOVE_MENU":
        return _remove_category(student_data, "menu_items", "mess menu")
    elif intent == "REMOVE_PLACEMENTS":
        return _remove_category(student_data, "placements", "placements")
    elif intent == "REMOVE_ALL":
        return _remove_all(student_data)
    else:
        return _answer_question(question, student_data)


def _generate_adaptive_intro(student_data: dict) -> dict:
    """Generate a personalized intro + adaptive follow-up question based on profile."""
    profile = student_data.get("profile", {})
    agent_name = profile.get("agentName", "Flow")
    user_name = profile.get("name", "there")
    priorities = profile.get("priorities", ["Academics"])
    placement = profile.get("placementFocus", "Not yet")
    intents = [i for i in student_data.get("intents", []) if i.get("status") == "open"]

    system = f"You are {agent_name}, a warm and proactive campus assistant. Generate a SHORT personalized intro (1-2 sentences) + ask ONE smart follow-up question based on the student's profile. Be warm, concise."
    prompt = f"""Student profile:
- Name: {user_name}
- Priorities: {', '.join(priorities)}
- Placement focus: {placement}
- End-sem date: {profile.get('endSemDate', 'not set')}
- Focus time: {profile.get('focusTime', 'Flexible')}
- Open goals: {', '.join(i.get('text','') for i in intents) if intents else 'none yet'}

Write a 2-3 sentence intro as {agent_name}:
1. Greet {user_name} warmly, introduce yourself by name
2. Reference ONE of their priorities/goals
3. Ask ONE specific follow-up question that would help you assist them better (e.g. if placement-focused: "Which companies are you targeting?" or if they have an intent about PYQs: "Which subjects' PYQs should we focus on first?")

Keep it natural, under 50 words total."""

    answer = call_text_llm(system, prompt)
    if not answer:
        answer = f"Hey {user_name}! I'm {agent_name}, your campus assistant. What can I help you with today?"
    return {"answer": answer, "sources": ["intro"]}


def _answer_question(question: str, student_data: dict) -> dict:
    """Answer a question grounded in full student context."""
    context = _build_full_context(student_data)

    today_name = datetime.now().strftime("%A")
    today_date = datetime.now().strftime("%Y-%m-%d")
    profile = student_data.get("profile", {})
    agent_name = profile.get("agentName", "Flow")
    user_name = profile.get("name", "there")

    # If asking about contests, include contest data
    q_lower = question.lower()
    contest_ctx = ""
    if any(w in q_lower for w in ["contest", "codeforces", "leetcode", "competitive", "cp"]):
        try:
            # Fetch contests synchronously
            ctx_ssl = ssl.create_default_context()
            req = urllib.request.Request("https://codeforces.com/api/contest.list",
                                         headers={"User-Agent": "CampusFlow/1.0"})
            with urllib.request.urlopen(req, timeout=8, context=ctx_ssl) as resp:
                data = json.loads(resp.read().decode())
                if data.get("status") == "OK":
                    upcoming = [c for c in data["result"] if c.get("phase") == "BEFORE"][:5]
                    contest_ctx = "\n\nUPCOMING CODING CONTESTS:\n" + "\n".join(
                        f"  - {c['name']} (starts {datetime.fromtimestamp(c['startTimeSeconds']).strftime('%b %d, %H:%M')})"
                        for c in upcoming
                    )
        except Exception:
            pass

    if not context and not contest_ctx:
        return {"answer": f"I don't have any data yet! Upload your timetable, mess menu, or notices first. — {agent_name}", "sources": []}

    system = f"""You are {agent_name}, a proactive campus assistant for {user_name} (an Indian college student).
Today is {today_name}, {today_date}.
Answer ONLY from the context below. If 'today' is mentioned, use {today_name}.
Be concise, warm, and specific. Use bullet points for lists. Never make up data not in the context.
Never ask the user what day it is. Refer to yourself as {agent_name}.
Sign off briefly with your name when appropriate.
IMPORTANT: You have memory of the recent conversation. Use it to give contextual, follow-up aware answers."""

    # Build conversation history context
    chat_history = student_data.get("_chat_history", [])
    history_ctx = ""
    if chat_history:
        recent = chat_history[-6:]  # Last 6 messages for context
        history_ctx = "\n\nRECENT CONVERSATION:\n" + "\n".join(
            f"{'User' if m.get('role')=='user' else agent_name}: {m.get('content','')[:150]}"
            for m in recent
        )

    user = f"Student's data:\n{context}{contest_ctx}{history_ctx}\n\nQuestion: {question}"
    answer = call_text_llm(system, user)

    # Determine sources
    sources = []
    if any(w in q_lower for w in ["menu", "mess", "food", "lunch", "dinner", "breakfast", "eat"]):
        sources.append("mess_menu")
    if any(w in q_lower for w in ["class", "schedule", "timetable", "lecture"]):
        sources.append("timetable")
    if any(w in q_lower for w in ["deadline", "assignment", "due", "submit"]):
        sources.append("deadlines")
    if any(w in q_lower for w in ["notice", "circular", "hostel", "water"]):
        sources.append("notices")
    if any(w in q_lower for w in ["placement", "company", "amazon", "tcs", "intern"]):
        sources.append("placements")
    if any(w in q_lower for w in ["contest", "codeforces", "leetcode", "competitive"]):
        sources.append("codeforces_api")
    if not sources:
        sources.append("student_data")

    return {"answer": answer or f"Sorry, couldn't process that. — {agent_name}", "sources": sources}


def _add_deadline(fields: dict, student_data: dict) -> dict:
    """Add a deadline to student data."""
    title = fields.get("title", "Untitled")
    subject = fields.get("subject", "")
    due_date = fields.get("due_date", "")

    # Don't allow "Untitled" — use subject as title if title is missing
    if title == "Untitled" or not title:
        title = subject or "New deadline"

    new_deadline = {
        "id": f"dl-{int(datetime.now().timestamp())}",
        "title": title,
        "subject": subject,
        "due_date": due_date,
        "description": "",
        "confidence": 1.0,
    }
    student_data["deadlines"].append(new_deadline)

    due_str = f", due {due_date}" if due_date else ""
    subj_str = f" ({subject})" if subject and subject != title else ""
    return {
        "answer": f"✅ Added deadline: **{title}**{subj_str}{due_str}.\nIt'll show up in your Today tab!",
        "sources": ["action:add_deadline"],
        "deadline": new_deadline,
    }


def _add_event(fields: dict, student_data: dict) -> dict:
    """Add an event to student data."""
    name = fields.get("event_name", fields.get("title", "Untitled Event"))
    date = fields.get("event_date", "")

    new_event = {
        "id": f"ev-{int(datetime.now().timestamp())}",
        "name": name, "datetime": date, "venue": "", "club": "",
        "confidence": 1.0,
    }
    student_data.setdefault("events", []).append(new_event)
    return {
        "answer": f"✅ Added event: **{name}** on {date}.",
        "sources": ["action:add_event"],
    }


def _add_intent(fields: dict, student_data: dict) -> dict:
    """Add an intent/goal to student data."""
    text = fields.get("intent_text", fields.get("title", ""))
    topic = fields.get("intent_topic", text.split()[:3] if text else "goal")
    if isinstance(topic, list):
        topic = " ".join(topic)

    if not text:
        return {"answer": "What would you like me to remember?", "sources": []}

    new_intent = {
        "id": f"intent_{int(datetime.now().timestamp())}",
        "text": text,
        "topic": topic,
        "relatedTo": "",
        "status": "open",
        "createdAt": datetime.now().isoformat(),
    }
    student_data.setdefault("intents", []).append(new_intent)
    return {
        "answer": f"Got it — I'll remind you about **{text}**. This will show up in my nudges when it's relevant! 📝",
        "sources": ["action:add_intent"],
        "intent": new_intent,
    }


def _add_plan(fields: dict, student_data: dict) -> dict:
    """Generate a multi-step plan/checklist using Groq and store as an intent with steps."""
    text = fields.get("intent_text", fields.get("title", ""))
    if not text:
        return {"answer": "What should I create a plan for?", "sources": []}

    profile = student_data.get("profile", {})
    agent_name = profile.get("agentName", "Flow")

    # Generate plan via Groq
    system = f"You are {agent_name}. Generate a short, actionable plan/checklist."
    prompt = f"""Create a concise plan for: "{text}"

Return STRICT JSON (no explanation):
{{"plan_title": "short title", "steps": ["Step 1: ...", "Step 2: ...", "Step 3: ..."], "duration": "3 days/1 week/etc", "tips": "one motivational tip"}}

Keep it to 3-6 steps. Be specific and actionable. If it's fitness, include exercises. If study, include topics."""

    response = call_text_llm(system, prompt)
    plan_data = _parse_llm_json(response)

    if not plan_data or "steps" not in plan_data:
        # Fallback: store as regular intent
        return _add_intent(fields, student_data)

    # Store as an intent with steps
    new_intent = {
        "id": f"plan_{int(datetime.now().timestamp())}",
        "text": plan_data.get("plan_title", text),
        "topic": text.split()[:3] if text else ["plan"],
        "relatedTo": plan_data.get("duration", ""),
        "status": "open",
        "steps": plan_data.get("steps", []),
        "createdAt": datetime.now().isoformat(),
    }
    if isinstance(new_intent["topic"], list):
        new_intent["topic"] = " ".join(new_intent["topic"])

    student_data.setdefault("intents", []).append(new_intent)

    # Format nice response
    steps_str = "\n".join(f"  {s}" for s in plan_data["steps"])
    tip = plan_data.get("tips", "")

    return {
        "answer": f"📋 **{plan_data.get('plan_title', text)}** ({plan_data.get('duration', '')}):\n\n{steps_str}\n\n💡 {tip}\n\nI've added this to your Goals — check the Today tab!",
        "sources": ["action:add_intent"],
        "intent": new_intent,
    }


def _complete_intent(fields: dict, student_data: dict) -> dict:
    """Mark an intent as done."""
    topic = fields.get("complete_topic", fields.get("intent_topic", fields.get("title", "")))
    if not topic:
        return {"answer": "What did you finish? I'll mark it done.", "sources": []}

    found = False
    for intent in student_data.get("intents", []):
        if intent["status"] == "open" and topic.lower() in intent.get("text", "").lower():
            intent["status"] = "done"
            found = True
            break

    if found:
        return {"answer": f"🎉 Awesome! Marked **{topic}** as done. I won't nudge about it anymore.", "sources": ["action:complete_intent"]}
    return {"answer": f"Couldn't find an open goal matching '{topic}'.", "sources": []}


def _remove_deadline(fields: dict, student_data: dict) -> dict:
    """Remove a deadline by fuzzy title match."""
    search = (fields.get("remove_title", "") or fields.get("title", "")).lower()
    # Split into keywords for fuzzy matching
    keywords = [w for w in search.split() if len(w) > 2]

    before = len(student_data["deadlines"])
    if keywords:
        student_data["deadlines"] = [
            d for d in student_data["deadlines"]
            if not any(kw in d.get("title", "").lower() for kw in keywords)
        ]
    removed = before - len(student_data["deadlines"])
    if removed:
        return {"answer": f"✅ Removed {removed} deadline(s).", "sources": ["action:remove"]}
    return {"answer": f"Couldn't find a deadline matching '{search}'.", "sources": []}


def _remove_all(student_data: dict) -> dict:
    """Clear ALL student data (only when user explicitly says 'clear everything')."""
    for key in ["classes", "deadlines", "notices", "menu_items", "events", "placements"]:
        student_data[key] = []
    return {"answer": "✅ All data cleared.", "sources": ["action:clear"]}


def _remove_all_deadlines(student_data: dict) -> dict:
    """Clear only deadlines."""
    count = len(student_data["deadlines"])
    student_data["deadlines"] = []
    return {"answer": f"✅ Removed all {count} deadline(s). Timetable and menu are untouched.", "sources": ["action:remove"]}


def _remove_category(student_data: dict, key: str, label: str) -> dict:
    """Remove a specific data category."""
    count = len(student_data.get(key, []))
    student_data[key] = []
    return {"answer": f"✅ Removed all {label} data ({count} items). Other data is untouched.", "sources": ["action:remove"]}


def _update_menu(fields: dict, student_data: dict) -> dict:
    """Update menu for a specific day+meal."""
    day = fields.get("day", "")
    meal = fields.get("meal", "")
    items = fields.get("items", [])

    if not day or not meal or not items:
        return {"answer": "Please specify the day, meal, and items. E.g. 'update Monday lunch to Rice, Dal, Roti'", "sources": []}

    # Remove existing entry for this day+meal
    student_data["menu_items"] = [
        m for m in student_data.get("menu_items", [])
        if not (m.get("day", "").lower() == day.lower() and m.get("meal", "").lower() == meal.lower())
    ]
    # Add new entry
    student_data["menu_items"].append({
        "meal": meal.lower(), "day": day.capitalize(),
        "items": items, "confidence": 1.0,
    })
    items_str = ", ".join(items)
    return {"answer": f"✅ Updated {day.capitalize()} {meal}: {items_str}", "sources": ["action:remove"]}


def _update_placement(fields: dict, student_data: dict) -> dict:
    """Update placement info."""
    company = fields.get("company", "")

    if not company and student_data.get("placements"):
        # Update the first/only placement
        p = student_data["placements"][0]
        updated = []
        if fields.get("test_date"):
            p["test_date"] = fields["test_date"]
            updated.append(f"test date → {fields['test_date']}")
        if fields.get("registration_deadline"):
            p["registration_deadline"] = fields["registration_deadline"]
            updated.append(f"registration deadline → {fields['registration_deadline']}")
        if fields.get("title"):
            p["role"] = fields["title"]
            updated.append(f"role → {fields['title']}")
        if updated:
            return {"answer": f"✅ Updated placement: {', '.join(updated)}", "sources": ["action:remove"]}

    # Update specific company
    for p in student_data.get("placements", []):
        if company.lower() in p.get("company", "").lower():
            if fields.get("test_date"):
                p["test_date"] = fields["test_date"]
            if fields.get("registration_deadline"):
                p["registration_deadline"] = fields["registration_deadline"]
            return {"answer": f"✅ Updated {p['company']} placement info.", "sources": ["action:remove"]}

    return {"answer": "Couldn't find that placement to update. Try uploading the placement notice.", "sources": []}


def _update_timetable(fields: dict, student_data: dict) -> dict:
    """Update a timetable entry."""
    day = fields.get("day", "")
    time_val = fields.get("time", "")
    subject = fields.get("subject", fields.get("title", ""))
    location = fields.get("location", "")

    if not day or not subject:
        return {"answer": "Please specify day, time, and subject. E.g. 'update Monday 9am to Maths in LH-301'", "sources": []}

    # If time given, update/add specific slot
    if time_val:
        # Remove old entry at that slot
        student_data["classes"] = [
            c for c in student_data.get("classes", [])
            if not (c.get("day", "").lower() == day.lower() and c.get("time", "") == time_val)
        ]
        # Add new
        student_data["classes"].append({
            "day": day.capitalize(), "time": time_val,
            "subject": subject, "location": location, "professor": "", "confidence": 1.0,
        })
        return {"answer": f"✅ Updated {day.capitalize()} {time_val}: {subject} at {location or 'TBD'}", "sources": ["action:remove"]}

    return {"answer": f"✅ Noted: {subject} on {day}. Specify a time for exact scheduling.", "sources": ["action:remove"]}


# ═══════════════════════════════════════════════════════════════════════════════
# SNS EMAIL ALERTS
# ═══════════════════════════════════════════════════════════════════════════════

SNS_TOPIC_ARN = "arn:aws:sns:us-east-1:070025263888:CampusFlowTest"
_alerted: dict = {}  # Track {deadline_id: True} — send only ONCE per deadline

def _send_urgent_alerts(student_data: dict):
    """Send email via SNS for deadlines within 7 days. Only once per deadline."""
    import boto3
    now = datetime.now()

    for d in student_data.get("deadlines", []):
        dl_id = d.get("id", "")
        if dl_id in _alerted:
            continue  # Already sent for this deadline, skip forever

        due_str = d.get("due_date", "")
        if not due_str:
            continue

        try:
            due_date = datetime.strptime(due_str, "%Y-%m-%d")
            hours_left = (due_date - now).total_seconds() / 3600

            if hours_left < 0 or hours_left > 168:
                continue

            try:
                client = boto3.client("sns", region_name="us-east-1")

                if hours_left <= 24:
                    urgency = "🚨 URGENT — DUE IN LESS THAN 24 HOURS!"
                elif hours_left <= 48:
                    urgency = f"⚠️ Due in {int(hours_left)} hours"
                else:
                    urgency = f"⏰ Due in {int(hours_left // 24)} day(s)"

                subject = f"CampusFlow: {d.get('title', 'Deadline')} — {urgency[:40]}"
                message = f"""Hi Aarav,

Your deadline is approaching:

📝 {d.get('title', 'Untitled')}
📚 Subject: {d.get('subject', 'N/A')}
📅 Due: {due_str}
📋 {d.get('description', '')}

{urgency}

— CampusFlow"""

                client.publish(TopicArn=SNS_TOPIC_ARN, Subject=subject[:100], Message=message)
                _alerted[dl_id] = True
                logger.info(f"[SNS] Alert sent for: {d.get('title')} (one-time)")
            except Exception as e:
                logger.warning(f"[SNS] Failed: {e}")
        except ValueError:
            pass


# ═══════════════════════════════════════════════════════════════════════════════
# ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/ingest")
@app.post("/ingest/upload")
async def ingest(file: UploadFile = File(...), studentId: str = Form("aarav-demo")):
    """Upload → extract (PDF or image) → store → return structured data."""
    try:
        file_bytes = await file.read()
        filename = file.filename or "upload.png"
        content_type = file.content_type or "image/png"

        logger.info(f"Ingesting {filename} ({len(file_bytes)} bytes, {content_type}) for {studentId}")

        # Real AI extraction
        raw = _extract_from_file(file_bytes, filename, content_type)

        if not raw:
            # Fallback to stub
            logger.warning("Extraction returned empty, using stub")
            from shared.extractor import _extract_stub
            stub = _extract_stub(filename)
            return {"success": True, "documentType": stub.document_type,
                    "overallConfidence": stub.overall_confidence,
                    "extractedData": stub.to_dict(), "itemCount": 0}

        # Normalize to frontend shape
        extracted = _normalize_extraction(raw, filename)

        # Store in local DB
        student = _get_student(studentId)
        if extracted["menu_items"]:
            # Replace menu by day+meal
            for m in extracted["menu_items"]:
                student["menu_items"] = [
                    x for x in student["menu_items"]
                    if not (x.get("day") == m["day"] and x.get("meal") == m["meal"])
                ]
                student["menu_items"].append(m)
        if extracted["classes"]:
            existing = {f"{c['day']}-{c['time']}-{c['subject']}" for c in student["classes"]}
            for c in extracted["classes"]:
                key = f"{c['day']}-{c['time']}-{c['subject']}"
                if key not in existing:
                    student["classes"].append(c)
        if extracted["deadlines"]:
            existing_ids = {d["id"] for d in student["deadlines"]}
            for d in extracted["deadlines"]:
                if d["id"] not in existing_ids:
                    student["deadlines"].append(d)
        if extracted["notices"]:
            existing_ids = {n["id"] for n in student["notices"]}
            for n in extracted["notices"]:
                if n["id"] not in existing_ids:
                    student["notices"].append(n)
        if extracted["placements"]:
            existing_ids = {p["id"] for p in student.get("placements", [])}
            for p in extracted["placements"]:
                if p["id"] not in existing_ids:
                    student.setdefault("placements", []).append(p)

        _save_student(studentId, student)

        item_count = sum(len(extracted[k]) for k in ["classes","deadlines","notices","menu_items","placements"])
        return {
            "success": True,
            "documentType": extracted["document_type"],
            "overallConfidence": extracted["overall_confidence"],
            "extractedData": extracted,
            "itemCount": item_count,
        }

    except Exception as e:
        logger.error(f"Ingest failed: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.post("/query")
async def query(request: Request):
    """Q&A with full context + intent detection for add/remove."""
    try:
        body = await request.json()
        question = body.get("question", "").strip()
        student_id = body.get("studentId", "aarav-demo")
        frontend_profile = body.get("profile", None)
        frontend_intents = body.get("intents", None)

        if not question:
            return JSONResponse(status_code=400, content={"error": "No question"})

        student = _get_student(student_id)

        # Merge frontend profile/intents into student data (frontend is source of truth for these)
        if frontend_profile:
            student["profile"] = frontend_profile
        if frontend_intents is not None:
            student["intents"] = frontend_intents

        # Store chat history for conversational memory
        chat_history = body.get("chatHistory", [])
        student["_chat_history"] = chat_history

        # Intent detection + response
        result = _detect_intent_and_respond(question, student)

        # If an action modified data, save it
        if any(s.startswith("action:") for s in result.get("sources", [])):
            _save_student(student_id, student)

        response = {"answer": result["answer"], "sources": result["sources"], "mode": "groq-free"}
        if "deadline" in result:
            response["deadline"] = result["deadline"]
        if "intent" in result:
            response["intent"] = result["intent"]
        return response

    except Exception as e:
        logger.error(f"Query failed: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/proactive/{student_id}")
async def proactive(student_id: str):
    """Generate proactive cards + send email for urgent deadlines. Cached for 60s."""
    try:
        student = _get_student(student_id)
        context = _build_full_context(student)

        if not context:
            return {"cards": [{"id": "onboarding", "type": "suggestion",
                              "title": "👋 Welcome!", "body": "Upload your first document to get started.",
                              "actionLabel": "Upload"}]}

        # Check for urgent deadlines and send email (always runs)
        _send_urgent_alerts(student)

        # Cache AI-generated cards for 60 seconds to avoid rate limits
        global _proactive_cache
        now = datetime.now()
        cache_key = student_id
        if hasattr(proactive, '_cache') and proactive._cache.get(cache_key):
            cached_time, cached_cards = proactive._cache[cache_key]
            if (now - cached_time).total_seconds() < 60:
                return {"cards": cached_cards}

        today_name = datetime.now().strftime("%A")

        # Build personalization context
        profile = student.get("profile", {})
        open_intents = [i for i in student.get("intents", []) if i.get("status") == "open"]
        agent_name = profile.get("agentName", "Flow")

        profile_ctx = ""
        if profile:
            profile_ctx = f"""
STUDENT PROFILE:
- Name: {profile.get('name', 'Student')}
- Agent name (refer to yourself as): {agent_name}
- Priorities: {', '.join(profile.get('priorities', ['Academics']))}
- Placement focus: {profile.get('placementFocus', 'Not yet')}
- End-sem date: {profile.get('endSemDate', 'not set')}
- Focus time: {profile.get('focusTime', 'Flexible')}"""

        intents_ctx = ""
        if open_intents:
            intents_ctx = "\n\nOPEN GOALS/INTENTS (student previously said they want to do these):\n" + "\n".join(
                f"- {i.get('text', '')}" for i in open_intents[:5]
            )

        # Fetch contest data if placement-focused
        contest_ctx = ""
        if profile.get("placementFocus") in ["Yes, actively", "Soon"] or "Placements" in profile.get("priorities", []):
            try:
                req = urllib.request.Request("https://codeforces.com/api/contest.list", headers={"User-Agent": "CampusFlow/1.0"})
                ctx_ssl = ssl.create_default_context()
                with urllib.request.urlopen(req, timeout=5, context=ctx_ssl) as resp:
                    cf_data = json.loads(resp.read().decode())
                    if cf_data.get("status") == "OK":
                        upcoming = [c for c in cf_data["result"] if c.get("phase") == "BEFORE"][:3]
                        if upcoming:
                            contest_ctx = "\n\nUPCOMING CODING CONTESTS:\n" + "\n".join(
                                f"- {c['name']} (starts {datetime.fromtimestamp(c['startTimeSeconds']).strftime('%b %d, %H:%M')})"
                                for c in upcoming
                            )
            except Exception:
                pass

        system = f"""You are {agent_name}, a proactive student assistant. Using the student's profile, their open intents, and upcoming events, generate 2-4 short, warm, specific nudge cards.
Personalize to their priorities and reference their stated intents when relevant.
If they're placement-focused and a test/contest is near, ask about their prep.
If they mentioned an intent and a related event appears, reference it.
Be encouraging, never nagging. Refer to yourself as {agent_name}. Return ONLY a JSON array."""

        prompt = f"""Today is {today_name}.
{profile_ctx}
{intents_ctx}
{contest_ctx}

UPCOMING DATA:
{context}

Return JSON array: [{{"id":"unique","type":"alert|reminder|suggestion","title":"emoji + short title","body":"one warm personalized sentence (refer to yourself as {agent_name})","actionLabel":"button text"}}]"""

        response = call_text_llm(system, prompt)
        cards = _parse_llm_json(response)

        if isinstance(cards, list) and cards:
            # Cache the result
            if not hasattr(proactive, '_cache'):
                proactive._cache = {}
            proactive._cache[cache_key] = (now, cards)
            return {"cards": cards}

        # Fallback: simple deterministic cards (no Groq needed)
        cards = []
        for d in student.get("deadlines", [])[:2]:
            cards.append({"id": f"dl-{d.get('id','x')}", "type": "alert",
                         "title": f"⏰ {d.get('title','Deadline')}", "body": f"Due: {d.get('due_date','soon')}",
                         "actionLabel": "View"})
        if not hasattr(proactive, '_cache'):
            proactive._cache = {}
        proactive._cache[cache_key] = (now, cards)
        return {"cards": cards or [{"id": "tip", "type": "suggestion",
                                    "title": "📚 Stay organized", "body": "Check your deadlines and schedule."}]}

    except Exception as e:
        logger.error(f"Proactive failed: {e}", exc_info=True)
        return {"cards": []}


@app.get("/data/{student_id}")
async def get_data(student_id: str):
    return _get_student(student_id)


# ═══════════════════════════════════════════════════════════════════════════════
# §11: CONTESTS API (Codeforces + LeetCode via public APIs)
# ═══════════════════════════════════════════════════════════════════════════════

_contests_cache: dict = {"data": None, "fetched_at": None}

@app.get("/contests")
async def get_contests():
    """Fetch upcoming coding contests from Codeforces API. Cached 1 hour."""
    now = datetime.now()

    # Return cache if fresh (< 1 hour)
    if _contests_cache["data"] and _contests_cache["fetched_at"]:
        age = (now - _contests_cache["fetched_at"]).total_seconds()
        if age < 3600:
            return {"contests": _contests_cache["data"], "cached": True}

    contests = []
    try:
        # Codeforces API (free, no key)
        ctx = ssl.create_default_context()
        req = urllib.request.Request("https://codeforces.com/api/contest.list",
                                     headers={"User-Agent": "CampusFlow/1.0"})
        with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
            data = json.loads(resp.read().decode())
            if data.get("status") == "OK":
                for c in data["result"]:
                    if c.get("phase") == "BEFORE":
                        contests.append({
                            "platform": "Codeforces",
                            "title": c.get("name", ""),
                            "startTime": datetime.fromtimestamp(c.get("startTimeSeconds", 0)).isoformat(),
                            "durationHours": round(c.get("durationSeconds", 0) / 3600, 1),
                            "url": f"https://codeforces.com/contest/{c.get('id', '')}",
                        })
                contests = contests[:10]  # Top 10 upcoming
    except Exception as e:
        logger.warning(f"Codeforces API failed: {e}")

    # LeetCode contests (free API)
    try:
        ctx = ssl.create_default_context()
        req = urllib.request.Request("https://leetcode.com/graphql",
            data=json.dumps({"query": "{upcomingContests{title startTime duration titleSlug}}"}).encode(),
            headers={"Content-Type": "application/json", "User-Agent": "CampusFlow/1.0"})
        with urllib.request.urlopen(req, timeout=8, context=ctx) as resp:
            lc_data = json.loads(resp.read().decode())
            for c in lc_data.get("data", {}).get("upcomingContests", [])[:5]:
                contests.append({
                    "platform": "LeetCode",
                    "title": c.get("title", ""),
                    "startTime": datetime.fromtimestamp(c.get("startTime", 0)).isoformat(),
                    "durationHours": round(c.get("duration", 0) / 3600, 1),
                    "url": f"https://leetcode.com/contest/{c.get('titleSlug', '')}",
                })
    except Exception as e:
        logger.warning(f"LeetCode API failed: {e}")

    _contests_cache["data"] = contests
    _contests_cache["fetched_at"] = now
    return {"contests": contests, "cached": False}


# ═══════════════════════════════════════════════════════════════════════════════
# §12: WEB SEARCH (DuckDuckGo — free, no key) + FETCH
# ═══════════════════════════════════════════════════════════════════════════════

_web_cache: dict = {}  # {query: {"results": [...], "fetched_at": datetime}}

@app.get("/search")
async def web_search(q: str = "", category: str = ""):
    """Search for opportunities/news via free APIs. Cached 1 hour."""
    if not q:
        return {"results": [], "error": "No query"}

    cache_key = f"{q}_{category}".lower().strip()
    now = datetime.now()

    if cache_key in _web_cache:
        age = (now - _web_cache[cache_key]["fetched_at"]).total_seconds()
        if age < 3600:
            return {"results": _web_cache[cache_key]["results"], "cached": True}

    results = []
    ctx = ssl.create_default_context()

    # Source 1: Dev.to (hackathons, tech articles, opportunities)
    try:
        tag = urllib.parse.quote(q.split()[0].lower() if q else "hackathon")
        url = f"https://dev.to/api/articles?tag={tag}&per_page=5"
        req = urllib.request.Request(url, headers={"User-Agent": "CampusFlow/1.0"})
        resp = urllib.request.urlopen(req, timeout=8, context=ctx)
        articles = json.loads(resp.read().decode())
        for a in articles[:5]:
            results.append({
                "title": a.get("title", ""),
                "url": a.get("url", ""),
                "snippet": a.get("description", "")[:150],
                "source": "dev.to",
                "published": a.get("published_at", ""),
            })
    except Exception as e:
        logger.warning(f"Dev.to search failed: {e}")

    # Source 2: GitHub (open source, projects)
    if any(w in q.lower() for w in ["github", "open source", "project", "gsoc"]):
        try:
            url = f"https://api.github.com/search/repositories?q={urllib.parse.quote(q)}&sort=updated&per_page=5"
            req = urllib.request.Request(url, headers={"User-Agent": "CampusFlow/1.0"})
            resp = urllib.request.urlopen(req, timeout=8, context=ctx)
            data = json.loads(resp.read().decode())
            for item in data.get("items", [])[:5]:
                results.append({
                    "title": item.get("full_name", ""),
                    "url": item.get("html_url", ""),
                    "snippet": item.get("description", "")[:150],
                    "source": "github",
                })
        except Exception:
            pass

    _web_cache[cache_key] = {"results": results, "fetched_at": now}
    return {"results": results, "cached": False}


@app.get("/fetch")
async def fetch_url(url: str = ""):
    """Fetch a web page content (MCP Fetch equivalent). Returns plain text."""
    if not url:
        return {"content": "", "error": "No URL"}
    try:
        ctx = ssl.create_default_context()
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 CampusFlow/1.0"})
        with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
            text = re.sub(r'<[^>]+>', ' ', html)
            text = re.sub(r'\s+', ' ', text).strip()
            return {"content": text[:5000], "url": url}
    except Exception as e:
        return {"content": "", "error": str(e)}


@app.get("/opportunities")
async def get_opportunities(student_id: str = "aarav-demo"):
    """Discover external opportunities filtered by student profile. Cached 1hr."""
    student = _get_student(student_id)
    profile = student.get("profile", {})
    priorities = profile.get("priorities", ["Academics"])

    cache_key = f"opportunities_{','.join(priorities)}"
    now = datetime.now()

    if cache_key in _web_cache:
        age = (now - _web_cache[cache_key]["fetched_at"]).total_seconds()
        if age < 3600:
            return {"opportunities": _web_cache[cache_key]["results"], "cached": True}

    opps = []
    ctx = ssl.create_default_context()

    # Fetch based on profile priorities
    tags = []
    if "Placements" in priorities:
        tags.extend(["internship", "coding", "interview"])
    if "Academics" in priorities:
        tags.extend(["programming", "tutorial", "computerscience"])
    if "Fitness/Health" in priorities:
        tags.extend(["fitness", "health", "productivity"])
    if "Clubs & Events" in priorities:
        tags.extend(["hackathon", "opensource", "community"])
    if "Personal projects" in priorities:
        tags.extend(["sideproject", "webdev", "beginners"])
    if not tags:
        tags = ["hackathon", "coding", "productivity"]

    # Also add tags from open intents
    open_intents = [i for i in student.get("intents", []) if i.get("status") == "open"]
    for intent in open_intents[:3]:
        topic = intent.get("topic", "").lower()
        if "gym" in topic or "fitness" in topic:
            tags.append("fitness")
        elif "dsa" in topic or "coding" in topic or "leetcode" in topic:
            tags.append("algorithms")
        elif "project" in topic:
            tags.append("sideproject")

    for tag in tags[:3]:
        try:
            url = f"https://dev.to/api/articles?tag={tag}&per_page=3&top=7"
            req = urllib.request.Request(url, headers={"User-Agent": "CampusFlow/1.0"})
            resp = urllib.request.urlopen(req, timeout=8, context=ctx)
            articles = json.loads(resp.read().decode())
            for a in articles:
                opps.append({
                    "title": a.get("title", ""),
                    "url": a.get("url", ""),
                    "snippet": a.get("description", "")[:100],
                    "source": "dev.to",
                    "tag": tag,
                })
        except Exception:
            pass

    # Dedupe by title
    seen = set()
    unique_opps = []
    for o in opps:
        if o["title"] not in seen:
            seen.add(o["title"])
            unique_opps.append(o)

    _web_cache[cache_key] = {"results": unique_opps[:10], "fetched_at": now}
    return {"opportunities": unique_opps[:10], "cached": False}


@app.post("/profile")
async def save_profile(request: Request):
    body = await request.json()
    student = _get_student(body.get("studentId", "aarav-demo"))
    student["profile"] = body.get("profile", {})
    _save_student(body.get("studentId", "aarav-demo"), student)
    return {"success": True}


# ═══════════════════════════════════════════════════════════════════════════════
# ENTRYPOINT
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8000"))
    print(f"\n🚀 CampusFlow Backend v2 at http://localhost:{port}")
    print(f"   GROQ_API_KEY: {'✅' if os.environ.get('GROQ_API_KEY') else '❌ MISSING'}")
    print(f"   PDF: PyMuPDF (text + image render)")
    print(f"   Vision: Groq (Llama 4 Scout)")
    print(f"   Text: Groq (Llama 3.3 70B)")
    print(f"   DB: {DB_PATH}\n")
    uvicorn.run(app, host="0.0.0.0", port=port)
