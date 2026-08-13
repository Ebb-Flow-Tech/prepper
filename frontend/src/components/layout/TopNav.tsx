'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { FlaskConical, DollarSign, Package, BookOpen, UtensilsCrossed, Settings, LogOut, LucideIcon, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppState } from '@/lib/store';
import { OrgSwitcher } from './OrgSwitcher';
import { performSignOut } from '@/lib/auth/signOut';
import { ConfirmModal } from '@/components/ui';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/menu',        label: 'Menu',        icon: UtensilsCrossed },
  { href: '/recipes',     label: 'Dishes',      icon: BookOpen },
  { href: '/ingredients', label: 'Ingredients', icon: Package },
  { href: '/rnd',         label: 'R&D',         icon: FlaskConical },
  { href: '/finance',     label: 'Reports',     icon: DollarSign },
  { href: '/settings',    label: 'Settings',    icon: Settings },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { userId, username, canvasHasUnsavedChanges } = useAppState();

  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingNavHref, setPendingNavHref] = useState<string | null>(null);
  const [isLogoutPending, setIsLogoutPending] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Close mobile menu when pathname changes
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    // Only show warning when leaving the canvas page (/) with unsaved changes
    if (pathname === '/' && href !== '/' && canvasHasUnsavedChanges) {
      e.preventDefault();
      setPendingNavHref(href);
      setIsLogoutPending(false);
      setShowUnsavedModal(true);
    }
  };

  /**
   * One sign-out sequence, shared with the forced path in `api.ts`: `performSignOut()` tears down
   * the Supabase session and the provider cookie too, which a bare local-state clear would leave
   * live for the next page load to re-hydrate from.
   *
   * The exit is a real navigation, NOT `router.push`. `AppProvider` subscribes to whichever client
   * the provider cookie named at hydration and never re-subscribes; a client-side push keeps that
   * mount alive, so signing out of a Passport session and then signing in app-native would leave
   * the store listening to the wrong project — no SIGNED_IN arrives and the user bounces back to
   * /login on a live session. A full load rebuilds the subscription against the cleared cookie.
   */
  const signOutAndReload = async () => {
    try {
      await performSignOut();
    } finally {
      // Navigate even if teardown rejected. `performSignOut` swallows the backend logout and the
      // Supabase sign-out, but its own cookie clear and state reset are not caught — and a
      // rejection there would otherwise strand the user on a half-torn-down page with no way out.
      window.location.assign('/login');
    }
  };

  const handleLogout = async () => {
    // Check for unsaved changes before logout if on canvas page
    if (pathname === '/' && canvasHasUnsavedChanges) {
      setPendingNavHref(null);
      setIsLogoutPending(true);
      setShowUnsavedModal(true);
      return;
    }

    await signOutAndReload();
  };

  const handleConfirmLeave = async () => {
    setShowUnsavedModal(false);
    if (isLogoutPending) {
      await signOutAndReload();
      return;
    }
    if (pendingNavHref) {
      router.push(pendingNavHref);
    }
    setPendingNavHref(null);
    setIsLogoutPending(false);
  };

  const handleCancelLeave = () => {
    setShowUnsavedModal(false);
    setPendingNavHref(null);
    setIsLogoutPending(false);
  };

  return (
    <>
      <nav className="relative flex h-16 items-center border-b border-border bg-card px-4">
        {/* Logo */}
        <Link
          href="/recipes"
          className="flex items-center mr-4 md:mr-8"
        >
          <Image
            src="/logo/Reciperep logo inline 840x180.png"
            alt="Reciperep"
            width={140}
            height={30}
            className="h-7 w-auto dark:hidden"
            priority
          />
          <Image
            src="/logo/Reciperep logo inline light 840x180.png"
            alt="Reciperep"
            width={140}
            height={30}
            className="h-7 w-auto hidden dark:block"
            priority
          />
        </Link>

        {/* Only show navigation and menus when logged in */}
        {userId && (
          <>
            {/* Mobile Hamburger */}
            <div className="flex flex-1 md:hidden justify-end items-center">
              <button
                onClick={() => setIsMenuOpen((v) => !v)}
                className="rounded-md p-2 text-muted-foreground hover:bg-secondary"
              >
                {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>

            {/* Navigation Links */}
            <div className="hidden md:flex flex-1 items-center gap-1">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                const isActive = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
                return (
                  <div key={href} className="group relative">
                    <Link
                      href={href}
                      onClick={(e) => handleNavClick(e, href)}
                      className={cn(
                        'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-secondary text-foreground'
                          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden xl:inline">{label}</span>
                    </Link>
                    {/* Tooltip: visible only at md-2xl (when labels are hidden) */}
                    <div className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 hidden md:block xl:hidden rounded-md bg-popover px-2 py-1 text-xs font-medium text-popover-foreground opacity-0 transition-opacity group-hover:opacity-100 whitespace-nowrap z-50">
                      {label}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* User Info and Logout (Desktop) */}
            <div className="hidden md:flex items-center gap-3">
              {/* The org everything on screen belongs to. Static with one org, a picker with more. */}
              <OrgSwitcher />
              {username && (
                <span className="hidden md:inline text-sm font-medium text-muted-foreground">
                  {username}
                </span>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden md:inline">Logout</span>
              </button>
            </div>
          </>
        )}
      </nav>

      {/* Mobile Dropdown Menu */}
      {userId && isMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 md:hidden"
            onClick={() => setIsMenuOpen(false)}
          />
          {/* Menu */}
          <div className="absolute top-16 left-0 right-0 z-50 border-b border-border bg-card shadow-lg md:hidden">
            <div className="flex flex-col py-2 px-2">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                const isActive = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={(e) => {
                      setIsMenuOpen(false);
                      handleNavClick(e, href);
                    }}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-secondary text-foreground'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </Link>
                );
              })}
              <div className="my-2 border-t border-border" />
              {username && (
                <div className="px-3 py-2 text-sm font-medium text-muted-foreground">
                  {username}
                </div>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </>
      )}

      <ConfirmModal
        isOpen={showUnsavedModal}
        onClose={handleCancelLeave}
        onConfirm={handleConfirmLeave}
        title="Unsaved Changes"
        message="You have unsaved changes. If you leave now, your work will be lost."
        confirmLabel="Leave"
        cancelLabel="Stay"
        variant="destructive"
      />
    </>
  );
}
