import { useState, useCallback, useRef } from 'react'
import { stubExtract, ExtractionResult } from '../lib/stubExtractor'
import { addClasses, addDeadlines, addNotices, addMenuItems, addEvents, addPlacements } from '../lib/store'

export default function Ingest() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ExtractionResult | null>(null)
  const [saved, setSaved] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((f: File) => {
    setFile(f)
    setResult(null)
    setSaved(false)
    if (f.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => setPreview(e.target?.result as string)
      reader.readAsDataURL(f)
    } else {
      setPreview(null)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const handleExtract = async () => {
    if (!file) return
    setLoading(true)
    try {
      const data = await stubExtract(file)
      setResult(data)
    } catch {
      // Shouldn't happen with stub
    } finally {
      setLoading(false)
    }
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

  const reset = () => {
    setFile(null)
    setPreview(null)
    setResult(null)
    setSaved(false)
  }

  const totalItems = result
    ? result.classes.length + result.deadlines.length + result.notices.length +
      result.menu_items.length + result.events.length + result.placements.length
    : 0

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-gray-800">Upload Document</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Snap or upload any campus document — timetable, notice, menu, assignment
        </p>
      </div>

      {/* Drop Zone */}
      {!result && (
        <div
          className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 cursor-pointer ${
            dragActive
              ? 'border-indigo-500 bg-indigo-50 scale-[1.02]'
              : file
              ? 'border-indigo-300 bg-indigo-50/50'
              : 'border-gray-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/30'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => !file && inputRef.current?.click()}
        >
          {preview ? (
            <div className="space-y-3">
              <img
                src={preview}
                alt="Preview"
                className="max-h-40 mx-auto rounded-lg shadow-md"
              />
              <p className="text-sm font-medium text-gray-700">{file?.name}</p>
              <p className="text-xs text-gray-400">{((file?.size || 0) / 1024).toFixed(0)} KB</p>
            </div>
          ) : file ? (
            <div className="space-y-2">
              <div className="w-14 h-14 bg-indigo-100 rounded-xl mx-auto flex items-center justify-center">
                <span className="text-2xl">📄</span>
              </div>
              <p className="text-sm font-medium text-gray-700">{file.name}</p>
              <p className="text-xs text-gray-400">{((file.size) / 1024).toFixed(0)} KB</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-2xl mx-auto flex items-center justify-center">
                <span className="text-3xl">📸</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700">
                  Drop your file here
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Timetable, mess menu, notice, assignment, placement circular
                </p>
              </div>
              <div className="flex items-center gap-2 justify-center text-xs text-gray-400">
                <span className="px-2 py-0.5 bg-gray-100 rounded">PDF</span>
                <span className="px-2 py-0.5 bg-gray-100 rounded">PNG</span>
                <span className="px-2 py-0.5 bg-gray-100 rounded">JPG</span>
              </div>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
            }}
          />
        </div>
      )}

      {/* Action Buttons */}
      {file && !result && !loading && (
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExtract}
            className="flex-[2] py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-200 hover:shadow-xl transition-all active:scale-[0.98]"
          >
            🔍 Extract Data
          </button>
        </div>
      )}

      {/* Choose File Button (when no file selected) */}
      {!file && !result && (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-200 hover:shadow-xl transition-all active:scale-[0.98]"
        >
          📁 Choose File
        </button>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-2xl p-6 border border-indigo-100 shadow-sm animate-slide-up">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center animate-pulse-soft">
              <span className="text-2xl">🧠</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Reading your document...</p>
              <p className="text-xs text-gray-500 mt-0.5">AI is extracting schedule, deadlines & more</p>
            </div>
          </div>
          <div className="mt-4 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full animate-pulse" style={{ width: '70%' }} />
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-3 animate-slide-up">
          {/* Summary Header */}
          <div className="bg-white rounded-2xl p-4 border border-green-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <span className="text-xl">✅</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {docTypeLabel(result.document_type)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {totalItems} item{totalItems !== 1 ? 's' : ''} extracted • {Math.round(result.overall_confidence * 100)}% confidence
                  </p>
                </div>
              </div>
              <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                result.overall_confidence >= 0.9 ? 'bg-green-100 text-green-700' :
                result.overall_confidence >= 0.7 ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }`}>
                {Math.round(result.overall_confidence * 100)}%
              </div>
            </div>
          </div>

          {/* Classes */}
          {result.classes.length > 0 && (
            <ResultSection title="📅 Classes" count={result.classes.length}>
              {result.classes.map((c, i) => (
                <FieldRow key={i} confidence={c.confidence}>
                  <span className="font-mono text-xs text-gray-500 w-16 shrink-0">{c.day.slice(0, 3)} {c.time}</span>
                  <span className="text-sm text-gray-800 font-medium flex-1">{c.subject}</span>
                  <span className="text-xs text-gray-400">{c.location}</span>
                </FieldRow>
              ))}
            </ResultSection>
          )}

          {/* Deadlines */}
          {result.deadlines.length > 0 && (
            <ResultSection title="⏰ Deadlines" count={result.deadlines.length}>
              {result.deadlines.map((d, i) => (
                <FieldRow key={i} confidence={d.confidence}>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{d.title}</p>
                    <p className="text-xs text-gray-500">Due: {d.due_date} • {d.subject}</p>
                    {d.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{d.description}</p>}
                  </div>
                </FieldRow>
              ))}
            </ResultSection>
          )}

          {/* Placements */}
          {result.placements.length > 0 && (
            <ResultSection title="🎯 Placement Drives" count={result.placements.length}>
              {result.placements.map((p, i) => (
                <FieldRow key={i} confidence={p.confidence}>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{p.company} — {p.role}</p>
                    <p className="text-xs text-gray-500">CTC: {p.ctc} • CGPA: {p.cgpa_cutoff}+</p>
                    <p className="text-xs text-gray-400">Register by {p.registration_deadline} • Test: {p.test_date}</p>
                  </div>
                </FieldRow>
              ))}
            </ResultSection>
          )}

          {/* Events */}
          {result.events.length > 0 && (
            <ResultSection title="🎪 Events" count={result.events.length}>
              {result.events.map((e, i) => (
                <FieldRow key={i} confidence={e.confidence}>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{e.name}</p>
                    <p className="text-xs text-gray-500">{e.venue} • {e.club}</p>
                    <p className="text-xs text-gray-400">{new Date(e.datetime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </FieldRow>
              ))}
            </ResultSection>
          )}

          {/* Notices */}
          {result.notices.length > 0 && (
            <ResultSection title="📢 Notices" count={result.notices.length}>
              {result.notices.map((n, i) => (
                <FieldRow key={i} confidence={n.confidence}>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        n.category === 'placement' ? 'bg-purple-100 text-purple-700' :
                        n.category === 'academic' ? 'bg-blue-100 text-blue-700' :
                        n.category === 'hostel' ? 'bg-amber-100 text-amber-700' :
                        n.category === 'event' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{n.category}</span>
                      {n.date && <span className="text-[10px] text-gray-400">{n.date}</span>}
                    </div>
                    <p className="text-sm font-medium text-gray-800 mt-1">{n.title}</p>
                    <p className="text-xs text-gray-500 line-clamp-2">{n.body}</p>
                  </div>
                </FieldRow>
              ))}
            </ResultSection>
          )}

          {/* Menu Items */}
          {result.menu_items.length > 0 && (
            <ResultSection title="🍽️ Mess Menu" count={result.menu_items.length}>
              {result.menu_items.slice(0, 8).map((m, i) => (
                <FieldRow key={i} confidence={m.confidence}>
                  <span className="text-xs text-gray-500 w-24 shrink-0 capitalize font-medium">{m.day.slice(0, 3)} {m.meal}</span>
                  <span className="text-sm text-gray-700 flex-1">{m.items.join(', ')}</span>
                </FieldRow>
              ))}
              {result.menu_items.length > 8 && (
                <div className="px-4 py-2 text-xs text-gray-400 text-center">
                  + {result.menu_items.length - 8} more meals
                </div>
              )}
            </ResultSection>
          )}

          {/* Save / Done buttons */}
          {!saved ? (
            <div className="flex gap-2 pt-2">
              <button
                onClick={reset}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                className="flex-[2] py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-green-200 hover:shadow-xl transition-all active:scale-[0.98]"
              >
                ✓ Save to My Data
              </button>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center animate-slide-up">
              <p className="text-sm font-semibold text-green-800">✅ Saved! Check your Today tab.</p>
              <button
                onClick={reset}
                className="mt-3 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Upload another
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function docTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    timetable: '📅 Timetable Detected',
    menu: '🍽️ Mess Menu Detected',
    deadline: '⏰ Assignment/Deadline Detected',
    placement: '🎯 Placement Notice Detected',
    hostel_notice: '🏠 Hostel Notice Detected',
    event: '🎪 Event/Hackathon Detected',
    notice: '📢 Notice Detected',
    mixed: '📋 Mixed Document',
  }
  return labels[type] || `📋 ${type} Detected`
}

function ResultSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700">{title}</span>
        <span className="text-[10px] font-bold text-gray-400 bg-gray-200/60 px-1.5 py-0.5 rounded">{count}</span>
      </div>
      <div className="divide-y divide-gray-50">
        {children}
      </div>
    </div>
  )
}

function FieldRow({ confidence, children }: { confidence: number; children: React.ReactNode }) {
  const isLow = confidence < 0.6
  return (
    <div className={`px-4 py-2.5 flex items-center gap-2 ${isLow ? 'bg-amber-50/60 border-l-2 border-l-amber-400' : ''}`}>
      {children}
      <div className="flex items-center gap-1 shrink-0">
        {isLow && (
          <button className="text-[9px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full font-bold hover:bg-amber-300 transition-colors">
            Confirm
          </button>
        )}
        <span className={`text-[10px] font-mono ${
          confidence >= 0.9 ? 'text-green-600' :
          confidence >= 0.7 ? 'text-gray-400' :
          confidence >= 0.6 ? 'text-amber-500' :
          'text-red-500 font-bold'
        }`}>
          {Math.round(confidence * 100)}%
        </span>
      </div>
    </div>
  )
}
