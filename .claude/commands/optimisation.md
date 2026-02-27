## Objective
Identify and fix performance bottlenecks in the codebase while preserving identical functional outputs.

## Steps

### Phase 1: Codebase Analysis
- Read through the entire codebase systematically — backend services, API routers, database models, frontend components, hooks, and utilities.
- Build a mental map of data flow, query patterns, rendering paths, and hot paths.

### Phase 2: Identify Performance Bottlenecks
- Analyze the codebase for performance issues across these categories:
  - **Database**: N+1 queries, missing indexes, unoptimized joins, unnecessary eager/lazy loading, redundant queries, large result sets without pagination
  - **API**: Synchronous blocking in async contexts, missing caching opportunities, over-fetching data, redundant serialization, slow endpoint patterns
  - **Frontend**: Unnecessary re-renders, missing memoization, bundle size issues, waterfall data fetching, unoptimized list rendering, missing virtualization for large lists
  - **Redundant API Calls**: Duplicate or unnecessary fetch calls from the frontend — look for components that re-fetch data already available in cache, hooks that trigger multiple requests for the same resource, missing query deduplication, lack of stale-time configuration in TanStack Query, refetches on window focus or mount that aren't needed, and opportunities to batch or combine related API calls into fewer round-trips
  - **General**: Algorithmic inefficiencies, redundant computations, memory leaks, unnecessary data transformations, missing parallelization opportunities

### Phase 3: Impact Assessment & Planning
- Enter plan mode.
- For each identified bottleneck, provide:
  1. **Location**: Exact file(s) and line(s) affected
  2. **Problem**: Clear description of the performance issue
  3. **Impact**: Detailed explanation of how this bottleneck affects the codebase — include severity (high/medium/low), which user-facing flows are impacted, estimated performance cost (e.g. "causes N+1 queries scaling linearly with recipe count", "triggers full component tree re-render on every keystroke")
  4. **Proposed Fix**: The specific optimisation to apply
  5. **Safety Guarantee**: Why this change preserves identical outputs and behavior
- Rank bottlenecks by impact (highest first).
- Present the plan for approval before making any changes.

### Phase 3.5: Generate PDF Report
- BEFORE any implementation, invoke the `/pdf-report-generator` skill to generate a PDF report of all findings to `~/Downloads/optimisation-report.pdf`.
- Pass all bottleneck findings (location, problem, impact, proposed fix, safety guarantee) as context to the skill.
- Confirm the PDF has been saved before proceeding to implementation.

### Phase 4: Implementation
- After plan approval, apply the optimisations one by one, starting with highest impact.
- For each change, verify the fix preserves the same inputs/outputs contract.

## CRITICAL RULES
- **DO NOT change any functional behavior or outputs** — the optimised code must produce exactly the same results as the original for all inputs.
- **DO NOT add new features, refactor for style, or change APIs** — only performance improvements.
- **DO NOT remove error handling, validation, or safety checks** — even if they have a performance cost.
- Prefer the simplest fix that achieves the performance gain.
- If an optimisation carries risk of changing behavior, flag it explicitly and skip it unless approved.
