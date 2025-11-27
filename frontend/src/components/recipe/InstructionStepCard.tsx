'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Timer, Thermometer } from 'lucide-react';
import { Textarea, Input, Button } from '@/components/ui';
import { formatTimer, parseTimer, cn } from '@/lib/utils';
import type { InstructionStep } from '@/types';

interface InstructionStepCardProps {
  id: string;
  step: InstructionStep;
  stepNumber: number;
  onChange: (step: InstructionStep) => void;
  onDelete: () => void;
}

export function InstructionStepCard({
  id,
  step,
  stepNumber,
  onChange,
  onDelete,
}: InstructionStepCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const [localText, setLocalText] = useState(step.text);
  const [localTimer, setLocalTimer] = useState(formatTimer(step.timer_seconds));
  const [localTemp, setLocalTemp] = useState(
    step.temperature_c?.toString() || ''
  );
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLocalText(step.text);
    setLocalTimer(formatTimer(step.timer_seconds));
    setLocalTemp(step.temperature_c?.toString() || '');
  }, [step]);

  const debouncedSave = useCallback(
    (updates: Partial<InstructionStep>) => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      const timer = setTimeout(() => {
        onChange({ ...step, ...updates });
      }, 500);

      setDebounceTimer(timer);
    },
    [debounceTimer, onChange, step]
  );

  const handleTextChange = (value: string) => {
    setLocalText(value);
    debouncedSave({ text: value });
  };

  const handleTimerChange = (value: string) => {
    setLocalTimer(value);
    const seconds = parseTimer(value);
    debouncedSave({ timer_seconds: seconds || null });
  };

  const handleTempChange = (value: string) => {
    setLocalTemp(value);
    const temp = value ? parseInt(value, 10) : null;
    debouncedSave({ temperature_c: temp });
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800',
        isDragging && 'opacity-50 shadow-lg'
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <button
          {...listeners}
          {...attributes}
          className="mt-2 cursor-grab touch-none text-zinc-400 hover:text-zinc-600 active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold dark:bg-zinc-700">
          {stepNumber}
        </div>

        <div className="flex-1 space-y-3">
          <Textarea
            value={localText}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Describe this step..."
            className="min-h-[80px]"
          />

          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-zinc-400" />
              <Input
                type="text"
                value={localTimer}
                onChange={(e) => handleTimerChange(e.target.value)}
                placeholder="mm:ss"
                className="w-20"
              />
            </div>

            <div className="flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-zinc-400" />
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={localTemp}
                  onChange={(e) => handleTempChange(e.target.value)}
                  placeholder="180"
                  className="w-20"
                />
                <span className="text-sm text-zinc-500">°C</span>
              </div>
            </div>
          </div>
        </div>

        <Button variant="ghost" size="icon" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-zinc-400 hover:text-red-500" />
        </Button>
      </div>
    </div>
  );
}
