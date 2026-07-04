#!/usr/bin/env python3
"""
Test the free LLM pipeline (Gemini Vision + Groq Text).

Usage:
  # Test 1: Vision extraction (Gemini)
  python3 test_free.py extract <image_path>

  # Test 2: Q&A (Groq)
  python3 test_free.py ask "What's for lunch today?"

  # Test 3: Proactive cards (Groq)
  python3 test_free.py cards

Required env vars:
  export GEMINI_API_KEY=your_gemini_key
  export GROQ_API_KEY=your_groq_key
  export EXTRACTOR_MODE=free
  export QUERY_MODE=free
  export PROACTIVE_MODE=free
"""

import sys
import os
import json

# Add paths
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "shared"))

# Set defaults if not in env
os.environ.setdefault("EXTRACTOR_MODE", "free")
os.environ.setdefault("QUERY_MODE", "free")
os.environ.setdefault("PROACTIVE_MODE", "free")
os.environ.setdefault("LLM_PROVIDER_TEXT", "groq")
os.environ.setdefault("LLM_PROVIDER_VISION", "gemini")


def test_extract(image_path: str):
    """Test vision extraction via Gemini."""
    from shared.extractor import extract_structured_data

    if not os.path.exists(image_path):
        print(f"ERROR: File not found: {image_path}")
        sys.exit(1)

    with open(image_path, "rb") as f:
        file_bytes = f.read()

    # Detect content type
    ext = os.path.splitext(image_path)[1].lower()
    content_types = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".pdf": "application/pdf"}
    content_type = content_types.get(ext, "image/png")
    filename = os.path.basename(image_path)

    print(f"📸 Extracting from: {filename} ({content_type})")
    print(f"   File size: {len(file_bytes) / 1024:.1f} KB")
    print(f"   Provider: Gemini 2.0 Flash")
    print(f"   Mode: EXTRACTOR_MODE={os.environ.get('EXTRACTOR_MODE')}")
    print()

    result = extract_structured_data(file_bytes, filename, content_type)

    print(f"✅ Result:")
    print(f"   Document type: {result.document_type}")
    print(f"   Overall confidence: {result.overall_confidence}")
    print(f"   Classes: {len(result.classes)}")
    print(f"   Deadlines: {len(result.deadlines)}")
    print(f"   Notices: {len(result.notices)}")
    print(f"   Menu items: {len(result.menu_items)}")
    print()
    print("📋 Full JSON:")
    print(json.dumps(result.to_dict(), indent=2, default=str))


def test_ask(question: str):
    """Test Q&A via Groq (with mock DynamoDB context)."""
    from shared.llm_provider import call_text_llm

    # Simulate student context (what would come from DynamoDB)
    context = """SCHEDULE:
  Monday 09:00 - Data Structures & Algorithms at LH-301
  Monday 11:00 - Database Management Systems at LH-204
  Monday 14:00 - DSA Lab at CC-Lab 2
  Tuesday 09:00 - Mathematics III at LH-301
  Tuesday 11:00 - Computer Networks at LH-205

DEADLINES:
  DSA Assignment 3 - AVL Trees - due 2024-10-15: Implement AVL tree with insertion, deletion
  DBMS Assignment 4 - ER Diagram - due 2024-10-12: Design ER diagram for Library Management

MESS MENU:
  Monday breakfast: Aloo Paratha, Curd, Pickle, Tea/Coffee, Banana
  Monday lunch: Rice, Dal Tadka, Aloo Gobi, Roti, Green Salad, Curd
  Monday dinner: Jeera Rice, Rajma Masala, Paneer Butter Masala, Roti, Gulab Jamun

NOTICES:
  [placement] Amazon SDE Internship - Campus Placement Drive: Test on 25th Oct, register by 20th Oct
  [academic] Mid-Semester Examinations: 15th-22nd October 2024"""

    system_prompt = """You are CampusFlow, a helpful campus assistant for an Indian college student.
Answer the student's question using ONLY the provided context data.
Be concise, friendly, and specific. If the answer isn't in the context, say so."""

    user_prompt = f"""Context (student's uploaded data):
{context}

Student's question: {question}

Answer:"""

    print(f"💬 Question: {question}")
    print(f"   Provider: Groq (Llama 3.3 70B)")
    print()

    answer = call_text_llm(system_prompt, user_prompt)

    if answer:
        print(f"✅ Answer:")
        print(f"   {answer}")
    else:
        print("❌ No answer returned. Check GROQ_API_KEY.")


def test_cards():
    """Test proactive card generation via Groq."""
    from shared.llm_provider import call_text_llm

    context = {
        "student_id": "aarav-demo",
        "current_time": "2024-10-11T08:30:00",
        "today": "Friday",
        "classes_count": 15,
        "today_classes": [
            {"day": "Friday", "time": "09:00", "subject": "DSA", "location": "LH-301"},
            {"day": "Friday", "time": "11:00", "subject": "Computer Networks", "location": "LH-205"},
        ],
        "deadlines": [
            {"title": "DBMS Assignment 4 - ER Diagram", "due_date": "2024-10-12", "subject": "DBMS"},
            {"title": "DSA Assignment 3 - AVL Trees", "due_date": "2024-10-15", "subject": "DSA"},
        ],
        "notices": [
            {"title": "Amazon SDE Internship Drive", "category": "placement"},
            {"title": "Mid-Semester Examinations", "category": "academic"},
        ],
    }

    system_prompt = "You are a proactive campus assistant. Generate useful nudge cards for a student."
    user_prompt = f"""Based on this student's data, generate 1-3 useful proactive nudge cards.

Student context:
{json.dumps(context, indent=2)}

Return STRICT JSON array (no explanation, just JSON):
[{{"id": "unique-id", "type": "reminder|alert|suggestion", "title": "short title with emoji", "body": "helpful one-line message", "actionLabel": "button text"}}]

Rules:
- Only genuinely useful nudges
- Be specific (mention actual subjects/deadlines)
- Prioritize urgency
- Use emojis in titles"""

    print(f"⚡ Generating proactive cards...")
    print(f"   Provider: Groq (Llama 3.3 70B)")
    print()

    response = call_text_llm(system_prompt, user_prompt)

    if response:
        # Parse
        text = response.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]

        try:
            cards = json.loads(text.strip())
            print(f"✅ Generated {len(cards)} cards:")
            print(json.dumps(cards, indent=2))
        except json.JSONDecodeError:
            print(f"⚠️  Response wasn't valid JSON:")
            print(response)
    else:
        print("❌ No response. Check GROQ_API_KEY.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]

    if command == "extract":
        if len(sys.argv) < 3:
            print("Usage: python3 test_free.py extract <image_path>")
            sys.exit(1)
        test_extract(sys.argv[2])
    elif command == "ask":
        question = sys.argv[2] if len(sys.argv) > 2 else "What's my schedule on Monday?"
        test_ask(question)
    elif command == "cards":
        test_cards()
    else:
        print(f"Unknown command: {command}")
        print("Commands: extract, ask, cards")
        sys.exit(1)
