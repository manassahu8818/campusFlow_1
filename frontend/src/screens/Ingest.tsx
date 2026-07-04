import { useState, useRef } from 'react'
import { ExtractionResult } from '../lib/stubExtractor'
import { extractDocument } from '../lib/extractApi'
import { addClasses, addDeadlines, addNotices, addMenuItems, addEvents, addPlacements } from '../lib/store'

export default function Ingest() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ExtractionResult | null>(null)
  const [saved, setSaved] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    setFile(f)
    setResult(null)
    setSaved(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const handleExtract = async () => {
    if (!file) return
    setLoading(true)
    try {
      const data = await extractDocument(file)
      setResult(data)
    } catch { /* fallback handled inside extractDocument */ }
    finally { setLoading(false) }
  }

  const handleSave = () => {
    if (!result) return
    if (result.classes.length > 0) addClasses(result.classes)
    if (result.deadlines.length > 0) addDeadlines(result.deadlines)
    if (result.notices.length > 0) addNotices(result.notices)
    if (result.menu_items.length > 0) addMenuItems(result.menu_items)
    if (result.events.length > 0) addEvents(result.events)
    if (result.placements.length > 0) addPlacements(result.placements)
    setSaved(true)
  }

  const reset = () => { setFile(null); setResult(null); setSaved(false) }

  const totalItems = result
    ? result.classes.length + result.deadlines.length + result.notices.length +
      result.menu_items.length + result.events.length + result.placements.length
    : 0

  // ─── If we have results, render the results view ──────────────────────────────
  if (result) {
    return <ResultsView result={result} totalItems={totalItems} saved={saved} onSave={handleSave} onReset={reset} />
  }

  // ─── Upload screen (inside the white dialogue box) ────────────────────────────
  return (
    <div className="p-6 flex flex-col h-full">
      {/* Badge */}
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 bg-[#22d3ee] rounded-full animate-pulse" />
        <span className="text-[10px] font-bold text-[#22d3ee] tracking-widest uppercase">AI INGEST</span>
      </div>

      {/* Title */}
      <h1 className="text-[28px] font-extrabold text-heading leading-tight tracking-tight" style={{ fontFamily: "'Sora', sans-serif" }}>
        Drop your<br /><span className="bg-gradient-to-r from-[#ec4899] to-[#fbbf24] bg-clip-text text-transparent">campus chaos.</span>
      </h1>
      <p className="text-[13px] text-secondary mt-3 leading-relaxed max-w-[340px]">
        Timetables, WhatsApp notices, mess menus, hostel circulars — snap it, and CampusFlow runs ahead of you.
      </p>

      {/* Drop zone */}
      <div
        className={`mt-5 border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-all duration-200 relative overflow-hidden ${
          dragActive
            ? 'border-[#ec4899] bg-pink-50 scale-[1.01]'
            : file
            ? 'border-indigo-300 bg-indigo-50/50'
            : 'border-gray-200 bg-gray-50/50 hover:border-indigo-400 hover:bg-indigo-50/30'
        }`}
        onClick={() => !loading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        {loading && (
          <div className="absolute left-0 right-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#22d3ee] to-transparent" style={{ animation: 'scanLine 2s ease-in-out infinite' }} />
        )}
        {file ? (
          <div className="space-y-1">
            <span className="text-2xl">📄</span>
            <p className="text-[13px] font-semibold text-heading">{file.name}</p>
            <p className="text-[11px] text-secondary">{(file.size / 1024).toFixed(0)} KB</p>
          </div>
        ) : (
          <div className="space-y-2">
            <span className="text-3xl">📸</span>
            <p className="text-[13px] font-semibold text-heading">Drag & drop or tap to upload</p>
            <p className="text-[11px] text-secondary">PDF · PNG · JPG</p>
          </div>
        )}
        <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
      </div>

      {/* Chips */}
      <div className="flex flex-wrap gap-2 mt-4">
        {['📅 Timetable', '💬 WhatsApp', '🍽️ Mess menu', '📢 Notices', '💼 Placements'].map((c) => (
          <span key={c} className="text-[10px] px-2.5 py-1 rounded-full bg-gray-100 text-secondary border border-gray-200">{c}</span>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={handleExtract}
        disabled={!file || loading}
        className="mt-auto py-4 w-full bg-gradient-to-r from-[#7c3aed] to-[#ec4899] text-white rounded-2xl text-[15px] font-bold shadow-lg shadow-pink-200/40 disabled:opacity-40 disabled:shadow-none transition-all hover:shadow-xl active:scale-[0.98]"
      >
        {loading ? 'Reading document...' : 'Extract with AI →'}
      </button>
    </div>
  )
}

// ─── RESULTS VIEW ────────────────────────────────────────────────────────────────

function ResultsView({ result, totalItems, saved, onSave, onReset }: {
  result: ExtractionResult; totalItems: number; saved: boolean;
  onSave: () => void; onReset: () => void
}) {
  return (
    <div className="p-5 space-y-3 animate-fade-in">
      {/* Summary */}
      <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-card animate-scale-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center border border-emerald-100">
              <span className="text-xl">✅</span>
            </div>
            <div>
              <p className="text-[14px] font-bold text-heading">{docTypeLabel(result.document_type)}</p>
              <p className="text-[12px] text-secondary">{totalItems} items • {Math.round(result.overall_confidence * 100)}% confidence</p>
            </div>
          </div>
          <ConfidenceBadge value={result.overall_confidence} />
        </div>
      </div>

      {/* Classes */}
      {result.classes.length > 0 && (
        <ResultSection title="📅 Classes" count={result.classes.length} delay={60}>
          {result.classes.map((c, i) => (
            <FieldRow key={i} confidence={c.confidence}>
              <span className="font-mono text-[11px] text-secondary w-16 shrink-0">{c.day.slice(0, 3)} {c.time}</span>
              <span className="text-[13px] text-heading font-medium flex-1 truncate">{c.subject}</span>
              <span className="text-[11px] text-secondary shrink-0">{c.location}</span>
            </FieldRow>
          ))}
        </ResultSection>
      )}

      {/* Deadlines */}
      {result.deadlines.length > 0 && (
        <ResultSection title="⏰ Deadlines" count={result.deadlines.length} delay={120}>
          {result.deadlines.map((d, i) => (
            <FieldRow key={i} confidence={d.confidence}>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-heading truncate">{d.title}</p>
                <p className="text-[11px] text-secondary mt-0.5">Due: {d.due_date} • {d.subject}</p>
              </div>
            </FieldRow>
          ))}
        </ResultSection>
      )}

      {/* Placements */}
      {result.placements.length > 0 && (
        <ResultSection title="🎯 Placements" count={result.placements.length} delay={180}>
          {result.placements.map((p, i) => (
            <FieldRow key={i} confidence={p.confidence}>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-heading">{p.company} — {p.role}</p>
                <p className="text-[11px] text-secondary mt-0.5">CTC: {p.ctc} • Test: {p.test_date}</p>
              </div>
            </FieldRow>
          ))}
        </ResultSection>
      )}

      {/* Events */}
      {result.events.length > 0 && (
        <ResultSection title="🎪 Events" count={result.events.length} delay={240}>
          {result.events.map((e, i) => (
            <FieldRow key={i} confidence={e.confidence}>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-heading">{e.name}</p>
                <p className="text-[11px] text-secondary mt-0.5">{e.venue} • {e.club}</p>
              </div>
            </FieldRow>
          ))}
        </ResultSection>
      )}

      {/* Notices */}
      {result.notices.length > 0 && (
        <ResultSection title="📢 Notices" count={result.notices.length} delay={300}>
          {result.notices.map((n, i) => (
            <FieldRow key={i} confidence={n.confidence}>
              <div className="flex-1 min-w-0">
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                  n.category === 'placement' ? 'bg-purple-50 text-purple-700' :
                  n.category === 'hostel' ? 'bg-amber-50 text-amber-700' :
                  n.category === 'event' ? 'bg-emerald-50 text-emerald-700' :
                  'bg-blue-50 text-blue-700'
                }`}>{n.category}</span>
                <p className="text-[13px] font-medium text-heading mt-1">{n.title}</p>
                <p className="text-[11px] text-secondary line-clamp-1">{n.body}</p>
              </div>
            </FieldRow>
          ))}
        </ResultSection>
      )}

      {/* Menu */}
      {result.menu_items.length > 0 && (
        <ResultSection title="🍽️ Mess Menu" count={result.menu_items.length} delay={360}>
          {result.menu_items.slice(0, 8).map((m, i) => (
            <FieldRow key={i} confidence={m.confidence}>
              <span className="text-[11px] text-secondary w-20 shrink-0 capitalize font-medium">{m.day.slice(0, 3)} {m.meal}</span>
              <span className="text-[12px] text-heading flex-1 truncate">{m.items.join(', ')}</span>
            </FieldRow>
          ))}
          {result.menu_items.length > 8 && (
            <div className="px-5 py-2.5 text-[11px] text-secondary text-center bg-surface-alt/50">
              + {result.menu_items.length - 8} more meals
            </div>
          )}
        </ResultSection>
      )}

      {/* Actions */}
      {!saved ? (
        <div className="flex gap-3 pt-2 animate-slide-up" style={{ animationDelay: '400ms' }}>
          <button onClick={onReset} className="flex-1 py-3.5 bg-white border border-border-subtle text-secondary rounded-xl text-[14px] font-medium hover:bg-surface-alt transition-colors btn-press">
            Discard
          </button>
          <button onClick={onSave} className="flex-[2] py-3.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl text-[14px] font-semibold shadow-lg shadow-green-200/50 hover:shadow-xl transition-all btn-press">
            ✓ Save to My Data
          </button>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center animate-scale-in">
          <div className="w-12 h-12 bg-white rounded-xl mx-auto flex items-center justify-center shadow-card mb-3">
            <span className="text-2xl">✅</span>
          </div>
          <p className="text-[14px] font-bold text-heading">Saved successfully!</p>
          <p className="text-[12px] text-secondary mt-1">Check your Today tab for alerts & schedule.</p>
          <button onClick={onReset} className="mt-4 px-5 py-2.5 bg-white border border-border-subtle rounded-xl text-[13px] font-medium text-heading hover:bg-surface-alt transition-colors btn-press">
            Upload another
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function docTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    timetable: 'Timetable Detected', menu: 'Mess Menu Detected',
    deadline: 'Assignment/Deadline Detected', placement: 'Placement Notice Detected',
    hostel_notice: 'Hostel Notice Detected', event: 'Event/Hackathon Detected',
    notice: 'Notice Detected', mixed: 'Mixed Document',
  }
  return labels[type] || `${type} Detected`
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = value >= 0.9 ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : value >= 0.7 ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-red-700 bg-red-50 border-red-200'
  return <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${color}`}>{pct}%</span>
}

function ResultSection({ title, count, delay, children }: { title: string; count: number; delay: number; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-border-subtle shadow-card overflow-hidden animate-slide-up" style={{ animationDelay: `${delay}ms` }}>
      <div className="px-5 py-3 bg-surface-alt/60 border-b border-border-subtle flex items-center justify-between">
        <span className="text-[12px] font-semibold text-heading">{title}</span>
        <span className="text-[10px] font-bold text-secondary bg-white px-2 py-0.5 rounded-md border border-border-subtle">{count}</span>
      </div>
      <div className="divide-y divide-border-subtle">{children}</div>
    </div>
  )
}

function FieldRow({ confidence, onConfirm, children }: { confidence: number; onConfirm?: () => void; children: React.ReactNode }) {
  const [confirmed, setConfirmed] = useState(false)
  const isLow = confidence < 0.6 && !confirmed

  const handleConfirm = () => {
    setConfirmed(true)
    if (onConfirm) onConfirm()
  }

  return (
    <div className={`px-5 py-3 flex items-center gap-2 transition-colors ${isLow ? 'bg-amber-50/40 border-l-[3px] border-l-warning' : confirmed ? 'bg-emerald-50/30 border-l-[3px] border-l-emerald-400' : ''}`}>
      {children}
      <div className="flex items-center gap-1.5 shrink-0">
        {isLow && (
          <button
            onClick={handleConfirm}
            className="text-[9px] bg-warning/20 text-amber-800 px-2 py-0.5 rounded-full font-bold hover:bg-warning/30 transition-colors btn-press"
          >
            Confirm
          </button>
        )}
        {confirmed && (
          <span className="text-[9px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
            ✓ Confirmed
          </span>
        )}
        <span className={`text-[10px] font-mono font-medium ${
          confirmed ? 'text-emerald-600' :
          confidence >= 0.9 ? 'text-emerald-600' : confidence >= 0.7 ? 'text-secondary' :
          confidence >= 0.6 ? 'text-amber-600' : 'text-red-500 font-bold'
        }`}>{confirmed ? '100%' : `${Math.round(confidence * 100)}%`}</span>
      </div>
    </div>
  )
}
