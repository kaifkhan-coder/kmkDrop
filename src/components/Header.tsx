import React from 'react';
import { Sun, Moon, Sparkles, ShieldCheck, User as UserIcon, LogOut, Laptop, Smartphone } from 'lucide-react';
import { ThemeMode, UserSession } from '../types';

interface HeaderProps {
  currentTab: 'send' | 'receive' | 'history' | 'security';
  onSelectTab: (tab: 'send' | 'receive' | 'history' | 'security') => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  user: UserSession | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  peersCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  theme,
  onToggleTheme,
  user,
  onOpenAuth,
  onLogout,
  peersCount,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200/80 bg-white/90 backdrop-blur-md transition-colors dark:border-neutral-800 dark:bg-neutral-950/90">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Zone 1: Single-element Brand Wordmark */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onSelectTab('send')}
            className="flex items-center gap-2.5 text-left text-lg font-bold tracking-tight text-neutral-900 transition-opacity hover:opacity-85 dark:text-white"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-950">
              <Sparkles className="h-4 w-4" />
            </span>
            <span>BeamDrop</span>
          </button>

          {/* Quiet connected peer indicator and View-Only status badge */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 pl-2">
            <span className={`h-2 w-2 rounded-full ${peersCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-300 dark:bg-neutral-700'}`} />
            <span>{peersCount > 0 ? `${peersCount} device connected` : 'Awaiting peer'}</span>
            {!user && (
              <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300 border border-amber-500/20">
                View-Only
              </span>
            )}
          </div>

        </div>

        {/* Zone 2: Clean 4 Navigation links */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => onSelectTab('send')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
              currentTab === 'send'
                ? 'text-neutral-950 dark:text-white underline decoration-neutral-950 dark:decoration-white underline-offset-8 decoration-2'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            Send Files
          </button>
          <button
            onClick={() => onSelectTab('receive')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
              currentTab === 'receive'
                ? 'text-neutral-950 dark:text-white underline decoration-neutral-950 dark:decoration-white underline-offset-8 decoration-2'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            Receive / Pair
          </button>
          <button
            onClick={() => onSelectTab('history')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
              currentTab === 'history'
                ? 'text-neutral-950 dark:text-white underline decoration-neutral-950 dark:decoration-white underline-offset-8 decoration-2'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            History
          </button>
          <button
            onClick={() => onSelectTab('security')}
            className={`hidden md:block px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
              currentTab === 'security'
                ? 'text-neutral-950 dark:text-white underline decoration-neutral-950 dark:decoration-white underline-offset-8 decoration-2'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            Security (E2EE)
          </button>
        </nav>

        {/* Zone 3: 1-2 Primary Actions */}
        <div className="flex items-center gap-2">
          {/* Theme switcher */}
          <button
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
            title={`Current theme: ${theme}. Click to switch.`}
          >
            {theme === 'light' ? (
              <Moon className="h-4 w-4" />
            ) : theme === 'dark' ? (
              <Sparkles className="h-4 w-4 text-amber-400" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </button>

          {/* User Account Button */}
          {user ? (
            <div className="flex items-center gap-1.5">
              <div
                className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs dark:border-neutral-800 dark:bg-neutral-900"
                title={`Signed in as ${user.email}`}
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-semibold text-white dark:bg-white dark:text-neutral-950">
                  {user.initials}
                </div>
                <span className="hidden sm:inline font-medium text-neutral-800 dark:text-neutral-200 truncate max-w-[120px]">
                  {user.name}
                </span>
              </div>
              <button
                onClick={onLogout}
                aria-label="Log out"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:text-rose-600 transition-colors dark:border-neutral-800 dark:text-neutral-400 dark:hover:text-rose-400"
                title="Log out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 whitespace-nowrap"
            >
              <UserIcon className="h-3.5 w-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
