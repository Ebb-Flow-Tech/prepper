# Flow UI Design System

> A comprehensive, elegant design system for wine industry applications and beyond

## Table of Contents

1. [Introduction](#introduction)
2. [Core Principles](#core-principles)
3. [Color System](#color-system)
4. [Typography](#typography)
5. [Spacing & Layout](#spacing--layout)
6. [Components](#components)
7. [Animations & Transitions](#animations--transitions)
8. [Responsive Design](#responsive-design)
9. [Accessibility](#accessibility)
10. [Implementation Guidelines](#implementation-guidelines)

## Introduction

Flow UI is a modern, cohesive design system built for the Ebb & Flow Group's applications. Initially developed for GrapeStack, it provides a consistent visual language across all platforms, emphasizing elegance, usability, and industry-specific aesthetics.

### Technology Stack
- **Framework:** Tailwind CSS for utility-first styling
- **Components:** Radix UI primitives with custom styling
- **Theming:** CSS variables for dynamic theming
- **Variant Management:** class-variance-authority (CVA)

## Core Principles

### 1. **Elegance Through Simplicity**
- Clean, uncluttered interfaces
- Subtle shadows and transitions
- Generous whitespace

### 2. **Industry-Aware Design**
- Wine-inspired color palette
- Premium feel reflecting product value
- Professional yet approachable

### 3. **Accessibility First**
- WCAG 2.1 AA compliance
- Touch-friendly targets (44px minimum)
- Clear focus states

### 4. **Performance Optimized**
- Mobile-first responsive design
- Smooth 300ms transitions
- Efficient component patterns

## Color System

### Base Palette

Flow UI uses an HSL-based color system for easy theming and consistency.

#### Light Mode

```css
/* Primary Colors */
--background: 60 30% 97%;        /* #FAFAF7 - Warm white base */
--foreground: 220 20% 13%;       /* #1B1F24 - Deep charcoal text */
--primary: 230 40% 48%;          /* #4257B2 - Elegant indigo */
--primary-foreground: 0 0% 98%;  /* Near white */

/* Surface Colors */
--card: 35 15% 95%;              /* #F4F2EF - Parchment tint */
--popover: 35 15% 95%;           /* Matches card */
--secondary: 35 15% 94%;         /* Subtle warm grey */
--muted: 35 15% 94%;             /* For disabled states */
--accent: 35 15% 94%;            /* Highlight color */

/* Semantic Colors */
--destructive: 0 70% 47%;        /* #C62828 - Deep red */
--destructive-foreground: 0 0% 98%;

/* UI Elements */
--border: 35 15% 85%;            /* Subtle warm border */
--input: 35 15% 85%;             /* Form inputs */
--ring: 230 40% 48%;             /* Focus ring (matches primary) */
```

#### Dark Mode

```css
/* Inverted for dark theme */
--background: 220 20% 10%;       /* Deep charcoal */
--foreground: 60 10% 98%;        /* Warm white text */
--primary: 230 40% 60%;          /* Lighter indigo */
--primary-foreground: 0 0% 100%;
--card: 220 20% 13%;             /* Slightly elevated surface */
--card-foreground: 60 10% 98%;

/* Secondary & Muted */
--secondary: 220 20% 18%;
--secondary-foreground: 60 10% 98%;
--muted: 220 20% 18%;
--muted-foreground: 60 10% 70%;

/* Accent */
--accent: 220 20% 18%;
--accent-foreground: 60 10% 98%;

/* Destructive */
--destructive: 0 70% 50%;
--destructive-foreground: 60 10% 98%;

/* Borders & Inputs */
--border: 220 20% 20%;
--input: 220 20% 20%;
--ring: 230 40% 60%;
```

### Status Colors

Semantic colors for inventory and business states:

```css
/* Optimal Status - Green */
--status-optimal-bg: 140 40% 94%;    /* Light green background */
--status-optimal-text: 140 50% 34%;  /* Dark green text */

/* Low Stock - Red */
--status-low-bg: 0 80% 96%;          /* Light red background */
--status-low-text: 0 70% 47%;        /* Dark red text */

/* Excess Stock - Amber */
--status-excess-bg: 35 100% 96%;     /* Light amber background */
--status-excess-text: 25 65% 37%;    /* Dark amber text */
```

### Champagne Palette

Special accent colors inspired by champagne and wine:

```css
champagne: {
  50: "#faf6ef",   /* Lightest champagne */
  300: "#E3CDA4",  /* Primary champagne gold */
  400: "#D4B88C",  /* Hover state */
  500: "#c9a978",  /* Active state */
  900: "#6d573a",  /* Darkest shade */
}
```

### Chart Colors

Data visualization palette:

```css
--chart-1: 230 40% 48%;  /* Indigo - Revenue */
--chart-2: 160 38% 48%;  /* Sage green - Profit */
--chart-3: 40 90% 45%;   /* Alert orange - Warnings */
--chart-4: 350 70% 47%;  /* Deep red - Critical */
--chart-5: 25 65% 37%;   /* Brown - Other */
```

### Dialog & Overlay Colors

```css
/* Light Mode */
--dialog-overlay: 30 10% 22% / 0.2;  /* Parchment-tinted grey at 20% */

/* Dark Mode */
--dialog-overlay: 220 20% 8% / 0.4;  /* Darker overlay */
```

### Calendar Selection Colors

```css
--calendar-selected-start: 271 81% 56%;  /* #9333ea - Purple */
--calendar-selected-end: 25 95% 53%;     /* #f97316 - Orange */
--calendar-selected-text: 43 71% 95%;    /* #faf5eb - Cream */
```

### Header Colors

```css
/* Light Mode */
--header: 60 30% 97%;            /* Same as main background */
--header-foreground: 220 20% 13%;
--header-border: 35 15% 85%;
```

### Sidebar Colors

```css
/* Light Mode */
--sidebar-background: 60 30% 97%;
--sidebar-foreground: 220 20% 13%;
--sidebar-border: 35 15% 85%;
--sidebar-primary: 230 40% 48%;
--sidebar-primary-foreground: 0 0% 98%;
--sidebar-accent: 35 15% 94%;
--sidebar-accent-foreground: 220 20% 13%;
--sidebar-ring: 230 40% 48%;
--sidebar: 60 30% 97%;

/* Dark Mode */
--sidebar-background: 220 20% 13%;
--sidebar-foreground: 60 10% 98%;
--sidebar-border: 220 20% 20%;
--sidebar-primary: 230 40% 60%;
--sidebar-primary-foreground: 0 0% 100%;
--sidebar-accent: 220 20% 18%;
--sidebar-accent-foreground: 60 10% 98%;
--sidebar-ring: 230 40% 60%;
--sidebar: 220 20% 13%;
```

## Typography

### Font Stack

```css
--font-sans: 'Manrope', -apple-system, BlinkMacSystemFont,
             'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
```

### Type Scale

| Level | Size | Weight | Usage |
|-------|------|--------|-------|
| Display | 2.5rem (40px) | 700 | Page headers |
| H1 | 2rem (32px) | 600 | Section titles |
| H2 | 1.5rem (24px) | 600 | Card headers |
| H3 | 1.25rem (20px) | 500 | Subsections |
| Body | 1rem (16px) | 400 | Default text |
| Small | 0.875rem (14px) | 400 | Secondary text |
| Caption | 0.75rem (12px) | 400 | Labels, hints |

### Text Colors

```css
/* Primary text */
color: hsl(var(--foreground));

/* Secondary text */
color: hsl(var(--muted-foreground));  /* 60% opacity */

/* Link text */
color: hsl(var(--primary));
```

## Spacing & Layout

### Spacing Scale

Based on 4px increments (Tailwind's spacing system):

| Token | Size | Usage |
|-------|------|-------|
| 0 | 0px | Reset |
| 1 | 4px | Tight spacing |
| 2 | 8px | Compact |
| 3 | 12px | Comfortable |
| 4 | 16px | Default |
| 6 | 24px | Generous |
| 8 | 32px | Spacious |
| 12 | 48px | Section gaps |

### Container Widths

```css
.container {
  max-width: 1400px;  /* 2xl breakpoint */
  padding: 2rem;      /* 32px */
  margin: 0 auto;
}
```

### Grid System

```css
/* Mobile-first responsive grid */
.grid {
  grid-template-columns: 1fr;                    /* Mobile */
  @media (min-width: 768px) { columns: 2; }      /* Tablet */
  @media (min-width: 1024px) { columns: 3; }     /* Desktop */
}
```

### Border Radius

```css
--radius: 0.75rem;  /* 12px - Default */

/* Variants */
rounded-sm: calc(var(--radius) - 4px);  /* 8px */
rounded-md: calc(var(--radius) - 2px);  /* 10px */
rounded-lg: var(--radius);              /* 12px */
rounded-xl: 1rem;                        /* 16px */
rounded-full: 9999px;                   /* Pills */
```

## Components

Flow UI includes 56 pre-built components. Below are the core components with detailed documentation.

### Component Library Overview

| Category | Components |
|----------|------------|
| **Layout** | card, separator, aspect-ratio, resizable, scroll-area, sidebar |
| **Navigation** | breadcrumb, dropdown-menu, menubar, navigation-menu, pagination, tabs |
| **Forms** | button, input, label, select, checkbox, radio-group, switch, slider, textarea, form, input-otp, date-picker, calendar |
| **Feedback** | alert, alert-dialog, dialog, drawer, sheet, toast, toaster, sonner, skeleton, progress, loading-state |
| **Data Display** | avatar, gradient-avatar, badge, table, data-table, chart, carousel, hover-card, tooltip |
| **Overlay** | popover, context-menu, command |
| **Utility** | accordion, collapsible, toggle, toggle-group, VisuallyHidden, use-mobile |

### Buttons

#### Variants

```tsx
/* Primary - Gradient background */
variant="default"  // bg-grapestack-gradient with hover effects

/* Destructive - Red for dangerous actions */
variant="destructive"  // Red background with hover state

/* Outline - Border only */
variant="outline"  // Transparent with border

/* Secondary - Subtle background */
variant="secondary"  // Light background

/* Ghost - Minimal style */
variant="ghost"  // Transparent, hover reveals background

/* Link - Text only */
variant="link"  // Underlined text
```

#### Sizes

```tsx
size="sm"       // h-9 px-3
size="default"  // h-10 px-6
size="lg"       // h-11 px-8
size="icon"     // h-10 w-10 (square)
```

#### Special Effects

- Hover: `scale-[1.02]` with shadow increase
- Active: `scale-[0.98]` for tactile feedback
- Focus: 2px ring with offset
- Disabled: 50% opacity with no pointer events

### Cards

```css
.card {
  border-radius: 12px;
  border: 1px solid hsl(var(--border) / 0.4);
  background: hsl(var(--card));
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  transition: box-shadow 300ms;
}

.card:hover {
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}
```

### Forms

#### Input Fields

```css
.input {
  height: 40px;
  padding: 0 12px;
  border: 1px solid hsl(var(--input));
  border-radius: var(--radius);
  font-size: 16px; /* Prevents iOS zoom */
}

.input:focus {
  outline: none;
  ring: 2px solid hsl(var(--ring));
}
```

#### Labels

```css
.label {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
  color: hsl(var(--foreground));
}
```

### Status Labels

Pre-defined status indicators:

```css
.status-optimal {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  background: hsl(var(--status-optimal-bg));
  color: hsl(var(--status-optimal-text));
}
```

### Tables

```css
.table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

.table thead {
  background: hsl(var(--muted));
  border-bottom: 2px solid hsl(var(--border));
}

.table tbody tr:hover {
  background: hsl(var(--accent));
}
```

### Dialogs & Overlays

```css
/* Dialog overlay with backdrop blur */
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  backdrop-filter: blur(3px);
  background-color: hsl(var(--dialog-overlay));
}

/* Mobile-optimized dialog content */
.dialog-content-mobile {
  border-radius: 1rem;  /* 16px on mobile */
}
@media (min-width: 640px) {
  .dialog-content-mobile {
    border-radius: 0.75rem;  /* 12px on desktop */
  }
}

/* Mobile dialog footer - stacked buttons */
.dialog-footer-mobile {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
@media (min-width: 640px) {
  .dialog-footer-mobile {
    flex-direction: row;
    justify-content: flex-end;
    gap: 0.5rem;
  }
}
```

### Calendar

```css
/* Selected day with gradient */
.calendar-selected {
  background: linear-gradient(to right, #9333ea, #f97316);
  color: #faf5eb !important;
  font-weight: 700;
}

.calendar-selected:hover,
.calendar-selected:focus {
  background: linear-gradient(to right, #7e22ce, #ea580c);
}
```

### Sidebar

```css
/* Sidebar container */
aside {
  border-right: 1px solid hsl(var(--sidebar-border));
}

/* Header border */
header {
  border-bottom: 1px solid hsl(var(--header-border));
}
```

## Animations & Transitions

### Standard Timing

```css
/* Default transition */
transition: all 300ms ease-in-out;

/* Quick feedback */
transition: all 150ms ease-out;

/* Smooth reveals */
transition: all 500ms cubic-bezier(0.4, 0, 0.2, 1);
```

### Common Animations

```css
/* Accordion */
@keyframes accordion-down {
  from { height: 0; }
  to { height: var(--radix-accordion-content-height); }
}

/* Fade in */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Scale feedback */
.interactive:hover { transform: scale(1.02); }
.interactive:active { transform: scale(0.98); }
```

## Responsive Design

### Breakpoints

```css
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1400px /* Wide screen */
```

### Mobile Utilities

```css
/* Container padding */
.mobile-container {
  padding-left: 16px;   /* Mobile */
  @media (sm) { padding-left: 24px; }
  @media (lg) { padding-left: 32px; }
}

/* Touch targets */
.touch-target {
  min-height: 44px;
  min-width: 44px;
}

/* Safe areas for notched devices */
.safe-area-inset-top {
  padding-top: env(safe-area-inset-top);
}
```

### Responsive Grids

```css
.mobile-form-grid {
  display: grid;
  grid-template-columns: 1fr;                /* Mobile: single column */
  gap: 16px;

  @media (md) {
    grid-template-columns: repeat(2, 1fr);   /* Tablet: 2 columns */
    gap: 24px;
  }

  @media (lg) {
    grid-template-columns: repeat(3, 1fr);   /* Desktop: 3 columns */
  }
}
```

## Accessibility

### Focus Management

```css
/* Visible focus rings */
:focus-visible {
  outline: none;
  ring: 2px solid hsl(var(--ring));
  ring-offset: 2px;
}

/* Skip to content link */
.skip-to-content {
  position: absolute;
  top: -40px;
  left: 0;
  background: hsl(var(--background));
  z-index: 100;
}

.skip-to-content:focus {
  top: 0;
}
```

### Screen Reader Support

```tsx
/* Visually hidden but accessible */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

### Touch & Interaction

- Minimum touch target: 44x44px (iOS guideline)
- Sufficient color contrast: 4.5:1 for normal text
- Keyboard navigation support for all interactive elements
- ARIA labels for icon-only buttons

## Implementation Guidelines

### File Structure

```
frontend/
├── app/
│   ├── globals.css           # Global styles and CSS variables
│   └── design-system/
│       └── page.tsx          # Interactive component showcase
├── components/
│   └── ui/                   # Flow UI components (56 total)
│       ├── accordion.tsx
│       ├── alert.tsx
│       ├── alert-dialog.tsx
│       ├── avatar.tsx
│       ├── badge.tsx
│       ├── breadcrumb.tsx
│       ├── button.tsx
│       ├── calendar.tsx
│       ├── card.tsx
│       ├── carousel.tsx
│       ├── chart.tsx
│       ├── checkbox.tsx
│       ├── collapsible.tsx
│       ├── command.tsx
│       ├── context-menu.tsx
│       ├── data-table.tsx
│       ├── date-picker.tsx
│       ├── dialog.tsx
│       ├── drawer.tsx
│       ├── dropdown-menu.tsx
│       ├── form.tsx
│       ├── gradient-avatar.tsx
│       ├── hover-card.tsx
│       ├── input.tsx
│       ├── input-otp.tsx
│       ├── label.tsx
│       ├── loading-state.tsx
│       ├── menubar.tsx
│       ├── navigation-menu.tsx
│       ├── pagination.tsx
│       ├── popover.tsx
│       ├── progress.tsx
│       ├── radio-group.tsx
│       ├── resizable.tsx
│       ├── scroll-area.tsx
│       ├── select.tsx
│       ├── separator.tsx
│       ├── sheet.tsx
│       ├── sidebar.tsx
│       ├── skeleton.tsx
│       ├── slider.tsx
│       ├── sonner.tsx
│       ├── switch.tsx
│       ├── table.tsx
│       ├── tabs.tsx
│       ├── textarea.tsx
│       ├── toast.tsx
│       ├── toaster.tsx
│       ├── toggle.tsx
│       ├── toggle-group.tsx
│       ├── tooltip.tsx
│       ├── use-mobile.tsx
│       └── VisuallyHidden.tsx
├── lib/
│   └── utils.ts              # cn() utility (alias)
├── services/
│   └── utils.ts              # cn() utility for class merging
└── tailwind.config.ts        # Tailwind configuration
```

### Component Pattern

```tsx
// Example Flow UI component
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/services/utils";  // or @/lib/utils depending on project setup

const componentVariants = cva(
  "base-classes",
  {
    variants: {
      variant: {
        default: "default-classes",
        secondary: "secondary-classes",
      },
      size: {
        default: "size-default",
        sm: "size-sm",
        lg: "size-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

interface ComponentProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof componentVariants> {
  // Additional props
}

const Component = React.forwardRef<HTMLElement, ComponentProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <element
        ref={ref}
        className={cn(componentVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);

Component.displayName = "Component";

export { Component, componentVariants };
```

### CSS Variable Usage

```css
/* Define in :root */
:root {
  --flow-ui-primary: 230 40% 48%;
}

/* Use with hsl() */
.element {
  background-color: hsl(var(--flow-ui-primary));
  color: hsl(var(--flow-ui-primary) / 0.5); /* With opacity */
}
```

### Theming Support

```tsx
// Theme provider setup
<ThemeProvider
  attribute="class"
  defaultTheme="system"
  enableSystem
  disableTransitionOnChange
>
  <App />
</ThemeProvider>
```

### Best Practices

1. **Use semantic color names** - Don't use color values directly
2. **Maintain consistency** - Use predefined spacing and sizing scales
3. **Mobile-first** - Design for mobile, enhance for desktop
4. **Performance** - Use CSS transforms over position changes
5. **Accessibility** - Always include keyboard and screen reader support
6. **Component composition** - Build complex UIs from simple primitives

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | 2025-11-28 | Major update: Added 56 components, dialog/calendar/sidebar variables, dark mode status colors, comprehensive utility classes |
| 1.0.0 | 2024-01-18 | Initial Flow UI documentation |

## Migration Guide

For existing projects using the old system:

1. Replace color values with Flow UI CSS variables
2. Update component imports to use Flow UI components
3. Apply new spacing scale (4px based)
4. Update border radius to use --radius variable
5. Ensure mobile optimizations are applied

## Resources

- [Preview Page](/design-system) - Interactive component showcase
- [Figma Library](#) - Design files (coming soon)
- [Code Examples](#) - Implementation patterns

---

*Flow UI is maintained by the Ebb & Flow Group development team. For questions or contributions, please refer to the main project documentation.*