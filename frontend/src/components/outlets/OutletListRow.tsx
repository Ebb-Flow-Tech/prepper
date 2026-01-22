'use client';

import Link from 'next/link';
import { Card, CardContent, Badge } from '@/components/ui';
import type { Outlet } from '@/types';

interface OutletListRowProps {
  outlet: Outlet;
  href?: string;
}

export function OutletListRow({ outlet, href }: OutletListRowProps) {
  const outletTypeVariants: Record<string, 'default' | 'secondary' | 'warning'> = {
    franchise: 'default',
    corporate: 'secondary',
    delivery: 'warning',
  };

  return (
    <Link href={href ?? `/outlets/${outlet.id}`} className="block">
      <Card interactive className="mb-2">
        <CardContent className="py-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-100 truncate hover:text-blue-600 dark:hover:text-blue-400">
                {outlet.name}
              </h3>
              {outlet.code && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {outlet.code}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              {outlet.outlet_type && (
                <Badge
                  variant={outletTypeVariants[outlet.outlet_type] || 'default'}
                  className="text-xs"
                >
                  {outlet.outlet_type.charAt(0).toUpperCase() + outlet.outlet_type.slice(1)}
                </Badge>
              )}
              {outlet.parent_outlet_id && (
                <Badge variant="secondary" className="text-xs">
                  Child outlet
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
