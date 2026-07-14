'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      // Beige shimmer at content shape (§12.8). The global reduced-motion rule
      // neutralises the pulse.
      className={cn(
        'animate-pulse rounded-lg bg-muted',
        className
      )}
    />
  );
}
