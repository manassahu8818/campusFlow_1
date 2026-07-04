import { useEffect, useState } from 'react'
import { useStore } from '../lib/useStore'
import { StudentData, getProfile, completeIntentByTopic, toggleIntentStep } from '../lib/store'

export default function Today() {
  const data = useStore()
  const [contests, setContests] = useState<Array<{platform:string;title:string;startTime:string;durationHours:number;url:string}>>([])
  const [opportunities, setOpportunities] = useState<Array<{title:string;url:string;snippet:string;source:string;tag?:string}>>([])
  const [aiCards, setAiCards] = useState<Array<{id:string;type:string;title:string;body:string;actionLabel?:string}>>([])
  const openIntents = (data as any).intents?.filter((i: any) => i.status === 'open') || []
  const profile = getProfile()

  // Fetch contests, opportunities, and AI proactive cards on mount (cached 5 min)
  useEffect(() => {
    const API = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
    const lastCall = sessionStorage.getItem('today_last_fetch')
    const now = Date.now()
    
    // Only fetch if more than 5 minutes since last call
    if (lastCall && now - parseInt(lastCall) < 300000) {
      // Use cached data from sessionStorage
      try {
        const cached = sessionStorage.getItem('today_cached_data')
        if (cached) {
          const d = JSON.parse(cached)
          if (d.contests) setContests(d.contests)
          if (d.opportunities) setOpportunities(d.opportunities)
          if (d.aiCards) setAiCards(d.aiCards)
        }
      } catch {}
      return
    }

    sessionStorage.setItem('today_last_fetch', now.toString())

    // Contests (only for placement-focused users)
    if (profile.placementFocus === 'Yes, actively' || profile.priorities?.includes('Placements')) {
      fetch(`${API}/contests`).then(r => r.json()).then(d => {
        if (d.contests) { setContests(d.contests.slice(0, 5)); _cacheToday('contests', d.contests.slice(0, 5)) }
      }).catch(() => {})
    }

    // Opportunities
    fetch(`${API}/opportunities?student_id=aarav-demo`).then(r => r.json()).then(d => {
      if (d.opportunities) { setOpportunities(d.opportunities.slice(0, 5)); _cacheToday('opportunities', d.opportunities.slice(0, 5)) }
    }).catch(() => {})

    // AI Proactive cards
    fetch(`${API}/proactive/aarav-demo`).then(r => r.json()).then(d => {
      if (d.cards && d.cards.length) { setAiCards(d.cards); _cacheToday('aiCards', d.cards) }
    }).catch(() => {})
  }, [])

  function _cacheToday(key: string, value: any) {
    try {
      const existing = JSON.parse(sessionStorage.getItem('today_cached_data') || '{}')
      existing[key] = value
      sessionStorage.setItem('today_cached_data', JSON.stringify(existing))
    } catch {}
  }

  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  const todayClasses = data.classes
    .filter((c) => c.day.toLowerCase() === todayName.toLowerCase())
    .sort((a, b) => a.time.localeCompare(b.time))

  const cards = generateCards(data)

  const isEmpty = data.classes.length === 0 && data.deadlines.length === 0 &&
    data.notices.length === 0 && data.menu_items.length === 0 &&
    data.events.length === 0 && data.placements.length === 0

  return (
    <div className="p-5 space-y-6 animate-fade-in">
      {/* Greeting */}
      <div className="animate-slide-up" style={{ animationDelay: '0ms' }}>
        <h2 className="text-subtitle text-heading">
          {getGreeting()}, {getProfile().name || 'Aarav'}
        </h2>
        <p className="text-sm text-secondary mt-1">{todayName} • {formatDate()}</p>
      </div>

      {/* Empty State */}
      {isEmpty && (
        <div className="animate-slide-up bg-gradient-to-br from-accent-50 to-purple-50 rounded-3xl p-8 text-center border border-accent-100" style={{ animationDelay: '100ms' }}>
          <div className="w-20 h-20 bg-white rounded-2xl mx-auto flex items-center justify-center shadow-card mb-4 animate-float">
            <span className="text-4xl">📸</span>
          </div>
          <p className="text-[17px] font-bold text-heading">Your campus life starts here</p>
          <p className="text-sm text-secondary mt-2 max-w-[260px] mx-auto leading-relaxed">
            Upload your timetable, mess menu, or any campus document to see your day come alive.
          </p>
          <a
            href="/upload"
            className="inline-block mt-5 px-6 py-3 bg-gradient-to-r from-accent-from to-accent-to text-white rounded-xl text-sm font-semibold shadow-glow btn-press transition-all hover:shadow-lg"
          >
            Upload First Document
          </a>
        </div>
      )}

      {/* Proactive Cards */}
      {cards.length > 0 && (
        <section className="animate-slide-up" style={{ animationDelay: '60ms' }}>
          <h3 className="text-label text-secondary uppercase tracking-wider mb-3">⚡ Heads Up</h3>
          <div className="space-y-3">
            {cards.map((card, i) => (
              <div
                key={i}
                className={`rounded-2xl p-4 animate-slide-up transition-shadow ${
                  card.type === 'alert'
                    ? 'bg-gradient-to-r from-red-50 to-orange-50 border border-red-100 animate-pulse-glow'
                    : card.type === 'reminder'
                    ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-100'
                    : card.type === 'placement'
                    ? 'bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100'
                    : 'bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100'
                }`}
                style={{ animationDelay: `${120 + i * 60}ms` }}
              >
                <p className="text-[15px] font-semibold text-heading">{card.title}</p>
                <p className="text-[13px] text-secondary mt-1 leading-relaxed">{card.body}</p>
                {card.action && (
                  <button className="mt-2.5 text-[12px] font-bold text-accent-from hover:text-accent-700 transition-colors">
                    {card.action} →
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Today's Schedule */}
      {data.classes.length > 0 && (
        <section className="animate-slide-up" style={{ animationDelay: '120ms' }}>
          <h3 className="text-label text-secondary uppercase tracking-wider mb-3">📅 Today's Classes</h3>
          {todayClasses.length === 0 ? (
            <div className="bg-white rounded-2xl p-5 border border-border-subtle shadow-card text-center">
              <p className="text-sm text-secondary">No classes today! 🎉</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-border-subtle shadow-card overflow-hidden">
              {todayClasses.map((c, i) => (
                <div
                  key={i}
                  className="px-5 py-3.5 flex items-center gap-4 border-b border-border-subtle last:border-0 animate-slide-up"
                  style={{ animationDelay: `${180 + i * 50}ms` }}
                >
                  <div className="w-12 text-center shrink-0">
                    <span className="text-[13px] font-mono font-bold text-accent-from">{c.time}</span>
                  </div>
                  <div className="w-[3px] h-9 bg-gradient-to-b from-accent-from to-accent-to rounded-full shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-heading truncate">{c.subject}</p>
                    <p className="text-[12px] text-secondary mt-0.5">{c.location} {c.professor ? `• ${c.professor}` : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Deadlines */}
      {data.deadlines.length > 0 && (
        <section className="animate-slide-up" style={{ animationDelay: '180ms' }}>
          <h3 className="text-label text-secondary uppercase tracking-wider mb-3">⏰ Deadlines</h3>
          <div className="space-y-3">
            {data.deadlines.map((d, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-border-subtle shadow-card animate-slide-up" style={{ animationDelay: `${240 + i * 50}ms` }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-heading">{d.title}</p>
                    <p className="text-[12px] text-secondary mt-1">{d.subject}</p>
                  </div>
                  <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-lg border border-red-100 shrink-0">
                    {d.due_date}
                  </span>
                </div>
                {d.description && (
                  <p className="text-[12px] text-secondary mt-2 line-clamp-2 leading-relaxed">{d.description}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Placements */}
      {data.placements.length > 0 && (
        <section className="animate-slide-up" style={{ animationDelay: '240ms' }}>
          <h3 className="text-label text-secondary uppercase tracking-wider mb-3">🎯 Placement Drives</h3>
          <div className="space-y-3">
            {data.placements.map((p, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-purple-100 shadow-card animate-slide-up" style={{ animationDelay: `${300 + i * 50}ms` }}>
                <p className="text-[14px] font-bold text-heading">{p.company} — {p.role}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-[11px] bg-green-50 text-green-700 px-2 py-0.5 rounded-md font-medium">💰 {p.ctc}</span>
                  <span className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-medium">📊 {p.cgpa_cutoff}+</span>
                </div>
                <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-secondary">
                  <span>📝 Register by {p.registration_deadline}</span>
                  <span>🖥️ Test: {p.test_date}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Events */}
      {data.events.length > 0 && (
        <section className="animate-slide-up" style={{ animationDelay: '300ms' }}>
          <h3 className="text-label text-secondary uppercase tracking-wider mb-3">🎪 Events</h3>
          <div className="space-y-3">
            {data.events.map((e, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-border-subtle shadow-card animate-slide-up" style={{ animationDelay: `${360 + i * 50}ms` }}>
                <p className="text-[14px] font-bold text-heading">{e.name}</p>
                <p className="text-[12px] text-secondary mt-1.5">📍 {e.venue} • 🏫 {e.club}</p>
                <p className="text-[11px] text-secondary mt-1">
                  {new Date(e.datetime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Mess Menu */}
      {data.menu_items.length > 0 && (
        <section className="animate-slide-up" style={{ animationDelay: '360ms' }}>
          <h3 className="text-label text-secondary uppercase tracking-wider mb-3">🍽️ Today's Menu</h3>
          <div className="bg-white rounded-2xl border border-border-subtle shadow-card overflow-hidden">
            {getTodayMenu(data.menu_items, todayName).length > 0 ? (
              getTodayMenu(data.menu_items, todayName).map((m, i) => (
                <div key={i} className="px-5 py-3.5 border-b border-border-subtle last:border-0">
                  <p className="text-[10px] font-bold text-secondary uppercase tracking-wider">{m.meal}</p>
                  <p className="text-[14px] text-heading mt-1">{m.items.join(' • ')}</p>
                </div>
              ))
            ) : (
              <div className="px-5 py-4 text-sm text-gray-500">No menu data for {todayName}. Upload the mess menu to see today's food.</div>
            )}
          </div>
        </section>
      )}

      {/* Notices */}
      {data.notices.length > 0 && (
        <section className="animate-slide-up" style={{ animationDelay: '420ms' }}>
          <h3 className="text-label text-secondary uppercase tracking-wider mb-3">📢 Notices</h3>
          <div className="space-y-3">
            {data.notices.map((n, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-border-subtle shadow-card animate-slide-up" style={{ animationDelay: `${480 + i * 50}ms` }}>
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-md ${
                    n.category === 'placement' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                    n.category === 'academic' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                    n.category === 'hostel' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                    n.category === 'event' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                    'bg-gray-50 text-gray-600 border border-gray-200'
                  }`}>
                    {n.category}
                  </span>
                  {n.date && <span className="text-[10px] text-secondary">{n.date}</span>}
                </div>
                <p className="text-[14px] font-semibold text-heading mt-2">{n.title}</p>
                <p className="text-[12px] text-secondary mt-1 line-clamp-2 leading-relaxed">{n.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* AI Personalized Cards */}
      {aiCards.length > 0 && (
        <section className="animate-slide-up" style={{ animationDelay: '480ms' }}>
          <h3 className="text-label text-secondary uppercase tracking-wider mb-3">🤖 {profile.agentName || 'Flow'} Says</h3>
          <div className="space-y-3">
            {aiCards.map((card, i) => (
              <div key={card.id || i} className="bg-gradient-to-r from-indigo-50 to-violet-50 rounded-2xl p-4 border border-indigo-100 shadow-card">
                <p className="text-[14px] font-semibold text-heading">{card.title}</p>
                <p className="text-[12px] text-secondary mt-1 leading-relaxed">{card.body}</p>
                {card.actionLabel && (
                  <button className="mt-2 text-[11px] font-bold text-indigo-600 hover:text-indigo-800">{card.actionLabel} →</button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Your Goals / Intents */}
      {openIntents.length > 0 && (
        <section className="animate-slide-up" style={{ animationDelay: '540ms' }}>
          <h3 className="text-label text-secondary uppercase tracking-wider mb-3">🎯 Your Goals</h3>
          <div className="space-y-3">
            {openIntents.map((intent: any) => (
              <GoalCard key={intent.id} intent={intent} />
            ))}
          </div>
        </section>
      )}

      {/* Coding Contests */}
      {contests.length > 0 && (
        <section className="animate-slide-up" style={{ animationDelay: '600ms' }}>
          <h3 className="text-label text-secondary uppercase tracking-wider mb-3">🏆 Upcoming Contests</h3>
          <div className="bg-white rounded-2xl border border-border-subtle shadow-card overflow-hidden">
            {contests.map((c, i) => (
              <a key={i} href={c.url} target="_blank" rel="noopener noreferrer"
                className="px-4 py-3 flex items-center gap-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                  <span className="text-sm">💻</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-heading truncate">{c.title}</p>
                  <p className="text-[10px] text-secondary">{c.platform} • {new Date(c.startTime).toLocaleDateString('en-IN', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} • {c.durationHours}h</p>
                </div>
                <span className="text-[10px] text-indigo-500 font-bold shrink-0">Open ↗</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Opportunities / Discover */}
      {opportunities.length > 0 && (
        <section className="animate-slide-up" style={{ animationDelay: '660ms' }}>
          <h3 className="text-label text-secondary uppercase tracking-wider mb-3">🌐 Discover</h3>
          <div className="space-y-2">
            {opportunities.map((opp, i) => (
              <a key={i} href={opp.url} target="_blank" rel="noopener noreferrer"
                className="block bg-white rounded-2xl p-3.5 border border-border-subtle shadow-card hover:border-indigo-200 transition-colors">
                <div className="flex items-start gap-2">
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0">{opp.tag || opp.source}</span>
                </div>
                <p className="text-[13px] font-medium text-heading mt-1.5 line-clamp-2">{opp.title}</p>
                {opp.snippet && <p className="text-[11px] text-secondary mt-1 line-clamp-1">{opp.snippet}</p>}
              </a>
            ))}
          </div>
        </section>
      )}

      <div className="h-6" />
    </div>
  )
}

function GoalCard({ intent }: { intent: any }) {
  const [expanded, setExpanded] = useState(false)
  const hasSteps = intent.steps && intent.steps.length > 0
  const completed = intent.stepsCompleted || (intent.steps || []).map(() => false)
  const doneCount = completed.filter(Boolean).length
  const totalSteps = (intent.steps || []).length

  return (
    <div className="bg-white rounded-2xl border border-border-subtle shadow-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3">
        {!hasSteps ? (
          <button className="w-5 h-5 rounded-full border-2 border-indigo-300 flex items-center justify-center shrink-0 hover:bg-emerald-400 hover:border-emerald-400 transition-all group"
            onClick={() => completeIntentByTopic(intent.topic)}
            title="Mark as done">
            <span className="text-[10px] text-transparent group-hover:text-white">✓</span>
          </button>
        ) : (
          <button onClick={() => setExpanded(!expanded)}
            className="w-5 h-5 flex items-center justify-center shrink-0 text-indigo-400 transition-transform"
            style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
            <span className="text-[12px]">▶</span>
          </button>
        )}
        <div className="flex-1 cursor-pointer" onClick={() => hasSteps && setExpanded(!expanded)}>
          <p className="text-[13px] font-medium text-heading">{intent.text}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[10px] text-secondary">Added {new Date(intent.createdAt).toLocaleDateString()}</p>
            {hasSteps && (
              <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">
                {doneCount}/{totalSteps} done
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Expandable subtasks */}
      {hasSteps && expanded && (
        <div className="px-4 pb-3 space-y-1.5 border-t border-gray-50 pt-2">
          {intent.steps.map((step: string, si: number) => (
            <label key={si} className="flex items-start gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={completed[si] || false}
                onChange={() => toggleIntentStep(intent.id, si)}
                className="w-4 h-4 mt-0.5 rounded border-gray-300 text-indigo-500 focus:ring-indigo-400 shrink-0"
              />
              <span className={`text-[12px] leading-relaxed ${completed[si] ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                {step}
              </span>
            </label>
          ))}
        </div>
      )}

      {/* Progress bar */}
      {hasSteps && (
        <div className="h-1 bg-gray-100">
          <div className="h-1 bg-gradient-to-r from-indigo-400 to-violet-400 transition-all duration-300"
            style={{ width: `${totalSteps > 0 ? (doneCount / totalSteps) * 100 : 0}%` }} />
        </div>
      )}
    </div>
  )
}

function getTodayMenu(items: StudentData['menu_items'], todayName: string) {
  // Strict match: only show today's meals. No fallback to other days.
  const todayItems = items.filter((m) => m.day.toLowerCase() === todayName.toLowerCase())
  if (todayItems.length > 0) {
    // Sort: breakfast, lunch, snacks, dinner
    const order = ['breakfast', 'lunch', 'snacks', 'dinner']
    return todayItems.sort((a, b) => order.indexOf(a.meal.toLowerCase()) - order.indexOf(b.meal.toLowerCase()))
  }
  return [] // empty = "Not available" will show
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate() {
  return new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

interface Card {
  type: 'alert' | 'reminder' | 'suggestion' | 'placement'
  title: string
  body: string
  action?: string
}

function generateCards(data: StudentData): Card[] {
  const cards: Card[] = []
  const now = new Date()

  data.deadlines.forEach((d) => {
    const dueDate = new Date(d.due_date + 'T23:59:00')
    const hoursLeft = Math.max(0, Math.round((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60)))

    if (hoursLeft <= 24) {
      cards.push({
        type: 'alert',
        title: `🚨 ${d.title.split('—')[0].trim()} due in ${hoursLeft} hours!`,
        body: `${d.subject} — submit before midnight. Don't risk the late penalty!`,
        action: 'Start now',
      })
    } else if (hoursLeft <= 72) {
      cards.push({
        type: 'reminder',
        title: `📝 ${d.title.split('—')[0].trim()} due in ${Math.round(hoursLeft / 24)} days`,
        body: `${d.subject}. Start early to avoid last-minute rush.`,
        action: 'Set study block',
      })
    }
  })

  data.placements.forEach((p) => {
    const regDate = new Date(p.registration_deadline)
    const daysLeft = Math.round((regDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (daysLeft >= 0 && daysLeft <= 14) {
      cards.push({
        type: 'placement',
        title: `🎯 ${p.company} — register by ${p.registration_deadline}`,
        body: `${p.role}. Test on ${p.test_date}. CTC: ${p.ctc}`,
        action: 'Open portal',
      })
    }
  })

  data.events.forEach((e) => {
    const eventDate = new Date(e.datetime)
    const daysLeft = Math.round((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (daysLeft >= 0 && daysLeft <= 7) {
      cards.push({
        type: 'suggestion',
        title: `🎪 ${e.name} in ${daysLeft} days`,
        body: `${e.venue} • ${e.club}`,
        action: 'View details',
      })
    }
  })

  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  const todayClasses = data.classes.filter((c) => c.day.toLowerCase() === todayName.toLowerCase())
  if (todayClasses.length > 0) {
    const first = todayClasses.sort((a, b) => a.time.localeCompare(b.time))[0]
    cards.push({
      type: 'suggestion',
      title: `📚 ${todayClasses.length} classes today`,
      body: `First up: ${first.subject} at ${first.time} in ${first.location}`,
    })
  }

  return cards.slice(0, 5)
}
