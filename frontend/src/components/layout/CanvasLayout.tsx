'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { TopAppBar } from '@/components/layout/TopAppBar';
import {
  CanvasTab,
  OverviewTab,
  IngredientsTab,
  CostsTab,
  UnitsTab,
  InstructionsTab,
  TastingTab,
  VersionsTab,
} from '@/components/layout/tabs';
import { useAppState } from '@/lib/store';

function TabContent() {
  const { canvasTab } = useAppState();

  switch (canvasTab) {
    case 'overview':
      return <OverviewTab />;
    case 'ingredients':
      return <IngredientsTab />;
    case 'costs':
      return <CostsTab />;
    case 'units':
      return <UnitsTab />;
    case 'instructions':
      return <InstructionsTab />;
    case 'tasting':
      return <TastingTab />;
    case 'versions':
      return <VersionsTab />;
    case 'canvas':
    default:
      return <CanvasTab />;
  }
}

interface CanvasLayoutProps {
  showBackLink?: boolean;
  showTabs?: boolean;
}

export function CanvasLayout({ showBackLink = false, showTabs = true }: CanvasLayoutProps) {
  return (
    <div className="flex h-full flex-col">
      {showBackLink && (
        <div className="shrink-0 border-b border-border/60 bg-background px-4 py-1.5">
          <Link
            href="/recipes"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Recipes
          </Link>
        </div>
      )}
      {showTabs && <TopAppBar />}
      <div className="flex flex-1 overflow-hidden">
        <TabContent />
      </div>
    </div>
  );
}
