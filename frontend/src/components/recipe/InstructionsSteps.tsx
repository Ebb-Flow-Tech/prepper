'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { useUpdateStructuredInstructions } from '@/lib/hooks';
import { InstructionStepCard } from './InstructionStepCard';
import { Button } from '@/components/ui';
import { toast } from 'sonner';
import type { Recipe, InstructionStep, InstructionsStructured } from '@/types';

interface InstructionsStepsProps {
  recipe: Recipe;
}

export function InstructionsSteps({ recipe }: InstructionsStepsProps) {
  const updateStructured = useUpdateStructuredInstructions();
  const steps = recipe.instructions_structured?.steps || [];

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const saveSteps = useCallback(
    (newSteps: InstructionStep[]) => {
      const structured: InstructionsStructured = { steps: newSteps };
      updateStructured.mutate(
        { recipeId: recipe.id, structured },
        { onError: () => toast.error('Failed to save steps') }
      );
    },
    [recipe.id, updateStructured]
  );

  const handleStepChange = useCallback(
    (index: number, updatedStep: InstructionStep) => {
      const newSteps = [...steps];
      newSteps[index] = updatedStep;
      saveSteps(newSteps);
    },
    [steps, saveSteps]
  );

  const handleStepDelete = useCallback(
    (index: number) => {
      const newSteps = steps
        .filter((_, i) => i !== index)
        .map((step, i) => ({ ...step, order: i + 1 }));
      saveSteps(newSteps);
      toast.success('Step deleted');
    },
    [steps, saveSteps]
  );

  const handleAddStep = useCallback(() => {
    const newStep: InstructionStep = {
      order: steps.length + 1,
      text: '',
      timer_seconds: null,
      temperature_c: null,
    };
    saveSteps([...steps, newStep]);
  }, [steps, saveSteps]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = parseInt(String(active.id).replace('step-', ''));
      const newIndex = parseInt(String(over.id).replace('step-', ''));

      const newSteps = arrayMove(steps, oldIndex, newIndex).map((step, i) => ({
        ...step,
        order: i + 1,
      }));

      saveSteps(newSteps);
    },
    [steps, saveSteps]
  );

  if (steps.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-zinc-200 p-8 text-center dark:border-zinc-700">
        <p className="text-zinc-500">No steps yet</p>
        <p className="mt-1 text-sm text-zinc-400">
          Write freeform instructions and click &quot;Format into steps&quot;, or add steps manually
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={handleAddStep}>
          <Plus className="h-4 w-4" />
          Add first step
        </Button>
      </div>
    );
  }

  return (
    <div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={steps.map((_, i) => `step-${i}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {steps.map((step, index) => (
              <InstructionStepCard
                key={`step-${index}`}
                id={`step-${index}`}
                step={step}
                stepNumber={index + 1}
                onChange={(updated) => handleStepChange(index, updated)}
                onDelete={() => handleStepDelete(index)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <div className="mt-4">
        <Button variant="outline" size="sm" onClick={handleAddStep}>
          <Plus className="h-4 w-4" />
          Add step
        </Button>
      </div>
    </div>
  );
}
