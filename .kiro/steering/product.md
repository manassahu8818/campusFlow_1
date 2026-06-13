---
inclusion: always
---

# CampusFlow — Product Steering

## What CampusFlow Is
CampusFlow is a **proactive, multimodal AI operating system for student life**. Students photograph or upload the chaos of campus life — printed timetables, WhatsApp announcement screenshots, mess-menu images, hostel notices, placement-drive PDFs — and CampusFlow turns it into a private, structured, queryable knowledge base that **anticipates** what the student needs and acts ahead of them.

The core insight: every existing campus tool is a *reactive* chatbot that waits to be asked, and requires the university to integrate its databases. CampusFlow flips both: the **individual student** is the customer (zero institutional buy-in needed), and the assistant is **proactive** (it warns, reminds, and schedules before being asked).

## Target User
"Aarav," a 2nd-year engineering student in India. His class schedule, deadlines, club events, attendance, hostel notices, transport timings, and placement updates are scattered across WhatsApp groups, email, college portals, and spreadsheets. He constantly misses important updates. He has no time to manually enter his life into a planner app.

## The Three Hero Features (build these, perfectly — nothing else for the hackathon)
1. **Multimodal Ingestion** — upload a photo/PDF/screenshot of any campus artifact; CampusFlow extracts structured data (schedule, deadlines, menu, events) using Textract + Claude vision on Bedrock.
2. **Instant Q&A** — ask natural-language questions answered ONLY from the student's own ingested data, with source grounding (RAG via Bedrock Knowledge Bases). No hallucinated deadlines.
3. **Proactive Alerts** — CampusFlow looks ahead at the student's schedule + pending deadlines + unread notices and pushes timely, useful nudges (EventBridge Scheduler + Bedrock Agent).

## Design Principles (apply to every decision)
- **Customer-obsessed:** start from the student's pain, work backwards to the feature. Reduce taps, reduce missed deadlines.
- **AI is core, not decorative.** The intelligence (ingestion, anticipation, grounded answers) IS the product, not a bolt-on chatbot.
- **Grounded, never hallucinated.** Every answer about the student's life cites the ingested source. If we don't know, we say so.
- **Confirm before acting.** Proactive nudges suggest; the student approves. Alert thresholds are user-tunable (avoid over-notification).
- **Private by default.** Each student's data is isolated (Cognito identity). "Your academic life stays yours."
- **India-aware:** mess menus, hostel notices, placement prep, shuttle timings, multilingual WhatsApp forwards are first-class.

## What We Are NOT Building (this hackathon)
- No university SIS/LMS integration. No admin dashboard. No multi-user collaboration. No mobile native app (responsive web is fine). No payment. These belong in the roadmap, not the demo.

## Success = A Flawless 3-Minute Demo
Three features that all work beat ten where half break. Every component must survive a live demo. Keep a recorded fallback of the hero flow.
