# Flow UI Implementation Guide

> How to implement Flow UI Design System in your projects

## Quick Start

To implement Flow UI in a new or existing project, you'll need to copy and configure several files. This guide walks you through the complete setup process.

## Required Files

### 1. Core CSS (`app/globals.css` or `styles/globals.css`)

This contains all CSS variables and utility classes.

**From GrapeStack:** `frontend/app/globals.css`

```css
/* Essential sections to copy: */
- @import for Manrope font
- @tailwind directives
- @layer components (Flow UI gradient, status labels, mobile utilities)
- @layer base with :root CSS variables
- Dark mode variables
```

### 2. Tailwind Configuration (`tailwind.config.ts` or `tailwind.config.js`)

Extends Tailwind with Flow UI design tokens.

**From GrapeStack:** `frontend/tailwind.config.ts`

```typescript
/* Essential configurations: */
- Color definitions mapping to CSS variables
- Champagne color palette
- Flow UI gradient in backgroundImage
- Border radius using --radius variable
- Font family configuration
```

### 3. Component Library (`components/ui/`)

Pre-built Flow UI components following the design system. There are **56 components** available.

**Core components (recommended minimum):**

- `button.tsx` - Button with all variants
- `card.tsx` - Card container system
- `input.tsx` - Form input
- `label.tsx` - Form labels
- `select.tsx` - Dropdown select
- `badge.tsx` - Status badges
- `alert.tsx` - Alert messages
- `dialog.tsx` - Modal dialogs
- `dropdown-menu.tsx` - Context menus
- `tabs.tsx` - Tab navigation
- `separator.tsx` - Visual dividers

**Extended components (full library):**

| Category | Components |
|----------|------------|
| **Layout** | card, separator, aspect-ratio, resizable, scroll-area, sidebar |
| **Navigation** | breadcrumb, dropdown-menu, menubar, navigation-menu, pagination, tabs |
| **Forms** | button, input, label, select, checkbox, radio-group, switch, slider, textarea, form, input-otp, date-picker, calendar |
| **Feedback** | alert, alert-dialog, dialog, drawer, sheet, toast, toaster, sonner, skeleton, progress, loading-state |
| **Data Display** | avatar, gradient-avatar, badge, table, data-table, chart, carousel, hover-card, tooltip |
| **Overlay** | popover, context-menu, command |
| **Utility** | accordion, collapsible, toggle, toggle-group, VisuallyHidden, use-mobile |

### 4. Utility Functions (`lib/utils.ts` or `services/utils.ts`)

The `cn()` function for combining class names.

```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### 5. Documentation

- `FLOW-UI-DESIGN-SYSTEM.md` - Complete design system documentation (in this directory)
- `FLOW-UI-IMPLEMENTATION-GUIDE.md` - This implementation guide

## Step-by-Step Implementation

### Step 1: Install Dependencies

```bash
npm install tailwindcss @tailwindcss/forms @tailwindcss/typography
npm install tailwindcss-animate class-variance-authority clsx tailwind-merge
npm install @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-dropdown-menu
npm install @radix-ui/react-label @radix-ui/react-select @radix-ui/react-separator
npm install @radix-ui/react-tabs @radix-ui/react-alert-dialog
npm install lucide-react
```

### Step 2: Setup Tailwind

1. Copy the Tailwind configuration
2. Update `content` paths to match your project structure:

```typescript
content: [
  "./pages/**/*.{ts,tsx}",     // Adjust paths
  "./components/**/*.{ts,tsx}", // to match
  "./app/**/*.{ts,tsx}",        // your project
]
```

### Step 3: Add Global Styles

1. Copy `globals.css` to your styles directory
2. Import it in your root layout or `_app.tsx`:

```tsx
// Next.js App Router
import './globals.css'

// Next.js Pages Router
import '../styles/globals.css'

// React/Vite
import './index.css'
```

### Step 4: Setup Font

Add Manrope font to your HTML head:

```html
<!-- Option 1: Google Fonts (included in globals.css) -->
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap');

<!-- Option 2: Next.js Font Optimization -->
import { Manrope } from 'next/font/google'
const manrope = Manrope({ subsets: ['latin'] })
```

### Step 5: Create Component Structure

```
your-project/
├── components/
│   └── ui/              # Flow UI components
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       └── ...
├── lib/
│   └── utils.ts         # cn() utility
├── styles/
│   └── globals.css      # Flow UI styles
└── tailwind.config.ts   # Tailwind configuration
```

### Step 6: Theme Provider (Optional)

For dark mode support, add a theme provider:

```tsx
import { ThemeProvider } from 'next-themes'

export function Providers({ children }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
    >
      {children}
    </ThemeProvider>
  )
}
```

## Minimal Implementation

For a minimal Flow UI setup, you need at least:

1. **CSS Variables** in globals.css:
```css
@layer base {
  :root {
    --background: 60 30% 97%;
    --foreground: 220 20% 13%;
    --primary: 230 40% 48%;
    --flow-ui-gradient-start: 280 72% 50%;
    --flow-ui-gradient-mid: 346 84% 50%;
    --flow-ui-gradient-end: 25 95% 53%;
  }
}

@layer components {
  .flow-ui-gradient {
    background: linear-gradient(
      135deg,
      hsl(var(--flow-ui-gradient-start)) 0%,
      hsl(var(--flow-ui-gradient-mid)) 50%,
      hsl(var(--flow-ui-gradient-end)) 100%
    );
  }
}
```

2. **Tailwind Config** extending colors:
```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
      },
    },
  },
}
```

3. **Basic Button Component**:
```tsx
import { cn } from '@/lib/utils'

export function Button({ className, ...props }) {
  return (
    <button
      className={cn(
        "px-6 py-2 rounded-full flow-ui-gradient text-white",
        "hover:opacity-90 transition-all duration-300",
        className
      )}
      {...props}
    />
  )
}
```

## Framework-Specific Notes

### Next.js (App Router)
- Place globals.css in `app/`
- Import in `app/layout.tsx`
- Components in `components/ui/`

### Next.js (Pages Router)
- Place globals.css in `styles/`
- Import in `pages/_app.tsx`
- Components in `components/ui/`

### Vite/React
- Place globals.css in `src/`
- Import in `src/main.tsx`
- Components in `src/components/ui/`

### Vue/Nuxt
- Adapt React components to Vue syntax
- Use `<style>` blocks for component styles
- CSS variables work the same way

## Customization

### Changing Brand Colors

Update the gradient variables in globals.css:

```css
:root {
  /* Your brand gradient */
  --flow-ui-gradient-start: 200 80% 50%; /* Your color */
  --flow-ui-gradient-mid: 150 70% 50%;   /* Your color */
  --flow-ui-gradient-end: 100 60% 50%;   /* Your color */
}
```

### Adjusting Spacing

Modify the Tailwind spacing scale or use CSS variables:

```css
:root {
  --spacing-unit: 4px; /* Base spacing unit */
}
```

### Custom Fonts

Replace Manrope with your brand font:

```css
--font-sans: 'YourFont', -apple-system, BlinkMacSystemFont, sans-serif;
```

## Testing Your Implementation

1. **Visual Test**: Navigate to `/design-system` if you copied the preview page
2. **Component Test**: Try each component variant
3. **Theme Test**: Toggle between light and dark modes
4. **Responsive Test**: Check mobile and desktop layouts

## Troubleshooting

### Common Issues

1. **Colors not working**
   - Ensure CSS variables are defined in `:root`
   - Check Tailwind config maps to CSS variables
   - Verify globals.css is imported

2. **Components unstyled**
   - Check all dependencies are installed
   - Verify import paths are correct
   - Ensure Tailwind directives are included

3. **Fonts not loading**
   - Check Google Fonts import
   - Verify font-family CSS variable
   - Clear browser cache

4. **Dark mode not working**
   - Install and configure theme provider
   - Add `.dark` class styles
   - Check `attribute="class"` in provider

## File Size Optimization

### Production Build

Flow UI adds approximately:
- CSS: ~25KB (minified)
- Component JS: ~15KB per component
- Total: ~150KB for full implementation

### Tree Shaking

Only import components you use:

```tsx
// Good - specific import
import { Button } from '@/components/ui/button'

// Avoid - barrel import
import * as UI from '@/components/ui'
```

## Migration from Other Systems

### From Material-UI

1. Replace MUI ThemeProvider with CSS variables
2. Map MUI components to Flow UI equivalents
3. Convert sx props to Tailwind classes

### From Ant Design

1. Replace ConfigProvider with CSS variables
2. Map Ant components to Flow UI components
3. Convert Less variables to CSS variables

### From Bootstrap

1. Replace Bootstrap classes with Tailwind utilities
2. Convert Sass variables to CSS variables
3. Use Flow UI components instead of Bootstrap components

## Export Package Script

Create a script to export Flow UI files:

```bash
#!/bin/bash
# export-flow-ui.sh

# Create export directory
mkdir -p flow-ui-export/components/ui
mkdir -p flow-ui-export/styles
mkdir -p flow-ui-export/lib
mkdir -p flow-ui-export/docs

# Copy files
cp frontend/app/globals.css flow-ui-export/styles/
cp frontend/tailwind.config.ts flow-ui-export/
cp frontend/components/ui/*.tsx flow-ui-export/components/ui/
cp frontend/services/utils.ts flow-ui-export/lib/utils.ts
cp frontend/lib/utils.ts flow-ui-export/lib/utils-alias.ts 2>/dev/null || true
cp flow-ui-starter/FLOW-UI-*.md flow-ui-export/docs/

# Create package.json
cat > flow-ui-export/package.json << 'EOF'
{
  "name": "flow-ui",
  "version": "2.0.0",
  "description": "Flow UI Design System - A comprehensive, elegant design system for wine industry applications and beyond",
  "dependencies": {
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0",
    "tailwindcss-animate": "^1.0.7",
    "@radix-ui/react-slot": "^1.0.2",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-label": "^2.0.2",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-separator": "^1.0.3",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-alert-dialog": "^1.0.5",
    "@radix-ui/react-accordion": "^1.1.2",
    "@radix-ui/react-checkbox": "^1.0.4",
    "@radix-ui/react-popover": "^1.0.7",
    "@radix-ui/react-tooltip": "^1.0.7",
    "@radix-ui/react-switch": "^1.0.3",
    "@radix-ui/react-slider": "^1.1.2",
    "@radix-ui/react-radio-group": "^1.1.3",
    "@radix-ui/react-toggle": "^1.0.3",
    "@radix-ui/react-toggle-group": "^1.0.4",
    "@radix-ui/react-scroll-area": "^1.0.5",
    "@radix-ui/react-hover-card": "^1.0.7",
    "@radix-ui/react-context-menu": "^2.1.5",
    "@radix-ui/react-menubar": "^1.0.4",
    "@radix-ui/react-navigation-menu": "^1.1.4",
    "@radix-ui/react-progress": "^1.0.3",
    "@radix-ui/react-collapsible": "^1.0.3",
    "@radix-ui/react-aspect-ratio": "^1.0.3",
    "lucide-react": "^0.263.1",
    "sonner": "^1.0.0",
    "cmdk": "^0.2.0",
    "embla-carousel-react": "^8.0.0",
    "react-day-picker": "^8.0.0",
    "date-fns": "^2.30.0",
    "recharts": "^2.8.0",
    "vaul": "^0.9.0",
    "react-resizable-panels": "^2.0.0",
    "input-otp": "^1.0.0"
  }
}
EOF

echo "Flow UI v2.0.0 exported to ./flow-ui-export (56 components)"
```

## Support

For questions or issues with Flow UI implementation:

1. Check the [Design System Documentation](./FLOW-UI-DESIGN-SYSTEM.md)
2. Review the interactive examples in the project's `/design-system` page
3. Refer to component source files for implementation details
4. Use the starter files in this directory for a minimal working example

---

*Flow UI v2.0.0 is maintained by the Ebb & Flow Group development team.*
