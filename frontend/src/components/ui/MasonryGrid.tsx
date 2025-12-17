'use client';

import Masonry from 'react-masonry-css';
import { cn } from '@/lib/utils';

interface MasonryGridProps {
  children: React.ReactNode;
  className?: string;
}

const breakpointCols = {
  default: 4,
  1280: 3,
  1024: 2,
  640: 1,
};

export function MasonryGrid({ children, className }: MasonryGridProps) {
  return (
    <Masonry
      breakpointCols={breakpointCols}
      className={cn('flex -ml-4 w-auto', className)}
      columnClassName="pl-4 bg-clip-padding"
    >
      {children}
    </Masonry>
  );
}
