# Flow UI Starter Kit

> Essential files to implement Flow UI Design System in your project

**Version:** 2.0.0 | **Components:** 56 available in the full library

## What's Included

This starter kit contains everything needed to implement Flow UI:

| File | Description |
|------|-------------|
| `globals.css` | All CSS variables, utility classes, and Flow UI gradient |
| `tailwind.config.js` | Tailwind configuration with Flow UI design tokens |
| `utils.ts` | The `cn()` utility function for class merging |
| `button.tsx` | Example component showing the Flow UI pattern |
| `package.json` | Required dependencies |
| `FLOW-UI-DESIGN-SYSTEM.md` | Complete design system documentation |
| `FLOW-UI-IMPLEMENTATION-GUIDE.md` | Step-by-step implementation guide |

## Quick Setup

### 1. Install Dependencies

```bash
npm install
```

Or copy the dependencies to your existing `package.json`:

```bash
npm install class-variance-authority clsx tailwind-merge tailwindcss-animate @radix-ui/react-slot lucide-react
```

### 2. Copy Files to Your Project

```bash
# Copy CSS (adjust path for your framework)
cp globals.css your-project/app/globals.css        # Next.js App Router
cp globals.css your-project/styles/globals.css     # Next.js Pages Router
cp globals.css your-project/src/index.css          # Vite/React

# Copy Tailwind config
cp tailwind.config.js your-project/tailwind.config.js

# Copy utilities
mkdir -p your-project/lib
cp utils.ts your-project/lib/utils.ts

# Copy example component
mkdir -p your-project/components/ui
cp button.tsx your-project/components/ui/button.tsx
```

### 3. Import Global Styles

In your root layout or app file:

```tsx
// Next.js App Router (app/layout.tsx)
import './globals.css'

// Next.js Pages Router (pages/_app.tsx)
import '../styles/globals.css'

// Vite/React (src/main.tsx)
import './index.css'
```

### 4. Start Using Flow UI

```tsx
import { Button } from '@/components/ui/button'

export function MyComponent() {
  return (
    <Button>Flow UI Button</Button>
  )
}
```

## Customization

### Change Brand Colors

Edit the gradient variables in `globals.css`:

```css
:root {
  --flow-ui-gradient-start: 280 72% 50%; /* Purple */
  --flow-ui-gradient-mid: 346 84% 50%;   /* Pink */
  --flow-ui-gradient-end: 25 95% 53%;    /* Orange */
}
```

### Adjust Theme

Modify any CSS variable in the `:root` section:

```css
:root {
  --primary: 230 40% 48%;        /* Your primary color */
  --background: 60 30% 97%;      /* Your background */
  --radius: 0.75rem;             /* Your border radius */
}
```

### Adding More Components

To add all 56 Flow UI components to your project:

1. Copy the full component library from `frontend/components/ui/`
2. Install additional Radix UI dependencies (see full documentation)
3. Update import paths in components if needed

## Full Documentation

For complete documentation and all available components, see the included docs:

- **[Design System](./FLOW-UI-DESIGN-SYSTEM.md)** - Colors, typography, spacing, components, accessibility
- **[Implementation Guide](./FLOW-UI-IMPLEMENTATION-GUIDE.md)** - Step-by-step setup, customization, troubleshooting

## Component Categories (Full Library)

| Category | Components |
|----------|------------|
| **Layout** | card, separator, aspect-ratio, resizable, scroll-area, sidebar |
| **Navigation** | breadcrumb, dropdown-menu, menubar, navigation-menu, pagination, tabs |
| **Forms** | button, input, label, select, checkbox, radio-group, switch, slider, textarea, form, input-otp, date-picker, calendar |
| **Feedback** | alert, alert-dialog, dialog, drawer, sheet, toast, toaster, sonner, skeleton, progress, loading-state |
| **Data Display** | avatar, gradient-avatar, badge, table, data-table, chart, carousel, hover-card, tooltip |
| **Overlay** | popover, context-menu, command |
| **Utility** | accordion, collapsible, toggle, toggle-group, VisuallyHidden, use-mobile |

## License

Flow UI v2.0.0 is part of the Ebb & Flow Group design system.
