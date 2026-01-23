'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { ChefHat, FlaskConical, DollarSign, Package, BookOpen, Wine, Truck, LogOut, Palette, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppState } from '@/lib/store';
import { logoutUser } from '@/lib/api';
import { ConfirmModal } from '@/components/ui';

const NAV_ITEMS = [
  { href: '/ingredients', label: 'Ingredients', icon: Package },
  { href: '/suppliers', label: 'Suppliers', icon: Truck },
  { href: '/recipes', label: 'Recipes', icon: BookOpen },
  { href: '/tastings', label: 'Tastings', icon: Wine },
  { href: '/recipes/new', label: 'Canvas', icon: LayoutGrid },
  { href: '/rnd', label: 'R&D', icon: FlaskConical },
  { href: '/finance', label: 'Finance', icon: DollarSign },
  { href: '/design-system', label: 'Design', icon: Palette },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { userId, username, logout, canvasHasUnsavedChanges } = useAppState();

  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingNavHref, setPendingNavHref] = useState<string | null>(null);
  const [isLogoutPending, setIsLogoutPending] = useState(false);

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
      <nav className="flex h-12 items-center border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950">
        {/* Logo */}
        <Link
          href="/recipes"
          className="flex items-center gap-2 font-semibold text-lg mr-8"
        >
          <ChefHat className="h-5 w-5" />
          <span className="hidden sm:inline">Prepper</span>
        </Link>

        {/* Navigation Links */}
        <div className="flex flex-1 items-center gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={(e) => handleNavClick(e, href)}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                    : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden md:inline">{label}</span>
              </Link>
            );
          })}
        </div>

        {/* User Info and Logout */}
        {userId && (
          <div className="flex items-center gap-3">
            {username && (
              <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                {username}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden md:inline">Logout</span>
            </button>
          </div>
        )}
      </nav>

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
