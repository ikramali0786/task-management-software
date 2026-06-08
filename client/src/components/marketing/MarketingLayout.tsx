import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Zap, Menu, X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/features', label: 'Features' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/help', label: 'Help' },
  { to: '/contact', label: 'Contact' },
];

const MarketingHeader = () => {
  const { isAuthenticated, user } = useAuthStore();
  const loggedIn = isAuthenticated && user;
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-[#faf8f4]/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl gradient-brand">
            <Zap className="h-4 w-4 text-white" />
          </span>
          <span className="text-lg font-bold gradient-text">TaskFlow</span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cn(
                  'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'text-brand-600 dark:text-brand-400'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          {loggedIn ? (
            <Link to="/app" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100">
              Go to app
            </Link>
          ) : (
            <>
              <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
                Log in
              </Link>
              <Link to="/register" className="rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-ember transition-transform hover:-translate-y-0.5" style={{ background: 'linear-gradient(135deg,#e8502e 0%,#f97316 55%,#fb923c 100%)' }}>
                Get started
              </Link>
            </>
          )}
        </div>

        <button className="ml-auto rounded-lg p-2 text-slate-600 md:hidden dark:text-slate-300" onClick={() => setOpen((v) => !v)} aria-label="Menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-slate-200 bg-[#faf8f4] px-5 py-3 md:hidden dark:border-slate-800 dark:bg-slate-950">
          <nav className="flex flex-col gap-1">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                {n.label}
              </Link>
            ))}
            <div className="mt-2 flex gap-2">
              {loggedIn ? (
                <Link to="/app" onClick={() => setOpen(false)} className="flex-1 rounded-xl bg-slate-900 px-4 py-2 text-center text-sm font-semibold text-white dark:bg-white dark:text-slate-900">Go to app</Link>
              ) : (
                <>
                  <Link to="/login" onClick={() => setOpen(false)} className="flex-1 rounded-xl border border-slate-300 px-4 py-2 text-center text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Log in</Link>
                  <Link to="/register" onClick={() => setOpen(false)} className="flex-1 rounded-xl px-4 py-2 text-center text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg,#e8502e,#f97316 55%,#fb923c)' }}>Get started</Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

const FOOTER = [
  { heading: 'Product', links: [['Features', '/features'], ['Pricing', '/pricing'], ['Log in', '/login'], ['Get started', '/register']] },
  { heading: 'Support', links: [['Help center', '/help'], ['Contact us', '/contact'], ['System status', '/status']] },
  { heading: 'Legal', links: [['Privacy', '/privacy']] },
];

const MarketingFooter = () => (
  <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
    <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-5 py-12 sm:grid-cols-4">
      <div className="col-span-2 sm:col-span-1">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl gradient-brand">
            <Zap className="h-4 w-4 text-white" />
          </span>
          <span className="text-lg font-bold gradient-text">TaskFlow</span>
        </Link>
        <p className="mt-3 max-w-xs text-sm text-slate-500 dark:text-slate-400">
          The task & project workspace for teams that move fast.
        </p>
      </div>
      {FOOTER.map((col) => (
        <div key={col.heading}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{col.heading}</p>
          <ul className="space-y-2">
            {col.links.map(([label, to]) => (
              <li key={label}>
                <Link to={to} className="text-sm text-slate-600 transition-colors hover:text-brand-600 dark:text-slate-300 dark:hover:text-brand-400">{label}</Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
    <div className="border-t border-slate-100 dark:border-slate-800/60">
      <div className="mx-auto max-w-6xl px-5 py-5 text-xs text-slate-400">
        © {new Date().getFullYear()} TaskFlow. All rights reserved.
      </div>
    </div>
  </footer>
);

export const MarketingLayout = () => (
  <div className="min-h-screen bg-[#faf8f4] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <MarketingHeader />
    <main>
      <Outlet />
    </main>
    <MarketingFooter />
  </div>
);
