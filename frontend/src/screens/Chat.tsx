import { useState, useRef, useEffect } from 'react'
import { useStore } from '../lib/useStore'
import { StudentData } from '../lib/store'

interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: string[]
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const data = useStore()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const question = input.trim()
    setMessages((prev) => [...prev, { role: 'user', content: question }])
    setInput('')
    setLoading(true)

    // Simulate thinking delay
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 400))

    const { answer, sources } = answerFromStore(question, data)
    setMessages((prev) => [...prev, { role: 'assistant', content: answer, sources }])
    setLoading(false)
  }

  const suggestions = [
    "What's my schedule today?",
    "When is my next deadline?",
    "What's for dinner?",
    "When is the Amazon placement test?",
  ]

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center pt-8 space-y-4">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-2xl mx-auto flex items-center justify-center">
              <span className="text-3xl">💬</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Ask about your campus life</p>
              <p className="text-xs text-gray-400 mt-1">
                Answers come only from YOUR uploaded documents — never hallucinated.
              </p>
            </div>
            {/* Quick suggestions */}
            <div className="flex flex-wrap gap-2 justify-center pt-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
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
            className={`max-w-[85%] animate-slide-up ${
              msg.role === 'user' ? 'ml-auto' : 'mr-auto'
            }`}
          >
            <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-br-md'
                : 'bg-white border border-gray-100 text-gray-800 shadow-sm rounded-bl-md'
            }`}>
              <span className="whitespace-pre-wrap">{msg.content}</span>
            </div>
            {msg.sources && msg.sources.length > 0 && (
              <p className="text-[10px] text-gray-400 mt-1 ml-1">
                📎 Source: {msg.sources.join(', ')}
              </p>
            )}
          </div>
        ))}

        {loading && (
          <div className="mr-auto max-w-[85%] animate-slide-up">
            <div className="bg-white border border-gray-100 shadow-sm px-4 py-3 rounded-2xl rounded-bl-md">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-100 bg-white/80 backdrop-blur-lg">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask about your schedule, deadlines..."
            className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:bg-white transition-all"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="w-10 h-10 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl flex items-center justify-center disabled:opacity-40 hover:shadow-lg transition-all active:scale-95"
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

/**
 * Local Q&A engine — answers from the store data.
 * No backend needed. Keyword matching + formatted responses.
 */
function answerFromStore(
  question: string,
  data: StudentData,
): { answer: string; sources: string[] } {
  const q = question.toLowerCase()

  const hasData = data.classes.length > 0 || data.deadlines.length > 0 ||
    data.notices.length > 0 || data.menu_items.length > 0 ||
    data.events.length > 0 || data.placements.length > 0

  if (!hasData) {
    return {
      answer: "I don't have any data yet! Upload your timetable, notices, or mess menu first, then I can answer questions about them.",
      sources: [],
    }
  }

  // ─── PLACEMENT QUERIES ────────────────────────────────────────────────────────
  if (q.match(/placement|amazon|tcs|company|drive|intern|recruit|ctc|package/)) {
    if (data.placements.length === 0 && data.notices.filter((n) => n.category === 'placement').length === 0) {
      return { answer: "I don't have any placement info yet. Upload a placement circular!", sources: [] }
    }

    // Specific company query
    const companyMatch = data.placements.find((p) =>
      q.includes(p.company.toLowerCase())
    )
    if (companyMatch) {
      return {
        answer: `🎯 ${companyMatch.company} — ${companyMatch.role}\n\n` +
          `• CTC: ${companyMatch.ctc}\n` +
          `• CGPA Cutoff: ${companyMatch.cgpa_cutoff}+\n` +
          `• Registration Deadline: ${companyMatch.registration_deadline}\n` +
          `• Online Test: ${companyMatch.test_date}\n\n` +
          `Make sure to register before the deadline!`,
        sources: ['placement_circular'],
      }
    }

    // General placement query
    if (data.placements.length > 0) {
      const lines = data.placements.map((p) =>
        `• ${p.company} — ${p.role}\n  CTC: ${p.ctc} | Test: ${p.test_date} | Register by ${p.registration_deadline}`
      )
      return {
        answer: `🎯 Active placement drives:\n\n${lines.join('\n\n')}`,
        sources: ['placement_circular'],
      }
    }

    // Fall back to placement notices
    const placementNotices = data.notices.filter((n) => n.category === 'placement')
    const lines = placementNotices.map((n) => `• ${n.title}\n  ${n.body.slice(0, 100)}...`)
    return {
      answer: `📢 Placement notices:\n\n${lines.join('\n\n')}`,
      sources: ['notices'],
    }
  }

  // ─── MENU / FOOD QUERIES ──────────────────────────────────────────────────────
  if (q.match(/menu|mess|food|lunch|dinner|breakfast|snack|eat|canteen|what.*for/)) {
    if (data.menu_items.length === 0) {
      return { answer: "I don't have the mess menu yet. Upload a photo of it!", sources: [] }
    }

    // Specific meal filter
    let mealFilter: string | null = null
    if (q.includes('breakfast')) mealFilter = 'breakfast'
    else if (q.includes('lunch')) mealFilter = 'lunch'
    else if (q.includes('dinner')) mealFilter = 'dinner'
    else if (q.includes('snack')) mealFilter = 'snacks'

    // Day filter
    let dayFilter: string | null = null
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    for (const day of days) {
      if (q.includes(day)) { dayFilter = day; break }
    }
    if (q.includes('today') || (!dayFilter && mealFilter)) {
      dayFilter = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    }
    if (q.includes('tomorrow')) {
      const tom = new Date()
      tom.setDate(tom.getDate() + 1)
      dayFilter = tom.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    }

    let filtered = data.menu_items
    if (dayFilter) filtered = filtered.filter((m) => m.day.toLowerCase() === dayFilter)
    if (mealFilter) filtered = filtered.filter((m) => m.meal.toLowerCase() === mealFilter)

    // If no exact match for today, try Monday (demo data always has Monday)
    if (filtered.length === 0 && dayFilter) {
      filtered = data.menu_items.filter((m) => m.day.toLowerCase() === 'monday')
      if (mealFilter) filtered = filtered.filter((m) => m.meal.toLowerCase() === mealFilter)
    }

    if (filtered.length === 0) {
      return { answer: "Couldn't find menu for that specific day/meal. Try asking 'what's for dinner today?'", sources: ['mess_menu'] }
    }

    const lines = filtered.map((m) =>
      `🍽️ ${m.day} ${m.meal.charAt(0).toUpperCase() + m.meal.slice(1)}:\n   ${m.items.join(' • ')}`
    )
    return {
      answer: lines.join('\n\n'),
      sources: ['mess_menu'],
    }
  }

  // ─── SCHEDULE QUERIES ─────────────────────────────────────────────────────────
  if (q.match(/schedule|class|timetable|lecture|today|tomorrow|monday|tuesday|wednesday|thursday|friday/)) {
    if (data.classes.length === 0) {
      return { answer: "I don't have your timetable yet. Upload it in the Upload tab!", sources: [] }
    }

    let dayFilter: string | null = null
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    for (const day of days) {
      if (q.includes(day)) { dayFilter = day; break }
    }
    if (q.includes('today')) {
      dayFilter = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    }
    if (q.includes('tomorrow')) {
      const tom = new Date()
      tom.setDate(tom.getDate() + 1)
      dayFilter = tom.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    }

    const filtered = dayFilter
      ? data.classes.filter((c) => c.day.toLowerCase() === dayFilter)
      : data.classes

    if (filtered.length === 0) {
      return { answer: `No classes on ${dayFilter || 'that day'}. Enjoy! 🎉`, sources: ['timetable'] }
    }

    const sorted = [...filtered].sort((a, b) => `${a.day}${a.time}`.localeCompare(`${b.day}${b.time}`))
    const lines = sorted.map((c) => `• ${c.time} — ${c.subject} (${c.location})`)
    const header = dayFilter
      ? `📅 ${dayFilter.charAt(0).toUpperCase() + dayFilter.slice(1)} schedule:`
      : `📅 Full schedule (${data.classes.length} classes):`

    return { answer: `${header}\n\n${lines.join('\n')}`, sources: ['timetable'] }
  }

  // ─── DEADLINE QUERIES ─────────────────────────────────────────────────────────
  if (q.match(/deadline|assignment|due|submit|homework|pending|when.*due/)) {
    if (data.deadlines.length === 0) {
      return { answer: "No deadlines found. Upload an assignment sheet!", sources: [] }
    }

    // Check for specific subject
    const subjectMatch = data.deadlines.find((d) =>
      q.includes(d.subject.toLowerCase().split(' ')[0].toLowerCase())
    )
    if (subjectMatch) {
      return {
        answer: `⏰ ${subjectMatch.title}\n\n` +
          `• Subject: ${subjectMatch.subject}\n` +
          `• Due: ${subjectMatch.due_date}\n` +
          (subjectMatch.description ? `• Details: ${subjectMatch.description}` : ''),
        sources: ['assignment_sheet'],
      }
    }

    const now = new Date()
    const sorted = [...data.deadlines].sort((a, b) => a.due_date.localeCompare(b.due_date))
    const lines = sorted.map((d) => {
      const dueDate = new Date(d.due_date + 'T23:59:00')
      const hoursLeft = Math.round((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60))
      const urgency = hoursLeft <= 24 ? '🚨' : hoursLeft <= 72 ? '⚠️' : '📝'
      const timeStr = hoursLeft <= 24 ? `${hoursLeft}h left` : `${Math.round(hoursLeft / 24)}d left`
      return `${urgency} ${d.title}\n   ${d.subject} • Due: ${d.due_date} (${timeStr})`
    })
    return {
      answer: `⏰ Your deadlines:\n\n${lines.join('\n\n')}`,
      sources: ['assignment_sheet'],
    }
  }

  // ─── EVENT QUERIES ────────────────────────────────────────────────────────────
  if (q.match(/event|hackathon|fest|club|codestorm|competition/)) {
    if (data.events.length === 0) {
      return { answer: "No events found. Upload an event poster or notice!", sources: [] }
    }
    const lines = data.events.map((e) =>
      `🎪 ${e.name}\n   📍 ${e.venue} • 🏫 ${e.club}\n   📅 ${new Date(e.datetime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    )
    return {
      answer: `Upcoming events:\n\n${lines.join('\n\n')}`,
      sources: ['event_poster'],
    }
  }

  // ─── NOTICE QUERIES ───────────────────────────────────────────────────────────
  if (q.match(/notice|announcement|circular|hostel|water|wifi|exam/)) {
    if (data.notices.length === 0) {
      return { answer: "No notices found. Upload campus notices to track them!", sources: [] }
    }

    let filtered = data.notices
    if (q.includes('hostel') || q.includes('water') || q.includes('wifi')) {
      filtered = data.notices.filter((n) => n.category === 'hostel')
    } else if (q.includes('exam') || q.includes('academic')) {
      filtered = data.notices.filter((n) => n.category === 'academic')
    }

    if (filtered.length === 0) filtered = data.notices

    const lines = filtered.map((n) => `📢 [${n.category}] ${n.title}\n   ${n.body.slice(0, 100)}`)
    return {
      answer: `${filtered.length} notice(s):\n\n${lines.join('\n\n')}`,
      sources: ['notices'],
    }
  }

  // ─── GENERIC FALLBACK ─────────────────────────────────────────────────────────
  return {
    answer: "I can answer about your schedule, deadlines, mess menu, placement drives, events, and notices — all from documents you've uploaded.\n\nTry:\n• \"What's for dinner?\"\n• \"When is the Amazon placement test?\"\n• \"What's my schedule on Monday?\"\n• \"Any upcoming deadlines?\"",
    sources: [],
  }
}
