'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSupplierIngredientsPaginated } from '@/lib/hooks';
import { useDebouncedValue } from '@/lib/hooks';
import { SearchInput, Skeleton } from '@/components/ui';
import { Pagination } from '@/components/ui/Pagination';
import { TagsCell } from './TagsCell';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
    minimumFractionDigits: 2,
  }).format(value);
}

export function ProductsTab() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data, isLoading } = useSupplierIngredientsPaginated({
    page_number: page,
    page_size: 20,
    search: debouncedSearch,
  });

  const items = data?.items ?? [];

  return (
    <div className="h-full w-full overflow-auto">
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6 max-w-md">
          <SearchInput
            placeholder="Search by product name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
          />
        </div>

        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary border-b border-border">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Product name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">SKU</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Supplier</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tags</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Unit</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Price / pack</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              )}

              {!isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    {debouncedSearch ? 'No products match your search' : 'No products yet'}
                  </td>
                </tr>
              )}

              {!isLoading && items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-border hover:bg-secondary transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/ingredients/${item.ingredient_id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {item.ingredient_name ?? '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {item.category_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {item.sku ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/suppliers/${item.supplier_id}`}
                      className="text-muted-foreground hover:underline"
                    >
                      {item.supplier_name ?? '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <TagsCell siId={item.id} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {item.unit}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-foreground tabular-nums">
                    {formatCurrency(item.price_per_pack)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data && (
          <div className="mt-4">
            <Pagination
              pageNumber={data.page_number}
              totalPages={data.total_pages}
              totalCount={data.total_count}
              currentPageSize={data.current_page_size}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
