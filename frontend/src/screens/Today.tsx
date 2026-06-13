import { useStore } from '../lib/useStore'
import { StudentData } from '../lib/store'

export default function Today() {
  const data = useStore()

  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  const todayClasses = data.classes
    .filter((c) => c.day.toLowerCase() === todayName.toLowerCase())
    .sort((a, b) => a.time.localeCompare(b.time))

  // Generate proactive cards
  const cards = generateCards(data)

  const isEmpty = data.classes.length === 0 && data.deadlines.length === 0 &&
    data.notices.length === 0 && data.menu_items.length === 0 &&
    data.events.length === 0 && data.placements.length === 0

  return (
    <div className="p-4 space-y-5 animate-fade-in">
      {/* Greeting */}
      <div>
        <h2 className="text-xl font-bold text-gray-800">
          {getGreeting()}, Aarav 👋
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">{todayName} • {formatDate()}</p>
      </div>

      {/* Empty State */}
      {isEmpty && (
        <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl p-6 text-center border border-indigo-100">
          <div className="w-16 h-16 bg-white rounded-2xl mx-auto flex items-center justify-center shadow-sm mb-3">
            <span className="text-3xl">📸</span>
          </div>
          <p className="text-sm font-semibold text-gray-800">Your campus life starts here</p>
          <p className="text-xs text-gray-500 mt-1 max-w-[240px] mx-auto">
            Upload your timetable, mess menu, or any campus document to see everything come alive.
          </p>
          <a
            href="/upload"
            className="inline-block mt-4 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-200"
          >
            Upload First Document
          </a>
        </div>
      )}

      {/* Proactive Cards */}
      {cards.length > 0 && (
        <section>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">⚡ Heads Up</h3>
          <div className="space-y-2">
            {cards.map((card, i) => (
              <div
                key={i}
                className={`rounded-xl p-3.5 border-l-4 animate-slide-up ${
                  card.type === 'alert' ? 'bg-red-50 border-l-red-400' :
                  card.type === 'reminder' ? 'bg-amber-50 border-l-amber-400' :
                  card.type === 'suggestion' ? 'bg-blue-50 border-l-blue-400' :
                  'bg-purple-50 border-l-purple-400'
                }`}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <p className="text-sm font-semibold text-gray-800">{card.title}</p>
                <p className="text-xs text-gray-600 mt-0.5">{card.body}</p>
                {card.action && (
                  <button className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
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
        <section>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">📅 Today's Classes</h3>
          {todayClasses.length === 0 ? (
            <div className="bg-white rounded-xl p-4 border border-gray-100 text-center">
              <p className="text-sm text-gray-500">No classes today! 🎉</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {todayClasses.map((c, i) => (
                <div
                  key={i}
                  className="px-4 py-3 flex items-center gap-3 border-b border-gray-50 last:border-0"
                >
                  <div className="w-12 text-center">
                    <span className="text-xs font-mono font-bold text-indigo-600">{c.time}</span>
                  </div>
                  <div className="w-1 h-8 bg-gradient-to-b from-indigo-400 to-violet-400 rounded-full" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{c.subject}</p>
                    <p className="text-xs text-gray-500">{c.location} {c.professor ? `• ${c.professor}` : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Upcoming Deadlines */}
      {data.deadlines.length > 0 && (
        <section>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">⏰ Deadlines</h3>
          <div className="space-y-2">
            {data.deadlines.map((d, i) => (
              <div key={i} className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{d.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{d.subject}</p>
                  </div>
                  <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg shrink-0 ml-2">
                    {d.due_date}
                  </span>
                </div>
                {d.description && (
                  <p className="text-xs text-gray-500 mt-2 line-clamp-2">{d.description}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Placements */}
      {data.placements.length > 0 && (
        <section>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">🎯 Placement Drives</h3>
          <div className="space-y-2">
            {data.placements.map((p, i) => (
              <div key={i} className="bg-white rounded-xl p-3.5 border border-purple-100 shadow-sm">
                <p className="text-sm font-semibold text-gray-800">{p.company} — {p.role}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-500">
                  <span>💰 {p.ctc}</span>
                  <span>📊 {p.cgpa_cutoff}+ CGPA</span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
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
        <section>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">🎪 Upcoming Events</h3>
          <div className="space-y-2">
            {data.events.map((e, i) => (
              <div key={i} className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-sm">
                <p className="text-sm font-semibold text-gray-800">{e.name}</p>
                <p className="text-xs text-gray-500 mt-1">📍 {e.venue} • 🏫 {e.club}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(e.datetime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Mess Menu */}
      {data.menu_items.length > 0 && (
        <section>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">🍽️ Today's Menu</h3>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {getTodayMenu(data.menu_items, todayName).map((m, i) => (
              <div key={i} className="px-4 py-3 border-b border-gray-50 last:border-0">
                <p className="text-[10px] font-bold text-gray-400 uppercase">{m.meal}</p>
                <p className="text-sm text-gray-700 mt-0.5">{m.items.join(' • ')}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Notices */}
      {data.notices.length > 0 && (
        <section>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">📢 Recent Notices</h3>
          <div className="space-y-2">
            {data.notices.map((n, i) => (
              <div key={i} className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                    n.category === 'placement' ? 'bg-purple-100 text-purple-700' :
                    n.category === 'academic' ? 'bg-blue-100 text-blue-700' :
                    n.category === 'hostel' ? 'bg-amber-100 text-amber-700' :
                    n.category === 'event' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {n.category}
                  </span>
                  {n.date && <span className="text-[10px] text-gray-400">{n.date}</span>}
                </div>
                <p className="text-sm font-medium text-gray-800 mt-1">{n.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Bottom spacer */}
      <div className="h-4" />
    </div>
  )
}

function getTodayMenu(items: StudentData['menu_items'], todayName: string) {
  const todayItems = items.filter((m) => m.day.toLowerCase() === todayName.toLowerCase())
  if (todayItems.length > 0) return todayItems
  // Fallback: show Monday (demo always has data for Monday)
  const mondayItems = items.filter((m) => m.day.toLowerCase() === 'monday')
  if (mondayItems.length > 0) return mondayItems
  return items.slice(0, 4)
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate() {
  return new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
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

  // Deadline alerts — calculate hours remaining
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

  // Placement alerts
  data.placements.forEach((p) => {
    const regDate = new Date(p.registration_deadline)
    const daysLeft = Math.round((regDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (daysLeft >= 0 && daysLeft <= 14) {
      cards.push({
        type: 'placement',
        title: `🎯 ${p.company} ${p.role} — register by ${p.registration_deadline}`,
        body: `Test on ${p.test_date}. CTC: ${p.ctc}. CGPA cutoff: ${p.cgpa_cutoff}+`,
        action: 'Open portal',
      })
    }
  })

  // Event reminders
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

  // Schedule suggestion
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

  return cards.slice(0, 5) // max 5 cards
}
