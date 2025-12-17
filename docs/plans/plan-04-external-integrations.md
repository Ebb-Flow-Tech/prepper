# Plan 04: External Integrations

**Status**: ⏸️ DEFERRED (Planned for January 2025)
**Priority**: Medium (enables Finance reporting)
**Dependencies**: Plan 01 (Ingredient suppliers field)

> **Note**: This plan is deferred until next month. API credentials and documentation are available but integration work will begin in January 2025. Focus for now is on Plans 01-03.

---

## Overview

Integrate with two external systems:
1. **FoodMarketHub (FMH)** — Procurement platform for ingredient pricing and ordering
2. **Atlas** — POS system for sales data (YC-backed)

These integrations enable real-time pricing, automated procurement, and sales-based finance reporting.

---

## 1. FoodMarketHub (FMH) Integration

### Goal
Sync ingredient data from FMH to keep supplier pricing current and enable future procurement features.

### Integration Pattern

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Prepper   │ ──────► │  FMH API    │ ──────► │  FMH Portal │
│  (Backend)  │ ◄────── │             │ ◄────── │             │
└─────────────┘         └─────────────┘         └─────────────┘
     │
     ▼
┌─────────────┐
│  Ingredient │
│  .suppliers │
│   (JSONB)   │
└─────────────┘
```

### API Discovery Required

Before implementation, need to discover FMH's API:

| Question | Needed For |
|----------|------------|
| API base URL | Connection |
| Authentication method | API key? OAuth? |
| Catalog endpoint | Fetching products |
| Pricing endpoint | Current prices |
| Webhook support? | Real-time price updates |
| Rate limits | Sync strategy |

### Data Model Mapping

```python
# FMH Product → Prepper Ingredient Supplier

fmh_product = {
    "id": "fmh-12345",
    "name": "Cherry Tomatoes",
    "supplier": "ABC Foods Pte Ltd",
    "sku": "TOM-CHR-001",
    "pack_size": 5.0,
    "pack_unit": "kg",
    "unit_price": 2.50,
    "currency": "SGD",
    "category": "Vegetables",
    "last_updated": "2024-12-15T10:30:00Z"
}

# Maps to Ingredient.suppliers entry:
supplier_entry = {
    "supplier_id": "fmh-12345",
    "supplier_name": "ABC Foods Pte Ltd",
    "sku": "TOM-CHR-001",
    "pack_size": 5.0,
    "pack_unit": "kg",
    "price_per_pack": 12.50,  # pack_size * unit_price
    "currency": "SGD",
    "source": "fmh",
    "last_synced": "2024-12-15T10:30:00Z"
}
```

### Sync Strategies

**Option A: Scheduled Sync (Recommended to start)**
```python
# backend/app/integrations/fmh.py

class FMHClient:
    def __init__(self, api_key: str, base_url: str):
        self.api_key = api_key
        self.base_url = base_url

    async def fetch_catalog(self) -> list[FMHProduct]:
        """Fetch all products from FMH catalog."""
        ...

    async def fetch_prices(self, product_ids: list[str]) -> dict[str, Price]:
        """Fetch current prices for specific products."""
        ...

# Celery task or cron job
@celery.task
def sync_fmh_prices():
    """Run daily to update ingredient prices from FMH."""
    client = FMHClient(settings.FMH_API_KEY, settings.FMH_BASE_URL)
    products = await client.fetch_catalog()

    for product in products:
        ingredient = find_ingredient_by_fmh_id(product.id)
        if ingredient:
            update_supplier_pricing(ingredient, product)
```

**Option B: Webhook (if FMH supports)**
```python
# backend/app/api/webhooks.py

@router.post("/webhooks/fmh/price-update")
async def handle_fmh_price_update(payload: FMHPriceWebhook):
    """Handle real-time price updates from FMH."""
    ingredient = find_ingredient_by_fmh_id(payload.product_id)
    if ingredient:
        update_supplier_pricing(ingredient, payload)
    return {"status": "ok"}
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/integrations/fmh/sync` | POST | Trigger manual sync |
| `/integrations/fmh/status` | GET | Last sync status, errors |
| `/integrations/fmh/link` | POST | Link Prepper ingredient to FMH product |
| `/integrations/fmh/unlink` | POST | Unlink ingredient from FMH |

### Environment Variables

```bash
# backend/.env
FMH_API_KEY=xxx
FMH_BASE_URL=https://api.foodmarkethub.com/v1
FMH_SYNC_INTERVAL=86400  # seconds (daily)
```

### Frontend: FMH Linking UI

```
┌─────────────────────────────────────────────────────┐
│  Link Ingredient to FMH                             │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Prepper Ingredient: Cherry Tomatoes                │
│                                                     │
│  Search FMH: [tomato____________] [Search]          │
│                                                     │
│  Results:                                           │
│  ○ Cherry Tomatoes - ABC Foods ($2.50/kg) [Link]    │
│  ○ Roma Tomatoes - ABC Foods ($1.80/kg)   [Link]    │
│  ○ Tomatoes Vine - XYZ Supply ($2.20/kg)  [Link]    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 2. Atlas POS Integration

### Goal
Pull sales data from Atlas to calculate actual revenue and link to recipe COGS for margin analysis.

### Integration Pattern

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Prepper   │ ──────► │  Atlas API  │ ──────► │  Atlas POS  │
│  (Backend)  │ ◄────── │             │ ◄────── │  (Outlets)  │
└─────────────┘         └─────────────┘         └─────────────┘
     │
     ▼
┌─────────────┐
│   Sales     │
│   Table     │
│  (new)      │
└─────────────┘
```

### New Data Model

```python
# backend/app/models/sales.py

class Sale(SQLModel, table=True):
    """Represents a dish sale from Atlas POS."""

    id: int = Field(primary_key=True)

    # Atlas reference
    atlas_transaction_id: str = Field(unique=True, index=True)

    # Link to Prepper recipe
    recipe_id: int | None = Field(foreign_key="recipe.id", index=True)

    # Sale details
    outlet_id: int = Field(foreign_key="outlet.id", index=True)
    quantity: int = Field(default=1)
    unit_price: float  # Selling price from POS
    total: float       # quantity * unit_price
    currency: str = Field(default="SGD")

    # Timing
    sold_at: datetime = Field(index=True)
    synced_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    recipe: "Recipe" = Relationship()
    outlet: "Outlet" = Relationship()
```

### Dish Mapping Challenge

Atlas dishes need to map to Prepper recipes. Options:

**Option A: Manual Mapping**
- Admin UI to link Atlas dish ID → Prepper recipe ID
- Stored in a `DishMapping` table

**Option B: Name Matching**
- Fuzzy match Atlas dish names to Prepper recipe names
- Requires human verification

**Option C: Shared ID**
- When creating a recipe in Prepper, generate an ID that gets entered in Atlas
- Cleanest but requires Atlas workflow change

### Mapping Table

```python
class DishMapping(SQLModel, table=True):
    """Maps Atlas dishes to Prepper recipes."""

    id: int = Field(primary_key=True)
    atlas_dish_id: str = Field(unique=True, index=True)
    atlas_dish_name: str
    recipe_id: int = Field(foreign_key="recipe.id")
    outlet_id: int = Field(foreign_key="outlet.id")  # Atlas dish might be outlet-specific
    is_verified: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

### Sync Strategy

```python
# backend/app/integrations/atlas.py

class AtlasClient:
    def __init__(self, api_key: str, base_url: str):
        self.api_key = api_key
        self.base_url = base_url

    async def fetch_sales(
        self,
        outlet_id: str,
        start_date: date,
        end_date: date
    ) -> list[AtlasSale]:
        """Fetch sales for date range."""
        ...

    async def fetch_menu(self, outlet_id: str) -> list[AtlasDish]:
        """Fetch menu items for mapping."""
        ...

# Sync task
@celery.task
def sync_atlas_sales(days_back: int = 1):
    """Sync recent sales from Atlas."""
    client = AtlasClient(settings.ATLAS_API_KEY, settings.ATLAS_BASE_URL)

    for outlet in get_active_outlets():
        sales = await client.fetch_sales(
            outlet.atlas_id,
            date.today() - timedelta(days=days_back),
            date.today()
        )

        for sale in sales:
            mapping = get_dish_mapping(sale.dish_id)
            if mapping and mapping.is_verified:
                create_sale_record(sale, mapping.recipe_id, outlet.id)
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/integrations/atlas/sync` | POST | Trigger manual sync |
| `/integrations/atlas/status` | GET | Last sync status |
| `/integrations/atlas/dishes` | GET | List Atlas dishes for mapping |
| `/integrations/atlas/mappings` | GET | List dish→recipe mappings |
| `/integrations/atlas/mappings` | POST | Create/update mapping |
| `/sales` | GET | Query sales data |
| `/sales/summary` | GET | Aggregated sales by recipe/outlet/period |

### Environment Variables

```bash
# backend/.env
ATLAS_API_KEY=xxx
ATLAS_BASE_URL=https://api.atlas.com/v1
ATLAS_SYNC_INTERVAL=3600  # hourly
```

### Finance Reporting Queries

```python
# backend/app/domain/finance_service.py

class FinanceService:
    def get_margin_report(
        self,
        outlet_id: int | None,
        start_date: date,
        end_date: date
    ) -> MarginReport:
        """Calculate sales vs COGS for period."""

        sales = self.db.query(Sale).filter(
            Sale.sold_at.between(start_date, end_date),
            Sale.outlet_id == outlet_id if outlet_id else True
        ).all()

        report_items = []
        for recipe_id, recipe_sales in groupby(sales, key=lambda s: s.recipe_id):
            recipe = get_recipe(recipe_id)
            costing = calculate_recipe_cost(recipe_id)

            total_revenue = sum(s.total for s in recipe_sales)
            total_cogs = sum(s.quantity * costing.cost_per_portion for s in recipe_sales)

            report_items.append(MarginItem(
                recipe_id=recipe_id,
                recipe_name=recipe.name,
                units_sold=sum(s.quantity for s in recipe_sales),
                revenue=total_revenue,
                cogs=total_cogs,
                margin_percent=(total_revenue - total_cogs) / total_revenue * 100
            ))

        return MarginReport(
            period=(start_date, end_date),
            outlet_id=outlet_id,
            items=report_items,
            total_revenue=sum(i.revenue for i in report_items),
            total_cogs=sum(i.cogs for i in report_items)
        )
```

---

## Implementation Order

### Phase 1: FMH (Pricing)
1. Discover FMH API capabilities
2. Implement FMH client
3. Build scheduled sync
4. Add linking UI
5. Update costing to use FMH prices

### Phase 2: Atlas (Sales)
1. Discover Atlas API capabilities
2. Create Sales and DishMapping models
3. Implement Atlas client
4. Build dish mapping UI
5. Implement sales sync
6. Build finance reporting

---

## Open Questions

### FMH
1. What is the FMH API documentation URL?
2. Do we have API credentials already?
3. Does FMH support webhooks for price changes?
4. How are products identified? (SKU, internal ID, barcode?)

### Atlas
1. What is the Atlas API documentation URL?
2. Do we have API credentials?
3. How are dishes identified in Atlas?
4. Is there already a dish↔recipe mapping anywhere?
5. What outlet IDs exist in Atlas?

---

## Acceptance Criteria

### FMH Integration
- [ ] Ingredients can be linked to FMH products
- [ ] Scheduled sync updates supplier prices
- [ ] Costing uses synced FMH prices
- [ ] Manual sync can be triggered
- [ ] Sync errors are logged and visible

### Atlas Integration
- [ ] Atlas dishes can be mapped to Prepper recipes
- [ ] Sales data syncs from Atlas
- [ ] Finance report shows revenue vs COGS
- [ ] Data can be filtered by outlet and date range
- [ ] Manual sync can be triggered
