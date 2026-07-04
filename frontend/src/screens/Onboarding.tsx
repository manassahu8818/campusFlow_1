import { useState } from 'react'
import { setProfile, addIntent } from '../lib/store'

interface Props {
  onComplete: () => void
}

export default function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('Aarav')
  const [agentName, setAgentName] = useState('Flow')
  const [priorities, setPriorities] = useState<string[]>([])
  const [placementFocus, setPlacementFocus] = useState('')
  const [endSemDate, setEndSemDate] = useState('')
  const [focusTime, setFocusTime] = useState('')
  const [intentText, setIntentText] = useState('')

  const priorityOptions = ['Academics', 'Placements', 'Fitness/Health', 'Clubs & Events', 'Personal projects']
  const placementOptions = ['Yes, actively', 'Soon', 'Not yet']
  const focusOptions = ['Morning person', 'Night owl', 'Flexible']

  const togglePriority = (p: string) => {
    setPriorities((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])
  }

  const finish = () => {
    setProfile({
      name: name || 'Aarav',
      agentName: agentName || 'Flow',
      priorities: priorities.length ? priorities : ['Academics'],
      placementFocus: placementFocus || 'Not yet',
      endSemDate,
      focusTime: focusTime || 'Flexible',
      profileComplete: true,
      createdAt: new Date().toISOString(),
    })
    // Seed intent from Q6 if provided
    if (intentText.trim()) {
      addIntent(intentText.trim(), intentText.trim().split(' ').slice(0, 3).join(' '), '')
    }
    onComplete()
  }

  const next = () => setStep((s) => s + 1)

  const steps = [
    // Step 0: Name
    <div key="name" className="space-y-4">
      <h2 className="text-xl font-bold text-gray-800">What's your name?</h2>
      <input
        type="text" value={name} onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-base focus:outline-none focus:border-indigo-400"
      />
      <button onClick={next} className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl font-semibold">
        Next →
      </button>
    </div>,

    // Step 1: Agent name
    <div key="agentname" className="space-y-4">
      <h2 className="text-xl font-bold text-gray-800">Name your assistant</h2>
      <p className="text-sm text-gray-500">Give me a name — I'll use it in all my messages to you</p>
      <input
        type="text" value={agentName} onChange={(e) => setAgentName(e.target.value)}
        placeholder="Flow"
        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-base focus:outline-none focus:border-indigo-400"
      />
      <button onClick={next} className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl font-semibold">
        Next →
      </button>
    </div>,

    // Step 1: Priorities
    <div key="priorities" className="space-y-4">
      <h2 className="text-xl font-bold text-gray-800">What are you focused on?</h2>
      <p className="text-sm text-gray-500">Select all that apply</p>
      <div className="flex flex-wrap gap-2">
        {priorityOptions.map((p) => (
          <button key={p} onClick={() => togglePriority(p)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              priorities.includes(p) ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}>
            {p}
          </button>
        ))}
      </div>
      <button onClick={next} className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl font-semibold">
        Next →
      </button>
    </div>,

    // Step 2: Placement focus
    <div key="placement" className="space-y-4">
      <h2 className="text-xl font-bold text-gray-800">Preparing for placements?</h2>
      <div className="space-y-2">
        {placementOptions.map((o) => (
          <button key={o} onClick={() => { setPlacementFocus(o); next() }}
            className={`w-full px-4 py-3 rounded-xl text-left text-sm font-medium transition-all border ${
              placementFocus === o ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:border-indigo-300'
            }`}>
            {o}
          </button>
        ))}
      </div>
    </div>,

    // Step 3: End-sem date
    <div key="endsem" className="space-y-4">
      <h2 className="text-xl font-bold text-gray-800">When are your end-sems?</h2>
      <input
        type="date" value={endSemDate} onChange={(e) => setEndSemDate(e.target.value)}
        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-base focus:outline-none focus:border-indigo-400"
      />
      <button onClick={next} className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl font-semibold">
        {endSemDate ? 'Next →' : 'Skip'}
      </button>
    </div>,

    // Step 4: Focus time
    <div key="focus" className="space-y-4">
      <h2 className="text-xl font-bold text-gray-800">When do you focus best?</h2>
      <div className="space-y-2">
        {focusOptions.map((o) => (
          <button key={o} onClick={() => { setFocusTime(o); next() }}
            className={`w-full px-4 py-3 rounded-xl text-left text-sm font-medium transition-all border ${
              focusTime === o ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:border-indigo-300'
            }`}>
            {o}
          </button>
        ))}
      </div>
    </div>,

    // Step 5: Free text intent
    <div key="intent" className="space-y-4">
      <h2 className="text-xl font-bold text-gray-800">Anything you want to stay on top of?</h2>
      <p className="text-sm text-gray-500">E.g. "solve PYQs before end-sems", "gym 3x a week"</p>
      <input
        type="text" value={intentText} onChange={(e) => setIntentText(e.target.value)}
        placeholder="I want to..."
        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-base focus:outline-none focus:border-indigo-400"
      />
      <button onClick={finish} className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl font-semibold">
        {intentText ? "Let's go! 🚀" : 'Skip & Start'}
      </button>
    </div>,
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Progress */}
        <div className="flex gap-1 mb-8">
          {steps.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= step ? 'bg-indigo-500' : 'bg-gray-200'}`} />
          ))}
        </div>

        {/* Logo */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white text-sm">📚</div>
          <span className="font-bold text-gray-800">CampusFlow</span>
        </div>

        {/* Current step */}
        <div className="animate-fade-in">
          {steps[step]}
        </div>
      </div>
    </div>
  )
}
