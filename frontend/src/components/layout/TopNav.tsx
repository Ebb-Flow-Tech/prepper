'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { FlaskConical, DollarSign, Package, BookOpen, Wine, Palette, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: 'Canvas', icon: LayoutGrid },
  { href: '/ingredients', label: 'Ingredients', icon: Package },
  { href: '/recipes', label: 'Recipes', icon: BookOpen },
  { href: '/tastings', label: 'Tastings', icon: Wine },
  { href: '/rnd', label: 'R&D', icon: FlaskConical },
  { href: '/finance', label: 'Finance', icon: DollarSign },
  { href: '/design-system', label: 'Design', icon: Palette },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="flex h-12 items-center border-b border-border bg-card px-4">
      {/* Logo */}
      <Link href="/" className="flex items-center mr-8">
        <Image
          src="/logo/reciperep-logo_inline-960x180.png"
          alt="RecipeRep"
          width={120}
          height={22}
          className="h-6 w-auto"
          priority
        />
      </Link>

      {/* Navigation Links */}
      <div className="flex items-center gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden md:inline">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
