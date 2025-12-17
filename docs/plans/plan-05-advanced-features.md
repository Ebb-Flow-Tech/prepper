# Plan 05: Advanced Features

**Status**: Draft
**Priority**: Low (future enhancements)
**Dependencies**: Plans 01-04

---

## Overview

Advanced features that build on the foundation:
1. **Recipe Optimization** — AI-assisted ingredient selection for cost and supplier streamlining
2. **Learning/Training Mode** — Staff training interface for recipe execution
3. **Tasting Notes** — Link tasting session feedback to recipes

---

## 1. Recipe Builder Optimization

### Goal
Help chefs make smarter ingredient choices based on:
- **Price optimization**: Suggest cheaper alternatives
- **Supplier streamlining**: Reduce supplier count for simpler procurement

### Use Cases

**Cost Optimization**
> "Your Carbonara uses Guanciale from ABC Foods at $40/kg. FMH has a similar product from XYZ Supply at $32/kg. Switching would save $1.60/batch."

**Supplier Streamlining**
> "This recipe uses 3 suppliers. If you switch Pecorino to ABC Foods (same price), you'd only need 2 suppliers for this recipe."

### Implementation

#### Optimization Engine

```python
# backend/app/domain/optimization_service.py

class OptimizationService:
    def analyze_recipe(self, recipe_id: int) -> OptimizationSuggestions:
        """Analyze recipe for cost and supplier optimization."""
        recipe = get_recipe(recipe_id)
        suggestions = []

        # 1. Find cheaper alternatives for each ingredient
        for ri in recipe.ingredients:
            ingredient = ri.ingredient
            current_supplier = get_preferred_supplier(ingredient)
            cheaper = find_cheaper_suppliers(ingredient, current_supplier)

            if cheaper:
                suggestions.append(CostSuggestion(
                    ingredient_id=ingredient.id,
                    ingredient_name=ingredient.name,
                    current_supplier=current_supplier.name,
                    current_price=current_supplier.price_per_unit,
                    suggested_supplier=cheaper[0].name,
                    suggested_price=cheaper[0].price_per_unit,
                    savings_per_unit=current_supplier.price_per_unit - cheaper[0].price_per_unit,
                    savings_per_batch=calculate_batch_savings(ri, cheaper[0])
                ))

        # 2. Supplier consolidation analysis
        suppliers_used = get_suppliers_for_recipe(recipe)
        consolidation = analyze_supplier_consolidation(recipe, suppliers_used)

        return OptimizationSuggestions(
            cost_suggestions=suggestions,
            supplier_consolidation=consolidation,
            total_potential_savings=sum(s.savings_per_batch for s in suggestions)
        )

    def apply_suggestion(self, recipe_id: int, suggestion_id: str):
        """Apply a specific optimization suggestion."""
        ...
```

#### Supplier Consolidation Logic

```python
def analyze_supplier_consolidation(recipe: Recipe, current_suppliers: list[Supplier]) -> ConsolidationAnalysis:
    """Find opportunities to reduce supplier count."""

    if len(current_suppliers) <= 1:
        return ConsolidationAnalysis(possible=False)

    # For each ingredient, check if alternative suppliers are already used
    swappable = []
    for ri in recipe.ingredients:
        ingredient = ri.ingredient
        current = get_preferred_supplier(ingredient)

        # Can this ingredient come from another supplier already in use?
        for alt_supplier in ingredient.suppliers:
            if alt_supplier.supplier_id != current.supplier_id:
                if alt_supplier.supplier_id in [s.id for s in current_suppliers]:
                    # This ingredient could come from a supplier we're already using
                    price_diff = alt_supplier.price_per_unit - current.price_per_unit
                    swappable.append(SwapOption(
                        ingredient=ingredient,
                        from_supplier=current,
                        to_supplier=alt_supplier,
                        price_change=price_diff,
                        eliminates_supplier=would_eliminate_supplier(recipe, current, ingredient)
                    ))

    return ConsolidationAnalysis(
        current_supplier_count=len(current_suppliers),
        swappable_ingredients=swappable,
        potential_reduction=calculate_potential_reduction(swappable)
    )
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/recipes/{id}/optimize` | GET | Get optimization suggestions |
| `/recipes/{id}/optimize/apply` | POST | Apply a suggestion |
| `/recipes/{id}/optimize/simulate` | POST | Preview cost with changes |

### Frontend: Optimization Panel

```
┌─────────────────────────────────────────────────────────────────┐
│  💡 OPTIMIZATION SUGGESTIONS                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  COST SAVINGS                          Potential: $3.20/batch   │
│  ─────────────────────────────────────────────────────────────  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Guanciale: ABC Foods → XYZ Supply                       │   │
│  │ $40/kg → $32/kg  •  Saves $1.60/batch                   │   │
│  │ [Apply] [Ignore]                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Pecorino: Premium Cheese → ABC Foods                    │   │
│  │ $48/kg → $44/kg  •  Saves $0.40/batch                   │   │
│  │ [Apply] [Ignore]                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  SUPPLIER STREAMLINING                 Current: 4 suppliers     │
│  ─────────────────────────────────────────────────────────────  │
│  │ Switch Eggs to ABC Foods (same price) → 3 suppliers     │   │
│  │ [Apply] [Ignore]                                        │   │
│                                                                 │
│  [Apply All] [Dismiss]                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Learning/Training Mode

### Goal
Provide a focused interface for kitchen staff to learn recipe execution with step-by-step guidance.

### Features

1. **Step-by-step mode**: Show one instruction at a time with large text
2. **Timers**: Auto-start timers mentioned in steps
3. **Checkboxes**: Mark steps complete
4. **Notes field**: Personal notes (not saved to recipe)
5. **Quiz mode**: Test knowledge of ingredients and quantities

### Data Model

```python
# Track training progress (optional persistence)

class TrainingSession(SQLModel, table=True):
    """Optional: Track staff training progress."""

    id: int = Field(primary_key=True)
    recipe_id: int = Field(foreign_key="recipe.id")
    staff_name: str
    started_at: datetime
    completed_at: datetime | None
    notes: str | None

class TrainingProgress(SQLModel, table=True):
    """Track which recipes a staff member has trained on."""

    id: int = Field(primary_key=True)
    staff_name: str = Field(index=True)
    recipe_id: int = Field(foreign_key="recipe.id")
    trained_at: datetime
    score: int | None  # Quiz score if applicable
```

### Frontend: Training Mode UI

```
┌─────────────────────────────────────────────────────────────────┐
│  🎓 TRAINING MODE: Carbonara                    [Exit Training] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                      ┌─────────────────────────┐               │
│                      │     STEP 3 of 6         │               │
│                      └─────────────────────────┘               │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │   Cook the guanciale in a cold pan over                 │   │
│  │   medium heat until crispy and fat has                  │   │
│  │   rendered (about 8 minutes)                            │   │
│  │                                                         │   │
│  │              ⏱️ 8:00                                    │   │
│  │           [Start Timer]                                 │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Ingredients for this step:                                     │
│  • Guanciale: 200g                                             │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ My notes: _____________________________________________ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [← Previous]              ● ● ◉ ○ ○ ○              [Next →]    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Quiz Mode (Optional)

```
┌─────────────────────────────────────────────────────────────────┐
│  📝 QUIZ: Carbonara                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Question 3 of 5                                                │
│                                                                 │
│  How much Pecorino Romano is needed for 4 portions?             │
│                                                                 │
│  ○ 50g                                                          │
│  ○ 100g                                                         │
│  ○ 150g                                                         │
│  ○ 200g                                                         │
│                                                                 │
│  [Submit Answer]                                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Routing

```
/recipes/[id]/train          → Training mode for recipe
/recipes/[id]/train/quiz     → Quiz mode
/training                    → Training dashboard (all recipes)
/training/progress           → Staff progress tracking
```

---

## 3. Tasting Notes

### Goal
Capture feedback from tasting sessions and link to recipes for R&D iteration.

### Data Model

```python
# backend/app/models/tasting.py

class TastingSession(SQLModel, table=True):
    """A tasting session event."""

    id: int = Field(primary_key=True)
    name: str = Field(max_length=200)  # "December Menu Tasting"
    date: date
    location: str | None
    attendees: list[str] | None = Field(sa_column=Column(JSON))
    notes: str | None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class TastingNote(SQLModel, table=True):
    """A note/feedback for a specific recipe in a tasting session."""

    id: int = Field(primary_key=True)
    session_id: int = Field(foreign_key="tastingsession.id", index=True)
    recipe_id: int = Field(foreign_key="recipe.id", index=True)

    # Ratings (1-5 scale)
    taste_rating: int | None = Field(ge=1, le=5)
    presentation_rating: int | None = Field(ge=1, le=5)
    texture_rating: int | None = Field(ge=1, le=5)
    overall_rating: int | None = Field(ge=1, le=5)

    # Feedback
    feedback: str | None  # Free-form notes
    action_items: str | None  # What to change

    # Decision
    decision: str | None  # "approved", "needs_work", "rejected"

    # Metadata
    taster_name: str | None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    session: "TastingSession" = Relationship()
    recipe: "Recipe" = Relationship()
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/tasting-sessions` | GET | List all sessions |
| `/tasting-sessions` | POST | Create session |
| `/tasting-sessions/{id}` | GET | Get session with notes |
| `/tasting-sessions/{id}/notes` | POST | Add note to session |
| `/tasting-sessions/{id}/notes/{note_id}` | PUT | Update note |
| `/recipes/{id}/tasting-notes` | GET | All tasting notes for recipe |

### Frontend: Tasting Session UI

```
┌─────────────────────────────────────────────────────────────────┐
│  🍷 TASTING SESSION: December Menu Tasting                      │
│  Date: Dec 15, 2024  •  The Loft Kitchen                        │
│  Attendees: Chef Marco, Sarah, James                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  RECIPES TASTED                                                 │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Carbonara v3 (Premium)                    ✅ Approved    │   │
│  │ ────────────────────────────────────────────────────── │   │
│  │ Taste: ★★★★★  Presentation: ★★★★☆  Texture: ★★★★★     │   │
│  │                                                         │   │
│  │ "Guanciale perfectly rendered. Egg emulsion silky.      │   │
│  │  Consider slightly more black pepper."                  │   │
│  │                                                         │   │
│  │ Action: Add 0.5g more black pepper                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ New Tiramisu                              🔄 Needs Work  │   │
│  │ ────────────────────────────────────────────────────── │   │
│  │ Taste: ★★★☆☆  Presentation: ★★★★☆  Texture: ★★☆☆☆     │   │
│  │                                                         │   │
│  │ "Too much coffee soaking. Mascarpone layer too thin.    │   │
│  │  Ladyfingers soggy."                                    │   │
│  │                                                         │   │
│  │ Actions:                                                │   │
│  │ • Reduce coffee soak time to 2 seconds                  │   │
│  │ • Increase mascarpone layer by 50%                      │   │
│  │ • Re-taste next week                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [+ Add Recipe to Session]                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Recipe Page Integration

Show tasting history on individual recipe page:

```
┌─────────────────────────────────────────────────────────────────┐
│  TASTING HISTORY                                                │
│                                                                 │
│  Dec 15: ★★★★★ Approved - "Perfect!"                           │
│  Dec 8:  ★★★☆☆ Needs Work - "Adjust seasoning"                 │
│  Dec 1:  ★★☆☆☆ Needs Work - "Texture issues"                   │
│                                                                 │
│  [View All Notes]                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Order

1. **Tasting Notes** — Standalone feature, low dependency
2. **Training Mode** — Uses existing recipe data
3. **Optimization** — Requires Plan 01 (multi-supplier data)

---

## Open Questions

### Optimization
1. Should suggestions be auto-generated or on-demand?
2. How to handle quality differences between suppliers?
3. Should we track which suggestions were applied/ignored?

### Training Mode
1. Should training progress be persisted?
2. Is quiz mode needed?
3. Should there be a "certified" status for trained staff?

### Tasting Notes
1. Who can create/edit tasting sessions?
2. Should there be a workflow (draft → finalized)?
3. Link to R&D page or standalone?

---

## Acceptance Criteria

### Recipe Optimization
- [ ] System suggests cheaper ingredient alternatives
- [ ] System identifies supplier consolidation opportunities
- [ ] Suggestions can be applied with one click
- [ ] Cost savings are calculated accurately

### Training Mode
- [ ] Recipes can be viewed in step-by-step training mode
- [ ] Timers auto-populate from recipe instructions
- [ ] Progress through steps is tracked
- [ ] (Optional) Quiz mode tests ingredient knowledge

### Tasting Notes
- [ ] Tasting sessions can be created with date/attendees
- [ ] Recipes can be added to sessions with ratings
- [ ] Feedback and action items are captured
- [ ] Recipe page shows tasting history
