# AI Instructions Parsing Integration

**Date**: 2025-12-03

**Feature**: Transform freeform recipe instructions into structured JSON steps using OpenAI's GPT-5.1

---

## Overview

Integrated Vercel AI SDK to parse natural language recipe instructions into structured steps with extracted metadata (timers, temperatures). The AI is invoked via a Next.js API route, keeping the API key server-side.

**Flow**:
```
Freeform Textarea → "Format into steps" button → Next.js API Route → OpenAI GPT-5.1 → Structured JSON → Save to Backend
```

---

## Files Created

### 1. API Route: `frontend/src/app/api/parse-instructions/route.ts`

Server-side endpoint that calls OpenAI with a Zod schema for structured output.

```typescript
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

const InstructionStepSchema = z.object({
  order: z.number(),
  text: z.string(),
  timer_seconds: z.number().nullable(),
  temperature_c: z.number().nullable(),
});

const InstructionsStructuredSchema = z.object({
  steps: z.array(InstructionStepSchema),
});

// POST handler calls generateObject with GPT-5.1
```

**Key features**:
- Zod schema validation ensures type-safe structured output
- Converts durations to seconds (e.g., "5 minutes" → 300)
- Converts temperatures to Celsius (e.g., "350°F" → 177)
- Error handling for missing API key, rate limits, and general failures

### 2. Environment: `frontend/.env.example`

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
OPENAI_API_KEY=your_openai_api_key_here
```

---

## Files Modified

### 1. Hook: `frontend/src/lib/hooks/useInstructions.ts`

Changed `useParseInstructions` to call our Next.js API route instead of the backend:

```typescript
// Before: called backend /recipes/{id}/instructions/parse
// After: calls /api/parse-instructions (Next.js API route)

export function useParseInstructions() {
  return useMutation({
    mutationFn: async ({ instructionsRaw }) => {
      const response = await fetch('/api/parse-instructions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructions_raw: instructionsRaw }),
      });
      return response.json();
    },
  });
}
```

### 2. Component: `frontend/src/components/recipe/Instructions.tsx`

Enhanced the "Format into steps" button with better loading state:

```typescript
// Before: Wand2 icon, simple "Formatting..." text
// After: Sparkles icon, animated Loader2 spinner, "Parsing with AI..." text

{parseInstructions.isPending ? (
  <>
    <Loader2 className="h-4 w-4 animate-spin" />
    Parsing with AI...
  </>
) : (
  <>
    <Sparkles className="h-4 w-4" />
    Format into steps
  </>
)}
```

---

## Dependencies Added

```json
{
  "ai": "^x.x.x",
  "@ai-sdk/openai": "^x.x.x",
  "zod": "^x.x.x"
}
```

Installed via:
```bash
npm install ai @ai-sdk/openai zod
```

---

## Model Configuration

| Setting | Value |
|---------|-------|
| Provider | OpenAI |
| Model | `gpt-5.1-2025-11-13` |
| Method | `generateObject` (structured output) |
| Schema | Zod with `.describe()` annotations |

---

## Output Schema

The AI returns JSON matching this TypeScript interface:

```typescript
interface InstructionsStructured {
  steps: Array<{
    order: number;           // Sequential step number (1, 2, 3...)
    text: string;            // Clean, imperative instruction
    timer_seconds: number | null;   // Duration in seconds
    temperature_c: number | null;   // Temperature in Celsius
  }>;
}
```

**Example transformation**:

Input:
```
Preheat oven to 180°C.
Mix flour and butter for 5 minutes.
Bake for 30 minutes until golden.
```

Output:
```json
{
  "steps": [
    { "order": 1, "text": "Preheat oven", "timer_seconds": null, "temperature_c": 180 },
    { "order": 2, "text": "Mix flour and butter", "timer_seconds": 300, "temperature_c": null },
    { "order": 3, "text": "Bake until golden", "timer_seconds": 1800, "temperature_c": null }
  ]
}
```

---

## Deployment

### Local Development
```bash
# Create frontend/.env.local
OPENAI_API_KEY=sk-...
```

### Production (Vercel)
Add environment variable in Vercel Dashboard:
- **Key**: `OPENAI_API_KEY`
- **Value**: Your OpenAI API key
- **Environment**: Production (and Preview if desired)

---

## Error Handling

| Scenario | HTTP Status | User Message |
|----------|-------------|--------------|
| Empty instructions | 400 | "No instructions provided" |
| Missing API key | 503 | "AI service not configured" |
| Rate limited | 429 | "Too many requests, please try again shortly" |
| Other errors | 500 | "Failed to parse instructions" |

---

## Architecture Notes

**Why Vercel AI SDK?**
- Provider abstraction: Easy to switch between OpenAI/Anthropic/others
- `generateObject`: Forces structured JSON output with schema validation
- TypeScript-native: Zod schemas provide end-to-end type safety

**Why Next.js API Route (not backend)?**
- Keeps AI logic with frontend codebase
- API key stays server-side (secure)
- Enables streaming in future if needed
- Simpler than adding Python AI dependencies to FastAPI

**Backend `/instructions/parse` endpoint**:
- Still exists as a stub (splits by newlines)
- Kept for API-only clients or fallback
- Could be removed in future cleanup
