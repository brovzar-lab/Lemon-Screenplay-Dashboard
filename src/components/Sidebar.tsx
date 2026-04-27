import { NavLink } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

const links = [
  { to: '/',         label: 'Overview',          icon: '◈' },
  { to: '/slate',    label: 'Active Slate',       icon: '▦' },
  { to: '/pipeline', label: 'Pipeline',           icon: '⊞' },
  { to: '/coverage', label: 'Coverage & Scripts', icon: '⊡' },
  { to: '/market',   label: 'Market Intel',       icon: '◉' },
]

export function Sidebar() {
  const { user, signOut } = useAuthStore()

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-surface-2 border-r border-border h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-border">
        <span className="text-lemon-400 font-semibold tracking-tight text-sm">🍋 Lemon Studio</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              [
                'flex items-center gap-2.5 px-5 py-2 text-sm transition-colors',
                isActive
                  ? 'text-lemon-400 bg-lemon-500/10 font-medium'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-surface-3',
              ].join(' ')
            }
          >
            <span className="text-base leading-none">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      {user && (
        <div className="px-4 py-3 border-t border-border flex items-center gap-2.5">
          {user.photoURL && (
            <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-300 truncate">{user.displayName}</p>
          </div>
          <button
            onClick={signOut}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            title="Sign out"
          >
            ⎋
          </button>
        </div>
      )}
    </aside>
  )
}
