'use client';

import { useEffect } from 'react';
import { CanvasLayout } from '@/components/layout';
import { useAppState } from '@/lib/store';

export default function CanvasPage() {
  const { selectRecipe } = useAppState();

  // Clear recipe for new recipe creation
  useEffect(() => {
    selectRecipe(null);
  }, [selectRecipe]);

  return <CanvasLayout showBackLink={true} />;
}
