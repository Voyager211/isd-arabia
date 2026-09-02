import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import {
  Boxes,
  ChevronLeft,
  FileText,
  FolderTree,
  Gauge,
  LogOut,
  Menu,
  Factory,
  Tags,
  BookOpen,
} from 'lucide-react';

import { useAuth } from '@/context/auth-context';

/**
 * Admin shell (PROJECT_PLAN.md §11.1).
 *
 * Fixed sidebar collapsible to icons, top bar with the page title and a
 * profile menu. Below `md` the sidebar becomes an overlay — the client will
 * check quotations from a phone even though the catalogue work happens on a
 * desktop.
 */

const NAV = [
  { to: '/', label: 'Dashboard', icon: Gauge, end: true },
  { to: '/categories', label: 'Categories', icon: FolderTree },
  { to: '/brands', label: 'Brands', icon: Tags },
  { to: '/industries', label: 'Industries', icon: Factory },
  { to: '/products', label: 'Products', icon: Boxes },
  { to: '/quotations', label: 'Quotations', icon: FileText },
  { to: '/catalogue', label: 'Catalogue', icon: BookOpen },
] as const;

export function AppShell() {
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="flex min-h-dvh">
      <aside
        className={`fixed inset-y-0 start-0 z-50 flex flex-col border-e border-border-subtle bg-surface-inverse text-text-on-inverse transition-[width,transform] duration-200 md:sticky md:top-0 md:h-dvh md:translate-x-0 ${
          isCollapsed ? 'w-16' : 'w-60'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-white/10 px-4">
          {!isCollapsed ? <span className="font-display text-h3 font-bold">ISD Admin</span> : null}
          <button
            type="button"
            onClick={() => setIsCollapsed((value) => !value)}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="ms-auto hidden rounded p-1.5 text-white/70 hover:bg-white/10 hover:text-white md:block"
          >
            <ChevronLeft
              aria-hidden
              className={`size-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        <nav aria-label="Admin sections" className="flex-1 overflow-y-auto p-2">
          <ul className="space-y-0.5">
            {NAV.map(({ to, label, icon: Icon, ...rest }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={'end' in rest ? rest.end : undefined}
                  onClick={() => setIsMobileOpen(false)}
                  title={isCollapsed ? label : undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 text-body-sm font-medium transition-colors ${
                      isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10'
                    }`
                  }
                >
                  <Icon aria-hidden className="size-4 shrink-0" />
                  {!isCollapsed ? label : <span className="sr-only">{label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-white/10 p-2">
          <button
            type="button"
            onClick={() => void logout()}
            className="flex w-full items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 text-body-sm font-medium text-white/70 hover:bg-white/10"
          >
            <LogOut aria-hidden className="size-4 shrink-0" />
            {!isCollapsed ? 'Sign out' : <span className="sr-only">Sign out</span>}
          </button>
        </div>
      </aside>

      {isMobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border-subtle bg-surface-page px-4">
          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            aria-label="Open navigation"
            className="-ms-2 rounded p-2 md:hidden"
          >
            <Menu aria-hidden className="size-5" />
          </button>

          <div className="ms-auto flex items-center gap-3">
            <div className="text-end">
              <p className="text-body-sm font-semibold text-text-primary">{user?.name}</p>
              <p className="text-caption text-text-secondary">
                {user?.role === 'super_admin' ? 'Super admin' : 'Admin'}
              </p>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
