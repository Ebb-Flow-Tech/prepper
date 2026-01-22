'use client';

import Link from 'next/link';
import { MapPin, Phone, Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui';
import type { Supplier } from '@/types';

interface SupplierListRowProps {
  supplier: Supplier;
  href?: string;
}

export function SupplierListRow({ supplier, href }: SupplierListRowProps) {
  return (
    <Link href={href ?? `/suppliers/${supplier.id}`} className="block">
      <Card interactive className="mb-2">
        <CardContent className="py-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-100 truncate hover:text-blue-600 dark:hover:text-blue-400">
                {supplier.name}
              </h3>
              <div className="flex flex-col gap-1 mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                {supplier.address && (
                  <div className="flex items-center gap-2 truncate">
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{supplier.address}</span>
                  </div>
                )}
                {supplier.phone_number && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{supplier.phone_number}</span>
                  </div>
                )}
                {supplier.email && (
                  <div className="flex items-center gap-2 truncate">
                    <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{supplier.email}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
