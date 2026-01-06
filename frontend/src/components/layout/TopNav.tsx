'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChefHat, FlaskConical, DollarSign, Package, BookOpen, Wine, Truck, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppState } from '@/lib/store';

const NAV_ITEMS = [
  { href: '/', label: 'Canvas', icon: ChefHat },
  { href: '/ingredients', label: 'Ingredients', icon: Package },
  { href: '/suppliers', label: 'Suppliers', icon: Truck },
  { href: '/recipes', label: 'Recipes', icon: BookOpen },
  { href: '/tastings', label: 'Tastings', icon: Wine },
  { href: '/rnd', label: 'R&D', icon: FlaskConical },
  { href: '/finance', label: 'Finance', icon: DollarSign },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { userId, logout } = useAppState();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <nav className="flex h-12 items-center border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 font-semibold text-lg mr-8">
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

      {/* Logout Button */}
      {userId && (
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden md:inline">Logout</span>
        </button>
      )}
    </nav>
  );
}
