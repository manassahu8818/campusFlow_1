import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Ingest from './screens/Ingest'
import Chat from './screens/Chat'
import Today from './screens/Today'

function App() {
  return (
    <BrowserRouter>
      <div className="max-w-md mx-auto min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-indigo-50/30 shadow-2xl">
        {/* Header */}
        <header className="px-5 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIi8+PC9zdmc+')] opacity-50"></div>
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-lg">
                📚
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">CampusFlow</h1>
                <p className="text-[11px] text-indigo-200 font-medium">Runs ahead of you</p>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/upload" element={<Ingest />} />
            <Route path="/chat" element={<Chat />} />
          </Routes>
        </main>

        {/* Bottom Navigation */}
        <nav className="flex border-t border-gray-200/80 bg-white/90 backdrop-blur-lg" aria-label="Main navigation">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex-1 py-3 flex flex-col items-center gap-0.5 text-[11px] font-semibold transition-all ${
                isActive
                  ? 'text-indigo-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`text-xl ${isActive ? 'scale-110' : ''} transition-transform`}>⚡</span>
                <span>Today</span>
                {isActive && <div className="w-1 h-1 bg-indigo-600 rounded-full mt-0.5" />}
              </>
            )}
          </NavLink>
          <NavLink
            to="/upload"
            className={({ isActive }) =>
              `flex-1 py-3 flex flex-col items-center gap-0.5 text-[11px] font-semibold transition-all ${
                isActive
                  ? 'text-indigo-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`text-xl ${isActive ? 'scale-110' : ''} transition-transform`}>📷</span>
                <span>Upload</span>
                {isActive && <div className="w-1 h-1 bg-indigo-600 rounded-full mt-0.5" />}
              </>
            )}
          </NavLink>
          <NavLink
            to="/chat"
            className={({ isActive }) =>
              `flex-1 py-3 flex flex-col items-center gap-0.5 text-[11px] font-semibold transition-all ${
                isActive
                  ? 'text-indigo-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`text-xl ${isActive ? 'scale-110' : ''} transition-transform`}>💬</span>
                <span>Ask</span>
                {isActive && <div className="w-1 h-1 bg-indigo-600 rounded-full mt-0.5" />}
              </>
            )}
          </NavLink>
        </nav>
      </div>
    </BrowserRouter>
  )
}

export default App
