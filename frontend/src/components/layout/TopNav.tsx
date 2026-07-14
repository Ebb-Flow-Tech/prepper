'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { FlaskConical, DollarSign, Package, BookOpen, UtensilsCrossed, Settings, LogOut, LucideIcon, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppState } from '@/lib/store';
import { logoutUser } from '@/lib/api';
import { ConfirmModal } from '@/components/ui';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
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
  const { userId, username, userType, logout, canvasHasUnsavedChanges } = useAppState();

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

  const handleLogout = async () => {
    // Check for unsaved changes before logout if on canvas page
    if (pathname === '/' && canvasHasUnsavedChanges) {
      setPendingNavHref(null);
      setIsLogoutPending(true);
      setShowUnsavedModal(true);
      return;
    }

    // Call backend logout endpoint
    try {
      await logoutUser();
    } catch (error) {
      console.error('Logout error:', error);
      // Continue with local logout even if backend call fails
    }

    logout();
    router.push('/login');
  };

  const handleConfirmLeave = async () => {
    setShowUnsavedModal(false);
    if (isLogoutPending) {
      // Call backend logout endpoint
      try {
        await logoutUser();
      } catch (error) {
        console.error('Logout error:', error);
        // Continue with local logout even if backend call fails
      }
      logout();
      router.push('/login');
    } else if (pendingNavHref) {
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
          className="flex items-center mr-4 md:mr-8 rounded-lg"
        >
          <Image
            src="/logo/Reciperep logo inline 840x180.png"
            alt="Reciperep"
            width={140}
            height={30}
            className="h-7 w-auto"
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
                aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={isMenuOpen}
                className="rounded-lg p-2 text-muted-foreground transition-colors duration-[120ms] hover:bg-accent hover:text-foreground"
              >
                {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>

            {/* Navigation Links */}
            <div className="hidden md:flex flex-1 items-center gap-1">
              {NAV_ITEMS.filter((item) => {
                if (item.adminOnly && userType !== 'admin') return false;
                return true;
              }).map(({ href, label, icon: Icon }) => {
                const isActive = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
                return (
                  <div key={href} className="group relative">
                    <Link
                      href={href}
                      onClick={(e) => handleNavClick(e, href)}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        // 8px hit area; active carries --surface-selected + weight 500 (§7.2).
                        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors duration-[120ms]',
                        isActive
                          ? 'bg-background-contrast font-medium text-foreground'
                          : 'font-normal text-muted-foreground hover:bg-accent hover:text-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden xl:inline">{label}</span>
                    </Link>
                    {/* Tooltip: visible only at md-2xl (when labels are hidden). §12.7 —
                        dark warm fill, white 12px text, 6px radius. */}
                    <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--surface-tooltip)] px-2 py-1 text-xs font-normal text-[var(--color-text-inverse)] opacity-0 transition-opacity duration-150 group-hover:opacity-100 md:block xl:hidden">
                      {label}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* User Info and Logout (Desktop) */}
            <div className="hidden md:flex items-center gap-3">
              {username && (
                <div className="flex items-center gap-2">
                  {/* Avatar is sanctioned brand chrome — one of the accent's four
                      named roles (§4). */}
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-medium uppercase text-primary-foreground"
                  >
                    {username.charAt(0)}
                  </span>
                  <span className="hidden text-sm text-muted-foreground md:inline">
                    {username}
                  </span>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors duration-[120ms] hover:bg-accent hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden md:inline">Log out</span>
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
          <div className="absolute top-16 left-0 right-0 z-50 border-b border-border bg-popover shadow-elevation-2 md:hidden">
            <div className="flex flex-col py-2 px-2">
              {NAV_ITEMS.filter((item) => {
                if (item.adminOnly && userType !== 'admin') return false;
                return true;
              }).map(({ href, label, icon: Icon }) => {
                const isActive = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={(e) => {
                      setIsMenuOpen(false);
                      handleNavClick(e, href);
                    }}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      // ≥44px touch target (§6.2, §15).
                      'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-[120ms]',
                      isActive
                        ? 'bg-background-contrast font-medium text-foreground'
                        : 'font-normal text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </Link>
                );
              })}
              <div className="my-2 border-t border-border" />
              {username && (
                <div className="flex items-center gap-2 px-3 py-2">
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-medium uppercase text-primary-foreground"
                  >
                    {username.charAt(0)}
                  </span>
                  <span className="text-sm text-muted-foreground">{username}</span>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors duration-[120ms] hover:bg-accent hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                <span>Log out</span>
              </button>
            </div>
          </div>
        </>
      )}

      <ConfirmModal
        isOpen={showUnsavedModal}
        onClose={handleCancelLeave}
        onConfirm={handleConfirmLeave}
        title="Unsaved changes"
        message="You have unsaved changes. If you leave now, your work will be lost."
        confirmLabel="Leave"
        cancelLabel="Stay"
        variant="destructive"
      />
    </>
  );
}
