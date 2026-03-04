'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  pageNumber: number;
  totalPages: number;
  totalCount: number;
  currentPageSize: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  pageNumber,
  totalPages,
  totalCount,
  currentPageSize,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const start = (pageNumber - 1) * currentPageSize + 1;
  const end = Math.min(start + currentPageSize - 1, totalCount);

  return (
    <div className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-700 px-2 py-3 text-sm">
      <span className="text-zinc-500 dark:text-zinc-400">
        {start}–{end} of {totalCount}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(pageNumber - 1)}
          disabled={pageNumber <= 1}
          className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-2 text-zinc-600 dark:text-zinc-300">
          {pageNumber} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(pageNumber + 1)}
          disabled={pageNumber >= totalPages}
          className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
