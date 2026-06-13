/**
 * Simple in-memory store for extracted student data.
 * Persists to localStorage so it survives page refreshes.
 * All screens read from here.
 */

export interface ClassItem {
  day: string
  time: string
  subject: string
  location?: string
  professor?: string
  confidence: number
}

export interface Deadline {
  id: string
  title: string
  subject: string
  due_date: string
  description?: string
  confidence: number
}

export interface Notice {
  id: string
  title: string
  body: string
  date?: string
  category: string
  confidence: number
}

export interface MenuItem {
  meal: string
  day: string
  items: string[]
  confidence: number
}

export interface EventItem {
  id: string
  name: string
  datetime: string
  venue: string
  club: string
  description?: string
  confidence: number
}

export interface PlacementItem {
  id: string
  company: string
  role: string
  ctc: string
  cgpa_cutoff: string
  registration_deadline: string
  test_date: string
  confidence: number
}

export interface StudentData {
  classes: ClassItem[]
  deadlines: Deadline[]
  notices: Notice[]
  menu_items: MenuItem[]
  events: EventItem[]
  placements: PlacementItem[]
}

const STORAGE_KEY = 'campusflow_student_data'

function loadFromStorage(): StudentData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      // Ensure all arrays exist (backwards compat)
      return {
        classes: parsed.classes || [],
        deadlines: parsed.deadlines || [],
        notices: parsed.notices || [],
        menu_items: parsed.menu_items || [],
        events: parsed.events || [],
        placements: parsed.placements || [],
      }
    }
  } catch {}
  return { classes: [], deadlines: [], notices: [], menu_items: [], events: [], placements: [] }
}

let _data: StudentData = loadFromStorage()
let _listeners: Array<() => void> = []

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_data))
  _listeners.forEach((fn) => fn())
}

export function getStudentData(): StudentData {
  return _data
}

export function addClasses(classes: ClassItem[]) {
  // Deduplicate by day+time+subject
  const existing = new Set(_data.classes.map((c) => `${c.day}-${c.time}-${c.subject}`))
  const newOnes = classes.filter((c) => !existing.has(`${c.day}-${c.time}-${c.subject}`))
  _data.classes = [..._data.classes, ...newOnes]
  persist()
}

export function addDeadlines(deadlines: Deadline[]) {
  const existing = new Set(_data.deadlines.map((d) => d.id))
  const newOnes = deadlines.filter((d) => !existing.has(d.id))
  _data.deadlines = [..._data.deadlines, ...newOnes]
  persist()
}

export function addNotices(notices: Notice[]) {
  const existing = new Set(_data.notices.map((n) => n.id))
  const newOnes = notices.filter((n) => !existing.has(n.id))
  _data.notices = [..._data.notices, ...newOnes]
  persist()
}

export function addMenuItems(items: MenuItem[]) {
  // Replace by day+meal
  const newKeys = new Set(items.map((m) => `${m.day}-${m.meal}`))
  _data.menu_items = [
    ..._data.menu_items.filter((m) => !newKeys.has(`${m.day}-${m.meal}`)),
    ...items,
  ]
  persist()
}

export function addEvents(events: EventItem[]) {
  const existing = new Set(_data.events.map((e) => e.id))
  const newOnes = events.filter((e) => !existing.has(e.id))
  _data.events = [..._data.events, ...newOnes]
  persist()
}

export function addPlacements(placements: PlacementItem[]) {
  const existing = new Set(_data.placements.map((p) => p.id))
  const newOnes = placements.filter((p) => !existing.has(p.id))
  _data.placements = [..._data.placements, ...newOnes]
  persist()
}

export function clearAll() {
  _data = { classes: [], deadlines: [], notices: [], menu_items: [], events: [], placements: [] }
  persist()
}

export function subscribe(fn: () => void) {
  _listeners.push(fn)
  return () => {
    _listeners = _listeners.filter((l) => l !== fn)
  }
}
