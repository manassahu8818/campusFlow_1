/**
 * CampusFlow — Single Source of Truth Store
 * 
 * All screens read/write from HERE only.
 * Persists to localStorage, survives tab switches and refreshes.
 */

export interface ClassItem {
  day: string; time: string; subject: string;
  location?: string; professor?: string; confidence: number;
}

export interface Deadline {
  id: string; title: string; subject: string;
  due_date: string; description?: string; confidence: number;
}

export interface Notice {
  id: string; title: string; body: string;
  date?: string; category: string; confidence: number;
}

export interface MenuItem {
  meal: string; day: string; items: string[]; confidence: number;
}

export interface EventItem {
  id: string; name: string; datetime: string; venue: string;
  club: string; description?: string; confidence: number;
}

export interface PlacementItem {
  id: string; company: string; role: string; ctc: string;
  cgpa_cutoff: string; registration_deadline: string;
  test_date: string; confidence: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
}

export interface ProfileData {
  name: string;
  agentName: string;
  priorities: string[];
  placementFocus: string;
  endSemDate: string;
  focusTime: string;
  profileComplete: boolean;
  createdAt: string;
  targetCompanies?: string;
  dsaLevel?: string;
}

export interface IntentItem {
  id: string;
  text: string;
  topic: string;
  relatedTo: string;
  status: 'open' | 'done';
  steps?: string[];
  stepsCompleted?: boolean[];
  createdAt: string;
}

export interface StudentData {
  classes: ClassItem[];
  deadlines: Deadline[];
  notices: Notice[];
  menu_items: MenuItem[];
  events: EventItem[];
  placements: PlacementItem[];
  chatHistory: ChatMessage[];
  profile: ProfileData;
  intents: IntentItem[];
}

const STORAGE_KEY = 'campusflow_student_data'

const DEFAULT_PROFILE: ProfileData = {
  name: 'Aarav', agentName: 'Flow', priorities: ['Academics'], placementFocus: 'Not yet',
  endSemDate: '', focusTime: 'Flexible', profileComplete: false, createdAt: '',
}

function loadFromStorage(): StudentData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        classes: parsed.classes || [],
        deadlines: parsed.deadlines || [],
        notices: parsed.notices || [],
        menu_items: parsed.menu_items || [],
        events: parsed.events || [],
        placements: parsed.placements || [],
        chatHistory: parsed.chatHistory || [],
        profile: parsed.profile || { ...DEFAULT_PROFILE },
        intents: parsed.intents || [],
      }
    }
  } catch { /* ignore */ }
  return { classes: [], deadlines: [], notices: [], menu_items: [], events: [], placements: [], chatHistory: [], profile: { ...DEFAULT_PROFILE }, intents: [] }
}

let _data: StudentData = loadFromStorage()
let _listeners: Array<() => void> = []

function persist() {
  _data = { ..._data }  // New reference so React detects change
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_data))
  _listeners.forEach((fn) => fn())
}

// ─── READ ───────────────────────────────────────────────────────────────────

export function getStudentData(): StudentData {
  return _data
}

export function getMenuForDay(day: string): MenuItem[] {
  return _data.menu_items.filter((m) => m.day.toLowerCase() === day.toLowerCase())
}

export function getClassesForDay(day: string): ClassItem[] {
  return _data.classes
    .filter((c) => c.day.toLowerCase() === day.toLowerCase())
    .sort((a, b) => a.time.localeCompare(b.time))
}

export function getChatHistory(): ChatMessage[] {
  return _data.chatHistory
}

// ─── WRITE (with dedup) ─────────────────────────────────────────────────────

export function addClasses(classes: ClassItem[]) {
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

export function addDeadline(d: Deadline) {
  const existing = new Set(_data.deadlines.map((x) => x.id))
  if (!existing.has(d.id)) {
    _data.deadlines = [..._data.deadlines, d]
    persist()
  }
}

export function removeDeadline(id: string) {
  _data.deadlines = _data.deadlines.filter((d) => d.id !== id)
  persist()
}

export function addNotices(notices: Notice[]) {
  const existing = new Set(_data.notices.map((n) => n.id))
  const newOnes = notices.filter((n) => !existing.has(n.id))
  _data.notices = [..._data.notices, ...newOnes]
  persist()
}

export function addMenuItems(items: MenuItem[]) {
  // Replace by day+meal (new data wins)
  for (const item of items) {
    _data.menu_items = _data.menu_items.filter(
      (m) => !(m.day.toLowerCase() === item.day.toLowerCase() && m.meal.toLowerCase() === item.meal.toLowerCase())
    )
    _data.menu_items.push(item)
  }
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

export function addChatMessage(msg: ChatMessage) {
  _data.chatHistory = [..._data.chatHistory, msg]
  persist()
}

export function clearChatHistory() {
  _data.chatHistory = []
  persist()
}

export function clearAll() {
  _data = { classes: [], deadlines: [], notices: [], menu_items: [], events: [], placements: [], chatHistory: [], profile: _data.profile, intents: _data.intents }
  persist()
}

// Legacy compat exports
export function clearMenuItems() { _data.menu_items = []; persist() }
export function clearClasses() { _data.classes = []; persist() }
export function clearDeadlines() { _data.deadlines = []; persist() }
export function clearNotices() { _data.notices = []; persist() }
export function clearEvents() { _data.events = []; persist() }
export function clearPlacements() { _data.placements = []; persist() }

// ─── PROFILE ────────────────────────────────────────────────────────────────

export function getProfile(): ProfileData { return _data.profile }

export function setProfile(profile: Partial<ProfileData>) {
  _data.profile = { ..._data.profile, ...profile }
  persist()
}

export function isProfileComplete(): boolean {
  return _data.profile.profileComplete === true
}

// ─── INTENTS ────────────────────────────────────────────────────────────────

export function getOpenIntents(): IntentItem[] {
  return _data.intents.filter((i) => i.status === 'open')
}

export function getAllIntents(): IntentItem[] {
  return _data.intents
}

export function addIntent(text: string, topic: string, relatedTo: string = '') {
  const intent: IntentItem = {
    id: `intent_${Date.now()}`,
    text, topic, relatedTo,
    status: 'open',
    createdAt: new Date().toISOString(),
  }
  _data.intents = [..._data.intents, intent]
  persist()
  return intent
}

export function addIntentFull(intent: any) {
  // Add a complete intent object (with steps if present)
  const full: IntentItem = {
    id: intent.id || `intent_${Date.now()}`,
    text: intent.text || '',
    topic: intent.topic || '',
    relatedTo: intent.relatedTo || '',
    status: 'open',
    steps: intent.steps || undefined,
    stepsCompleted: intent.steps ? intent.steps.map(() => false) : undefined,
    createdAt: intent.createdAt || new Date().toISOString(),
  }
  // Dedupe by id
  const existing = new Set(_data.intents.map(i => i.id))
  if (!existing.has(full.id)) {
    _data.intents = [..._data.intents, full]
    persist()
  }
}

export function completeIntent(id: string) {
  _data.intents = _data.intents.map((i) => i.id === id ? { ...i, status: 'done' as const } : i)
  persist()
}

export function completeIntentByTopic(topic: string) {
  _data = {
    ..._data,
    intents: _data.intents.map((i) =>
      i.status === 'open' && i.topic.toLowerCase().includes(topic.toLowerCase())
        ? { ...i, status: 'done' as const } : i
    )
  }
  persist()
}

export function toggleIntentStep(intentId: string, stepIndex: number) {
  _data = {
    ..._data,
    intents: _data.intents.map((i) => {
      if (i.id !== intentId || !i.steps) return i
      const completed = i.stepsCompleted ? [...i.stepsCompleted] : i.steps.map(() => false)
      completed[stepIndex] = !completed[stepIndex]
      // If all steps done, mark the whole intent as done
      const allDone = completed.every(Boolean)
      return { ...i, stepsCompleted: completed, status: allDone ? 'done' as const : 'open' as const }
    })
  }
  persist()
}

// ─── SUBSCRIBE (for React re-renders) ───────────────────────────────────────

export function subscribe(fn: () => void) {
  _listeners.push(fn)
  return () => { _listeners = _listeners.filter((l) => l !== fn) }
}
