'use client';

import { useState, useEffect, useCallback } from 'react';
import { Wand2 } from 'lucide-react';
import { useAppState } from '@/lib/store';
import {
  useUpdateRecipe,
  useParseInstructions,
  useUpdateStructuredInstructions,
} from '@/lib/hooks';
import { InstructionsSteps } from './InstructionsSteps';
import { Button, Textarea } from '@/components/ui';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Recipe } from '@/types';

interface InstructionsProps {
  recipe: Recipe;
}

export function Instructions({ recipe }: InstructionsProps) {
  const { instructionsTab, setInstructionsTab } = useAppState();
  const updateRecipe = useUpdateRecipe();
  const parseInstructions = useParseInstructions();
  const updateStructured = useUpdateStructuredInstructions();

  const [rawText, setRawText] = useState(recipe.instructions_raw || '');
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setRawText(recipe.instructions_raw || '');
  }, [recipe.instructions_raw]);

  const handleRawTextChange = useCallback(
    (value: string) => {
      setRawText(value);

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      const timer = setTimeout(() => {
        updateRecipe.mutate(
          { id: recipe.id, data: { instructions_raw: value } },
          { onError: () => toast.error('Failed to save instructions') }
        );
      }, 800);

      setDebounceTimer(timer);
    },
    [debounceTimer, recipe.id, updateRecipe]
  );

  const handleFormat = useCallback(() => {
    if (!rawText.trim()) {
      toast.error('Write some instructions first');
      return;
    }

    parseInstructions.mutate(
      { recipeId: recipe.id, instructionsRaw: rawText },
      {
        onSuccess: (structured) => {
          updateStructured.mutate(
            { recipeId: recipe.id, structured },
            {
              onSuccess: () => {
                toast.success('Instructions formatted into steps');
                setInstructionsTab('steps');
              },
              onError: () => toast.error('Failed to save structured instructions'),
            }
          );
        },
        onError: () => toast.error('Failed to parse instructions'),
      }
    );
  }, [rawText, recipe.id, parseInstructions, updateStructured, setInstructionsTab]);

  return (
    <div>
      {/* Tab Toggle */}
      <div className="mb-4 flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
        <button
          onClick={() => setInstructionsTab('freeform')}
          className={cn(
            'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            instructionsTab === 'freeform'
              ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
              : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
          )}
        >
          Freeform
        </button>
        <button
          onClick={() => setInstructionsTab('steps')}
          className={cn(
            'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            instructionsTab === 'steps'
              ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
              : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
          )}
        >
          Steps
        </button>
      </div>

      {/* Freeform Tab */}
      {instructionsTab === 'freeform' && (
        <div>
          <Textarea
            value={rawText}
            onChange={(e) => handleRawTextChange(e.target.value)}
            placeholder="Type the recipe as you'd explain it to another chef..."
            className="min-h-[200px]"
          />
          <div className="mt-3 flex justify-end">
            <Button
              onClick={handleFormat}
              disabled={parseInstructions.isPending || !rawText.trim()}
            >
              <Wand2 className="h-4 w-4" />
              {parseInstructions.isPending ? 'Formatting...' : 'Format into steps'}
            </Button>
          </div>
        </div>
      )}

      {/* Steps Tab */}
      {instructionsTab === 'steps' && (
        <InstructionsSteps recipe={recipe} />
      )}
    </div>
  );
}
