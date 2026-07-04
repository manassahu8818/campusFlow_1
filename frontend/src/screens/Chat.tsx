import { useState, useRef, useEffect } from 'react'
import { useStore } from '../lib/useStore'
import {
  StudentData,
  ChatMessage,
  addDeadline,
  addDeadlines,
  addClasses,
  addNotices,
  addMenuItems,
  addEvents,
  addPlacements,
  getChatHistory,
  addChatMessage,
  getProfile,
  getOpenIntents,
  clearAll,
  clearDeadlines,
  clearMenuItems,
  clearClasses,
  clearNotices,
  clearEvents,
  clearPlacements,
} from '../lib/store'

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>(getChatHistory())
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const data = useStore()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Sync from store on mount (in case other tab changed it)
  useEffect(() => {
    const history = getChatHistory()
    setMessages(history)

    // If chat is empty and profile exists, generate a personalized intro/follow-up
    if (history.length === 0 && getProfile().profileComplete) {
      const profile = getProfile()
      const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
      fetch(`${API_BASE}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `__SYSTEM_INTRO__`,
          studentId: 'aarav-demo',
          profile,
          intents: getOpenIntents(),
        }),
      }).then(r => r.json()).then(json => {
        if (json.answer) {
          const introMsg: ChatMessage = { role: 'assistant', content: json.answer, sources: ['intro'] }
          setMessages([introMsg])
          addChatMessage(introMsg)
        }
      }).catch(() => {})
    }
  }, [])

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const question = input.trim()
    const userMsg: ChatMessage = { role: 'user', content: question }
    setMessages((prev) => [...prev, userMsg])
    addChatMessage(userMsg)
    setInput('')
    setLoading(true)

    try {
      // Try real backend (Groq AI Q&A + intent detection)
      const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
      const res = await fetch(`${API_BASE}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, studentId: 'aarav-demo', profile: getProfile(), intents: getOpenIntents(), chatHistory: getChatHistory().slice(-10) }),
      })
      if (res.ok) {
        const json = await res.json()
        if (json.answer) {
          const assistantMsg: ChatMessage = { role: 'assistant', content: json.answer, sources: json.sources }
          setMessages((prev) => [...prev, assistantMsg])
          addChatMessage(assistantMsg)

          // If backend added a deadline, sync it to frontend store
          if (json.sources?.includes('action:add_deadline') && json.deadline) {
            addDeadline(json.deadline)
          }
          // If backend added an intent, sync to frontend store
          if (json.sources?.includes('action:add_intent') && json.intent) {
            const { addIntentFull } = await import('../lib/store')
            addIntentFull(json.intent)
          }
          // If backend completed an intent
          if (json.sources?.includes('action:complete_intent')) {
            const { completeIntentByTopic } = await import('../lib/store')
            // Refresh intents from re-render
            completeIntentByTopic(json.answer || '')
          }
          // If backend cleared ALL data, sync frontend store
          if (json.sources?.includes('action:clear')) {
            clearAll()
          }
          // If backend modified data (remove/update), re-sync from backend
          if (json.sources?.includes('action:remove')) {
            try {
              const API = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
              const dataRes = await fetch(`${API}/data/aarav-demo`)
              if (dataRes.ok) {
                const serverData = await dataRes.json()
                // Re-sync all data categories (preserve chat history)
                clearClasses(); clearDeadlines(); clearNotices();
                clearMenuItems(); clearEvents(); clearPlacements();
                if (serverData.classes?.length) addClasses(serverData.classes)
                if (serverData.deadlines?.length) addDeadlines(serverData.deadlines)
                if (serverData.notices?.length) addNotices(serverData.notices)
                if (serverData.menu_items?.length) addMenuItems(serverData.menu_items)
                if (serverData.events?.length) addEvents(serverData.events)
                if (serverData.placements?.length) addPlacements(serverData.placements)
              }
            } catch { /* ignore */ }
          }

          setLoading(false)
          return
        }
      }
    } catch (err) {
      console.warn('[Chat] Backend unavailable, using local fallback:', err)
    }

    // Fallback: local keyword matching
    await new Promise((r) => setTimeout(r, 300))
    const { answer, sources } = answerFromStore(question, data)
    const fallbackMsg: ChatMessage = { role: 'assistant', content: answer, sources }
    setMessages((prev) => [...prev, fallbackMsg])
    addChatMessage(fallbackMsg)
    setLoading(false)
  }

  const suggestions = [
    "What's my schedule today?",
    "When is my next deadline?",
    "What's for dinner?",
    "When is the Amazon test?",
  ]

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {messages.length === 0 && (
          <div className="text-center pt-10 space-y-5 animate-slide-up">
            <div className="w-18 h-18 bg-gradient-to-br from-accent-50 to-purple-50 rounded-2xl mx-auto flex items-center justify-center border border-accent-100 w-[72px] h-[72px] animate-float">
              <span className="text-4xl">💬</span>
            </div>
            <div>
              <p className="text-[16px] font-bold text-heading">Ask about your campus life</p>
              <p className="text-[13px] text-secondary mt-1.5 leading-relaxed max-w-[260px] mx-auto">
                Answers come only from YOUR uploaded documents — never hallucinated.
              </p>
            </div>
            {/* Quick suggestions */}
            <div className="flex flex-wrap gap-2 justify-center pt-1">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="px-3.5 py-2 bg-white border border-border-subtle rounded-full text-[12px] text-secondary font-medium hover:border-accent-from/40 hover:text-accent-from hover:bg-accent-50/30 transition-all btn-press shadow-sm"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2 animate-slide-up ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {/* Assistant avatar */}
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[11px] text-white font-bold">{(getProfile().agentName || 'F')[0]}</span>
              </div>
            )}
            <div className={`max-w-[78%]`}>
              <div className={`px-4 py-3 text-[14px] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-2xl rounded-br-lg shadow-lg'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-2xl rounded-bl-lg shadow-sm'
              }`}>
                <span className="whitespace-pre-wrap">{msg.content}</span>
              </div>
              {msg.sources && msg.sources.length > 0 && (
                <div className="flex gap-1.5 mt-1.5 ml-1">
                  {msg.sources.map((s, j) => (
                    <span key={j} className="text-[10px] bg-accent-50 text-accent-from px-2 py-0.5 rounded-md font-medium border border-accent-100">
                      📎 {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2 animate-slide-up">
            <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-lg flex items-center justify-center shrink-0">
              <span className="text-[11px] text-white font-bold">{(getProfile().agentName || 'F')[0]}</span>
            </div>
            <div className="bg-white border border-border-subtle px-4 py-3 rounded-2xl rounded-bl-lg shadow-card">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-accent-from/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-accent-from/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-accent-from/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Bar */}
      <div className="p-4 border-t border-border-subtle glass bg-white/80">
        <div className="flex gap-2.5">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask about your schedule, deadlines..."
            className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-[14px] text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-indigo-400 focus:bg-white focus:shadow-sm transition-all"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="w-11 h-11 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl flex items-center justify-center disabled:opacity-30 hover:shadow-lg transition-all active:scale-95"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M22 2L11 13" /><path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Q&A + ACTIONS ENGINE ────────────────────────────────────────────────────────

function answerFromStore(question: string, data: StudentData): { answer: string; sources: string[] } {
  const q = question.toLowerCase()

  const hasData = data.classes.length > 0 || data.deadlines.length > 0 ||
    data.notices.length > 0 || data.menu_items.length > 0 ||
    data.events.length > 0 || data.placements.length > 0

  // ─── ACTION: Remove / Delete / Clear ──────────────────────────────────────
  if (q.match(/remove|delete|clear|reset|erase/)) {
    if (q.match(/menu|mess|food/)) {
      clearMenuItems()
      return { answer: "✅ Done! I've removed all mess menu data.", sources: [] }
    }
    if (q.match(/schedule|timetable|class/)) {
      clearClasses()
      return { answer: "✅ Done! I've removed your timetable/schedule data.", sources: [] }
    }
    if (q.match(/deadline|assignment|homework/)) {
      clearDeadlines()
      return { answer: "✅ Done! I've removed all deadlines.", sources: [] }
    }
    if (q.match(/notice|circular|announcement/)) {
      clearNotices()
      return { answer: "✅ Done! I've removed all notices.", sources: [] }
    }
    if (q.match(/event|hackathon|fest/)) {
      clearEvents()
      return { answer: "✅ Done! I've removed all events.", sources: [] }
    }
    if (q.match(/placement|drive|company/)) {
      clearPlacements()
      return { answer: "✅ Done! I've removed all placement data.", sources: [] }
    }
    if (q.match(/all|everything/)) {
      clearAll()
      return { answer: "✅ Done! I've cleared ALL your data. Start fresh by uploading new documents.", sources: [] }
    }
    return { answer: "What would you like me to remove? I can clear: menu, schedule, deadlines, notices, events, placements, or everything.", sources: [] }
  }

  // ─── ACTION: Add deadline/reminder via text ───────────────────────────────
  if (q.match(/add|create|set|remind|i have.*(?:assignment|deadline|submission|due|exam|test|quiz)/)) {
    const parsed = parseDeadlineFromText(q)
    if (parsed) {
      addDeadlines([parsed])
      return {
        answer: `✅ Got it! I've added a deadline:\n\n📝 ${parsed.title}\n📚 ${parsed.subject}\n⏰ Due: ${parsed.due_date}\n${parsed.description ? `📋 ${parsed.description}` : ''}\n\nCheck your Today tab — it'll show up in alerts!`,
        sources: [],
      }
    }
    return {
      answer: "I'd like to add that for you! Could you tell me:\n• What's it about? (e.g., \"DBMS assignment\")\n• When is it due? (e.g., \"in 9 hours\", \"tomorrow\", \"Oct 15\")\n\nExample: \"Add DBMS assignment due in 9 hours\"",
      sources: [],
    }
  }

  // ─── QUERY: No data state ─────────────────────────────────────────────────
  if (!hasData) {
    return {
      answer: "I don't have any data yet! Upload your timetable, notices, or mess menu first, then I can answer questions about them.\n\nOr tell me something like \"I have a DBMS assignment due in 9 hours\" and I'll track it!",
      sources: [],
    }
  }

  // ─── QUERY: Placement ─────────────────────────────────────────────────────
  if (q.match(/placement|amazon|tcs|company|drive|intern|recruit|ctc|package/)) {
    if (data.placements.length === 0 && data.notices.filter((n) => n.category === 'placement').length === 0) {
      return { answer: "I don't have any placement info yet. Upload a placement circular!", sources: [] }
    }
    const companyMatch = data.placements.find((p) => q.includes(p.company.toLowerCase()))
    if (companyMatch) {
      return {
        answer: `🎯 ${companyMatch.company} — ${companyMatch.role}\n\n• CTC: ${companyMatch.ctc}\n• CGPA Cutoff: ${companyMatch.cgpa_cutoff}+\n• Registration Deadline: ${companyMatch.registration_deadline}\n• Online Test: ${companyMatch.test_date}\n\nMake sure to register before the deadline!`,
        sources: ['placement_circular'],
      }
    }
    if (data.placements.length > 0) {
      const lines = data.placements.map((p) => `• ${p.company} — ${p.role}\n  CTC: ${p.ctc} | Test: ${p.test_date}`)
      return { answer: `🎯 Active placement drives:\n\n${lines.join('\n\n')}`, sources: ['placement_circular'] }
    }
    const placementNotices = data.notices.filter((n) => n.category === 'placement')
    const lines = placementNotices.map((n) => `• ${n.title}\n  ${n.body.slice(0, 100)}...`)
    return { answer: `📢 Placement notices:\n\n${lines.join('\n\n')}`, sources: ['notices'] }
  }

  // ─── QUERY: Menu / Food ───────────────────────────────────────────────────
  if (q.match(/menu|mess|food|lunch|dinner|breakfast|snack|eat|canteen|what.*for/)) {
    if (data.menu_items.length === 0) {
      return { answer: "I don't have the mess menu yet. Upload a photo of it!", sources: [] }
    }
    let mealFilter: string | null = null
    if (q.includes('breakfast')) mealFilter = 'breakfast'
    else if (q.includes('lunch')) mealFilter = 'lunch'
    else if (q.includes('dinner')) mealFilter = 'dinner'
    else if (q.includes('snack')) mealFilter = 'snacks'

    let dayFilter: string | null = null
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    for (const day of days) { if (q.includes(day)) { dayFilter = day; break } }
    if (q.includes('today') || (!dayFilter && mealFilter)) {
      dayFilter = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    }
    if (q.includes('tomorrow')) {
      const tom = new Date(); tom.setDate(tom.getDate() + 1)
      dayFilter = tom.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    }

    let filtered = data.menu_items
    if (dayFilter) filtered = filtered.filter((m) => m.day.toLowerCase() === dayFilter)
    if (mealFilter) filtered = filtered.filter((m) => m.meal.toLowerCase() === mealFilter)
    if (filtered.length === 0 && dayFilter) {
      filtered = data.menu_items.filter((m) => m.day.toLowerCase() === 'monday')
      if (mealFilter) filtered = filtered.filter((m) => m.meal.toLowerCase() === mealFilter)
    }
    if (filtered.length === 0) {
      return { answer: "Couldn't find menu for that. Try 'what's for dinner today?'", sources: ['mess_menu'] }
    }
    const lines = filtered.map((m) => `🍽️ ${m.day} ${m.meal.charAt(0).toUpperCase() + m.meal.slice(1)}:\n   ${m.items.join(' • ')}`)
    return { answer: lines.join('\n\n'), sources: ['mess_menu'] }
  }

  // ─── QUERY: Schedule ──────────────────────────────────────────────────────
  if (q.match(/schedule|class|timetable|lecture|today|tomorrow|monday|tuesday|wednesday|thursday|friday/)) {
    if (data.classes.length === 0) {
      return { answer: "I don't have your timetable yet. Upload it in the Upload tab!", sources: [] }
    }
    let dayFilter: string | null = null
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    for (const day of days) { if (q.includes(day)) { dayFilter = day; break } }
    if (q.includes('today')) dayFilter = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    if (q.includes('tomorrow')) {
      const tom = new Date(); tom.setDate(tom.getDate() + 1)
      dayFilter = tom.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    }
    const filtered = dayFilter ? data.classes.filter((c) => c.day.toLowerCase() === dayFilter) : data.classes
    if (filtered.length === 0) return { answer: `No classes on ${dayFilter}. Enjoy! 🎉`, sources: ['timetable'] }
    const sorted = [...filtered].sort((a, b) => `${a.day}${a.time}`.localeCompare(`${b.day}${b.time}`))
    const lines = sorted.map((c) => `• ${c.time} — ${c.subject} (${c.location})`)
    const header = dayFilter ? `📅 ${dayFilter.charAt(0).toUpperCase() + dayFilter.slice(1)} schedule:` : `📅 Full schedule (${data.classes.length} classes):`
    return { answer: `${header}\n\n${lines.join('\n')}`, sources: ['timetable'] }
  }

  // ─── QUERY: Deadlines ─────────────────────────────────────────────────────
  if (q.match(/deadline|assignment|due|submit|homework|pending|when.*due/)) {
    if (data.deadlines.length === 0) return { answer: "No deadlines found. Upload an assignment sheet or tell me about one!", sources: [] }
    const now = new Date()
    const sorted = [...data.deadlines].sort((a, b) => a.due_date.localeCompare(b.due_date))
    const lines = sorted.map((d) => {
      const dueDate = new Date(d.due_date + 'T23:59:00')
      const hoursLeft = Math.round((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60))
      const urgency = hoursLeft <= 24 ? '🚨' : hoursLeft <= 72 ? '⚠️' : '📝'
      const timeStr = hoursLeft <= 24 ? `${hoursLeft}h left` : `${Math.round(hoursLeft / 24)}d left`
      return `${urgency} ${d.title}\n   ${d.subject} • Due: ${d.due_date} (${timeStr})`
    })
    return { answer: `⏰ Your deadlines:\n\n${lines.join('\n\n')}`, sources: ['assignment_sheet'] }
  }

  // ─── QUERY: Events ────────────────────────────────────────────────────────
  if (q.match(/event|hackathon|fest|club|codestorm|competition/)) {
    if (data.events.length === 0) return { answer: "No events found. Upload an event poster!", sources: [] }
    const lines = data.events.map((e) => `🎪 ${e.name}\n   📍 ${e.venue} • 🏫 ${e.club}\n   📅 ${new Date(e.datetime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`)
    return { answer: `Upcoming events:\n\n${lines.join('\n\n')}`, sources: ['event_poster'] }
  }

  // ─── QUERY: Notices ───────────────────────────────────────────────────────
  if (q.match(/notice|announcement|circular|hostel|water|wifi|exam/)) {
    if (data.notices.length === 0) return { answer: "No notices found.", sources: [] }
    let filtered = data.notices
    if (q.includes('hostel') || q.includes('water') || q.includes('wifi')) filtered = data.notices.filter((n) => n.category === 'hostel')
    else if (q.includes('exam') || q.includes('academic')) filtered = data.notices.filter((n) => n.category === 'academic')
    if (filtered.length === 0) filtered = data.notices
    const lines = filtered.map((n) => `📢 [${n.category}] ${n.title}\n   ${n.body.slice(0, 100)}`)
    return { answer: `${filtered.length} notice(s):\n\n${lines.join('\n\n')}`, sources: ['notices'] }
  }

  // ─── FALLBACK ─────────────────────────────────────────────────────────────
  return {
    answer: "I can help you with:\n\n📋 **Ask** — schedule, deadlines, menu, placements, events, notices\n➕ **Add** — \"Add DBMS assignment due tomorrow\"\n🗑️ **Remove** — \"Remove mess menu\" or \"Clear all data\"\n\nTry:\n• \"What's for dinner?\"\n• \"I have a CN lab report due in 2 days\"\n• \"Remove all deadlines\"\n• \"When is the Amazon placement test?\"",
    sources: [],
  }
}

// ─── PARSE DEADLINE FROM NATURAL TEXT ────────────────────────────────────────────

function parseDeadlineFromText(q: string): { id: string; title: string; subject: string; due_date: string; description: string; confidence: number } | null {
  // Try to extract subject and time
  const now = new Date()

  // Extract hours: "in 9 hours", "in 3 hrs"
  const hoursMatch = q.match(/in\s+(\d+)\s*(?:hours?|hrs?|h)\b/)
  // Extract days: "in 2 days", "in 3 days"
  const daysMatch = q.match(/in\s+(\d+)\s*(?:days?|d)\b/)
  // Extract "tomorrow"
  const isTomorrow = q.includes('tomorrow')
  // Extract "today"
  const isToday = q.includes('today')
  // Extract specific date: "oct 15", "october 15", "15 oct"
  const dateMatch = q.match(/(\d{1,2})\s*(?:st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i) ||
                    q.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{1,2})/i)

  let dueDate: Date | null = null

  if (hoursMatch) {
    const hours = parseInt(hoursMatch[1])
    dueDate = new Date(now.getTime() + hours * 60 * 60 * 1000)
  } else if (daysMatch) {
    const days = parseInt(daysMatch[1])
    dueDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
  } else if (isTomorrow) {
    dueDate = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  } else if (isToday) {
    dueDate = now
  } else if (dateMatch) {
    const months: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }
    let day: number, month: number
    if (/^\d/.test(dateMatch[1])) {
      day = parseInt(dateMatch[1])
      month = months[dateMatch[2].toLowerCase().slice(0, 3)]
    } else {
      month = months[dateMatch[1].toLowerCase().slice(0, 3)]
      day = parseInt(dateMatch[2])
    }
    dueDate = new Date(now.getFullYear(), month, day)
    if (dueDate < now) dueDate.setFullYear(now.getFullYear() + 1)
  }

  if (!dueDate) return null

  // Extract subject keywords — only match as whole words, no short ambiguous ones
  const subjects: [RegExp, string][] = [
    [/\bdbms\b/, 'Database Management Systems'],
    [/\bdsa\b/, 'Data Structures & Algorithms'],
    [/\bcomputer networks?\b|\bcn lab\b/, 'Computer Networks'],
    [/\boperating system|\bos lab\b/, 'Operating Systems'],
    [/\bmath(?:ematics|s)?\b/, 'Mathematics'],
    [/\bdigital electronics\b|\bde lab\b/, 'Digital Electronics'],
    [/\bphysics\b/, 'Physics'],
    [/\bchemistry\b/, 'Chemistry'],
    [/\benglish\b/, 'English'],
    [/\bsoft skill/, 'Soft Skills'],
    [/\bmachine learning\b|\bml\b/, 'Machine Learning'],
    [/\bai\b/, 'Artificial Intelligence'],
  ]

  let subject = 'General'
  let title = 'Assignment'

  for (const [pattern, val] of subjects) {
    if (pattern.test(q)) { subject = val; break }
  }

  // Try to extract a title from the message
  // Remove common action words and time phrases, keep the meaningful part
  let titleCandidate = q
    .replace(/\b(?:add|create|set|remind|i have|i've got|i got|there is|there's|a|an|the|me|my|about|that|this|its|it's)\b/gi, '')
    .replace(/\b(?:due|submission|deadline|assignment|homework|exam|test|quiz)\b/gi, '')
    .replace(/in\s+\d+\s*(?:hours?|hrs?|h|days?|d|minutes?|mins?)\b/gi, '')
    .replace(/\b(?:tomorrow|today|tonight)\b/gi, '')
    .replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s*\d{0,2}/gi, '')
    .replace(/\d{1,2}\s*(?:st|nd|rd|th)/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  // If after cleanup the title is too short or garbage, use subject
  if (titleCandidate.length < 4 || titleCandidate.split(' ').every(w => w.length < 3)) {
    title = `${subject} Assignment`
  } else {
    // Capitalize properly
    title = titleCandidate
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
    // Append type if not already there
    if (!title.toLowerCase().includes('assignment') && !title.toLowerCase().includes('report') &&
        !title.toLowerCase().includes('project') && !title.toLowerCase().includes('lab')) {
      title = `${title} — Assignment`
    }
  }

  const dueDateStr = dueDate.toISOString().split('T')[0]
  const id = `user-${Date.now()}`

  return {
    id,
    title,
    subject,
    due_date: dueDateStr,
    description: `Added via chat. Due: ${dueDate.toLocaleString('en-IN')}`,
    confidence: 1.0,
  }
}
