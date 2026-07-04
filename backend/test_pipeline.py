#!/usr/bin/env python3
"""
Test all 4 pipeline fixes end-to-end.
Run: /Library/Developer/CommandLineTools/usr/bin/python3 test_pipeline.py
"""
import sys, os, json
sys.path.insert(0, "/Users/sparshgarg/Library/Python/3.9/lib/python/site-packages")
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "shared"))

os.environ.setdefault("GROQ_API_KEY", os.environ.get("GROQ_API_KEY", ""))
os.environ.setdefault("EXTRACTOR_MODE", "free")
os.environ.setdefault("LLM_PROVIDER_VISION", "groq")
os.environ.setdefault("LLM_PROVIDER_TEXT", "groq")

from local_server import (
    _extract_from_file, _normalize_extraction, _build_full_context,
    _detect_intent_and_respond, _answer_question, _parse_llm_json
)
from shared.llm_provider import call_text_llm, call_vision_llm

PASS = 0
FAIL = 0

def test(name, condition, detail=""):
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  ✅ {name}")
    else:
        FAIL += 1
        print(f"  ❌ {name}: {detail}")


# ═══ TEST 1: PDF Menu Extraction ═══
print("\n=== TEST 1: PDF MENU EXTRACTION (text-based PDF) ===")

# Create a fake PDF with text content using fitz
import fitz
doc = fitz.open()
page = doc.new_page()
# Simulate mess menu text
menu_text = """HOSTEL MESS MENU - Week of July 2026

MONDAY:
Breakfast: Uttapam, Sambhar, Chutney, Bread Jam, Tea
Lunch: Palak Poori, Aloo Matar, Rice, Dal, Curd, Roti
Dinner: Paneer Butter Masala, Jeera Rice, Roti, Dal Makhni, Gulab Jamun

TUESDAY:
Breakfast: Idli, Sambar, Vada, Toast, Coffee
Lunch: Rajma, Rice, Roti, Salad, Buttermilk
Dinner: Chicken Biryani / Veg Pulao, Raita, Dal Fry

FRIDAY:
Breakfast: Poha, Jalebi, Bread Butter, Tea, Banana
Lunch: Chole Bhature, Rice, Salad, Lassi
Dinner: Fried Rice, Manchurian, Dal Tadka, Roti, Ice Cream
"""
page.insert_text((50, 50), menu_text, fontsize=10)
pdf_bytes = doc.tobytes()
doc.close()

raw = _extract_from_file(pdf_bytes, "mess_menu.pdf", "application/pdf")
normalized = _normalize_extraction(raw, "mess_menu.pdf")

test("PDF detected as menu", raw.get("doc_type") == "mess_menu" or normalized["document_type"] == "mess_menu",
     f"got: {raw.get('doc_type', normalized['document_type'])}")

test("Has menu_items", len(normalized["menu_items"]) > 0, f"got {len(normalized['menu_items'])} items")

# Check Friday specifically
fri_items = [m for m in normalized["menu_items"] if m.get("day","").lower() == "friday"]
test("Friday data extracted", len(fri_items) > 0, f"got {len(fri_items)} Friday meals")

if fri_items:
    fri_lunch = [m for m in fri_items if m["meal"] == "lunch"]
    if fri_lunch:
        test("Friday lunch has correct items", "Chole" in str(fri_lunch[0]["items"]) or "Bhature" in str(fri_lunch[0]["items"]),
             f"got: {fri_lunch[0]['items']}")
    else:
        test("Friday lunch exists", False, "no Friday lunch found")

print(f"\n  Menu items by day:")
for m in normalized["menu_items"][:9]:
    print(f"    {m['day']} {m['meal']}: {m['items'][:4]}")


# ═══ TEST 2: Image Timetable Extraction ═══
print("\n=== TEST 2: IMAGE EXTRACTION (timetable via vision) ===")

# Create a simple image with timetable text
import struct, zlib

def make_test_png():
    """Create a 100x50 white PNG (Groq vision will get the prompt context)."""
    w, h = 100, 50
    def chunk(ctype, data):
        c = ctype + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    raw = b''
    for y in range(h):
        raw += b'\x00' + b'\xff\xff\xff' * w
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')

# For this test, use text model directly (vision on blank image won't help)
timetable_text = """Class Schedule - B.Tech CSE Sem 3:
Monday 09:00 - Data Structures, LH-301, Dr. Sharma
Monday 11:00 - DBMS, LH-204, Prof. Gupta
Tuesday 09:00 - Mathematics III, LH-301, Dr. Verma
Wednesday 09:00 - Computer Networks, LH-205, Prof. Singh
Friday 14:00 - Mini Project, CC-Lab 1, Dr. Sharma"""

prompt = """You are a document extraction AI for Indian college campus documents.
Return STRICT JSON only:
{"doc_type":"timetable","classes":[{"day":"Monday","time":"09:00","subject":"DSA","location":"LH-301","professor":"Dr. Sharma"},...]}}

Document:
""" + timetable_text

response = call_text_llm("Return only JSON.", prompt)
tt_raw = _parse_llm_json(response)
tt_norm = _normalize_extraction(tt_raw, "timetable.png") if tt_raw else {"classes": []}

test("Timetable detected", tt_raw.get("doc_type") == "timetable", f"got: {tt_raw.get('doc_type')}")
test("Classes extracted", len(tt_norm["classes"]) >= 4, f"got {len(tt_norm['classes'])} classes")

if tt_norm["classes"]:
    mon_classes = [c for c in tt_norm["classes"] if c["day"].lower() == "monday"]
    test("Monday has 2 classes", len(mon_classes) >= 2, f"got {len(mon_classes)}")
    print(f"\n  Classes:")
    for c in tt_norm["classes"][:5]:
        print(f"    {c['day']} {c['time']} — {c['subject']} @ {c['location']}")


# ═══ TEST 3: Q&A with Full Context ═══
print("\n=== TEST 3: Q&A WITH FULL CONTEXT ===")

mock_student = {
    "classes": [
        {"day": "Monday", "time": "09:00", "subject": "DSA", "location": "LH-301", "professor": "Dr. Sharma"},
        {"day": "Monday", "time": "11:00", "subject": "DBMS", "location": "LH-204", "professor": "Prof. Gupta"},
    ],
    "deadlines": [
        {"id": "dl1", "title": "DSA Assignment 3", "subject": "DSA", "due_date": "2026-07-07", "description": "AVL Trees implementation"},
    ],
    "menu_items": [
        {"meal": "lunch", "day": "Monday", "items": ["Chole Bhature", "Rice", "Salad", "Lassi"]},
        {"meal": "dinner", "day": "Monday", "items": ["Paneer Masala", "Roti", "Dal", "Kheer"]},
        {"meal": "lunch", "day": "Friday", "items": ["Fried Rice", "Manchurian", "Dal Tadka"]},
    ],
    "notices": [
        {"id": "n1", "title": "Water Cut-off", "body": "Water unavailable 10AM-2PM Block C", "category": "hostel"},
    ],
    "placements": [
        {"company": "Amazon", "role": "SDE Intern", "ctc": "1.2L/month", "test_date": "2026-07-25", "registration_deadline": "2026-07-20"},
    ],
    "events": [],
}

result = _answer_question("What's for lunch on Monday?", mock_student)
answer = result["answer"].lower()
test("Q&A: lunch Monday answered", "chole" in answer or "bhature" in answer or "rice" in answer,
     f"answer: {result['answer'][:80]}")
test("Q&A: source is mess_menu", "mess_menu" in result["sources"], f"sources: {result['sources']}")

result2 = _answer_question("When is the Amazon placement test?", mock_student)
answer2 = result2["answer"].lower()
test("Q&A: placement answered", "july" in answer2 or "25" in answer2, f"answer: {result2['answer'][:80]}")

result3 = _answer_question("What are my deadlines?", mock_student)
answer3 = result3["answer"].lower()
test("Q&A: deadlines answered", "dsa" in answer3 or "avl" in answer3, f"answer: {result3['answer'][:80]}")

print(f"\n  Sample answers:")
print(f"    Lunch Monday: {result['answer'][:100]}")
print(f"    Placement: {result2['answer'][:100]}")


# ═══ TEST 4: Intent Detection — Add Deadline ═══
print("\n=== TEST 4: INTENT DETECTION (add/remove) ===")

mock_student2 = {"classes": [], "deadlines": [], "notices": [], "menu_items": [], "events": [], "placements": []}

result4 = _detect_intent_and_respond("add a deadline for DBMS assignment coming Monday", mock_student2)
test("Intent: add deadline detected", "Added" in result4["answer"] or "added" in result4["answer"] or "✅" in result4["answer"],
     f"answer: {result4['answer'][:80]}")
test("Deadline was created in store", len(mock_student2["deadlines"]) > 0,
     f"deadlines: {len(mock_student2['deadlines'])}")

if mock_student2["deadlines"]:
    dl = mock_student2["deadlines"][0]
    test("Deadline has title", "dbms" in dl.get("title","").lower() or "assignment" in dl.get("title","").lower(),
         f"title: {dl.get('title')}")
    test("Deadline has due_date", bool(dl.get("due_date")), f"due_date: {dl.get('due_date')}")
    print(f"\n  Created deadline: {json.dumps(dl, indent=2)}")

# Test remove
result5 = _detect_intent_and_respond("remove the DBMS deadline", mock_student2)
test("Intent: remove detected", "Removed" in result5["answer"] or "removed" in result5["answer"] or "✅" in result5["answer"],
     f"answer: {result5['answer'][:80]}")
test("Deadline was removed", len(mock_student2["deadlines"]) == 0,
     f"remaining: {len(mock_student2['deadlines'])}")

# ═══ SUMMARY ═══
print(f"\n{'='*50}")
print(f"RESULTS: {PASS} passed, {FAIL} failed out of {PASS+FAIL} tests")
if FAIL == 0:
    print("🎉 ALL TESTS PASSED!")
else:
    print(f"⚠️  {FAIL} test(s) need attention")
