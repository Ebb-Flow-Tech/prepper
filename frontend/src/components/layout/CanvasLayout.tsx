'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { TopAppBar } from '@/components/layout/TopAppBar';
import {
  CanvasTab,
  OverviewTab,
  IngredientsTab,
  CostsTab,
  OutletsTab,
  InstructionsTab,
  TastingTab,
  VersionsTab,
} from '@/components/layout/tabs';
import { useAppState } from '@/lib/store';

function TabContent() {
  const { canvasTab } = useAppState();

  switch (canvasTab) {
    case 'canvas':
      return <CanvasTab />;
    case 'overview':
      return <OverviewTab />;
    case 'ingredients':
      return <IngredientsTab />;
    case 'costs':
      return <CostsTab />;
    case 'outlets':
      return <OutletsTab />;
    case 'instructions':
      return <InstructionsTab />;
    case 'tasting':
      return <TastingTab />;
    case 'versions':
      return <VersionsTab />;
    default:
      return <CanvasTab />;
  }
}

interface CanvasLayoutProps {
  showBackLink?: boolean;
}

export function CanvasLayout({ showBackLink = false }: CanvasLayoutProps) {
  return (
    <div className="flex h-full flex-col">
      {showBackLink && (
        <div className="shrink-0 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 px-4 py-2">
          <Link
            href="/recipes"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Recipes
          </Link>
        </div>
      )}
      <TopAppBar />
      <div className="flex flex-1 overflow-hidden">
        <TabContent />
      </div>
    </div>
  );
}
