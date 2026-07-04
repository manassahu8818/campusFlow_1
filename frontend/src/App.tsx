import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Ingest from './screens/Ingest'
import Chat from './screens/Chat'
import Today from './screens/Today'
import Onboarding from './screens/Onboarding'
import { isProfileComplete } from './lib/store'

function AppContent() {
  useLocation() // trigger re-render on route change
  const [showIntro, setShowIntro] = useState(true)
  const [introPhase, setIntroPhase] = useState<'words' | 'orb-center' | 'orb-dock' | 'done'>('words')
  const [showOnboarding, setShowOnboarding] = useState(!isProfileComplete())

  useEffect(() => {
    // Phase 1: words animate (0 → 2.5s)
    const t1 = setTimeout(() => setIntroPhase('orb-center'), 2500)
    // Phase 2: orb appears center (2.5s → 4s)
    const t2 = setTimeout(() => setIntroPhase('orb-dock'), 4000)
    // Phase 3: orb docks right, left panel slides in (4s → 5s)
    const t3 = setTimeout(() => setIntroPhase('done'), 5000)
    // Hide intro overlay
    const t4 = setTimeout(() => setShowIntro(false), 5200)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  }, [])

  // Show onboarding before everything else
  if (showOnboarding) {
    return <Onboarding onComplete={() => setShowOnboarding(false)} />
  }

  return (
    <div className="w-full min-h-screen bg-[#0a0a1a] relative overflow-hidden">
      {/* Background blobs — always */}
      <div className="cf-blob b1" />
      <div className="cf-blob b2" />
      <div className="cf-blob b3" />

      {/* ═══ INTRO: Word Animation ═══ */}
      {showIntro && introPhase === 'words' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-[#0a0a1a]">
          <div className="cf-wordrow">
            <span className="cf-word w1">Campus</span>
            <span className="cf-word w2">Flow</span>
          </div>
          <div className="cf-tagline">Your college life, <b>handled</b></div>
          <div className="cf-rule" />
        </div>
      )}

      {/* ═══ ORB + 3D Architecture — move together ═══ */}
      <div className={`cf-orb-group ${
        introPhase === 'orb-center' ? 'cf-orb-group-center' :
        introPhase === 'orb-dock' || introPhase === 'done' ? 'cf-orb-group-docked' :
        'cf-orb-group-hidden'
      }`}>
        {/* Orb */}
        <div className="cf-orb-inner">
          <div className="cf-ring" />
          <div className="cf-ring" style={{ animationDelay: '1s' }} />
          <div className="cf-ring" style={{ animationDelay: '2s' }} />
          <div className="cf-orbit"><i /><i /><i /></div>
          <div className="cf-core" />
          <div className="cf-child-orb cf-child-1" />
          <div className="cf-child-orb cf-child-2" />
        </div>

        {/* 3D Architecture — stays relative to orb */}
        <div className="cf-arch">
          <div className="cf-cube">
            <div className="cf-cube-face cf-cube-front" />
            <div className="cf-cube-face cf-cube-back" />
            <div className="cf-cube-face cf-cube-left" />
            <div className="cf-cube-face cf-cube-right" />
            <div className="cf-cube-face cf-cube-top" />
            <div className="cf-cube-face cf-cube-bottom" />
          </div>
          <div className="cf-cube cf-cube-sm">
            <div className="cf-cube-face cf-cube-front" />
            <div className="cf-cube-face cf-cube-back" />
            <div className="cf-cube-face cf-cube-left" />
            <div className="cf-cube-face cf-cube-right" />
            <div className="cf-cube-face cf-cube-top" />
            <div className="cf-cube-face cf-cube-bottom" />
          </div>
          <div className="cf-panel cf-panel-1" />
          <div className="cf-panel cf-panel-2" />
          <div className="cf-panel cf-panel-3" />
          <div className="cf-grid-floor" />
        </div>
      </div>

      {/* ═══ Glass sheet + strips + sparkles — appear after intro ═══ */}
      {(introPhase === 'done' || !showIntro) && (
        <>
          <div className="cf-glass-sheet">
            <div className="cf-glass-fold" />
          </div>

          {/* Dark folded strips */}
          <div className="cf-strip" />
          <div className="cf-strip cf-strip-2" />

          <span className="cf-spark" style={{ top: '25%', right: '8%' }} />
          <span className="cf-spark" style={{ bottom: '22%', right: '42%', animationDelay: '0.8s' }} />
          <span className="cf-spark" style={{ top: '60%', right: '6%', animationDelay: '1.4s' }} />
        </>
      )}

      {/* ═══ MAIN DIALOGUE BOX — slides in from left ═══ */}
      <div className={`cf-dialogue ${introPhase === 'done' || !showIntro ? 'cf-dialogue-in' : ''}`}>
        {/* Folded corner */}
        <span className="cf-fold" />

        {/* Content area */}
        <div className="cf-dialogue-content">
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/upload" element={<Ingest />} />
            <Route path="/chat" element={<Chat />} />
          </Routes>
        </div>

        {/* Nav bar inside the dialogue box, bottom-right area */}
        <nav className="cf-dialogue-nav" aria-label="Main navigation">
          <NavTab to="/" icon="⚡" label="Today" />
          <NavTab to="/upload" icon="📷" label="Upload" />
          <NavTab to="/chat" icon="💬" label="Ask" />
        </nav>
      </div>

      {/* Powered by label on the right side */}
      {(introPhase === 'done' || !showIntro) && (
        <div className="cf-powered-label">
          Powered by <b className="text-[#fbbf24]">AWS Bedrock</b> · Claude vision
        </div>
      )}
    </div>
  )
}

function NavTab({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `cf-nav-tab ${isActive ? 'cf-nav-active' : ''}`
      }
    >
      {({ isActive }) => (
        <>
          <span className={`text-[18px] transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
            {icon}
          </span>
          <span className="text-[10px] font-semibold mt-0.5">{label}</span>
          {isActive && <div className="cf-nav-indicator" />}
        </>
      )}
    </NavLink>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

export default App
