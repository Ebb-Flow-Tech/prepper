'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  Package,
  BookOpen,
  Plus,
  Trash2,
  Search,
  GripVertical,
  Sun,
  Moon,
  Monitor
} from 'lucide-react';
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Select,
  Textarea,
  Skeleton,
  SearchInput,
  PageHeader,
  GroupSection
} from '@/components/ui';
import { useTheme } from '@/lib/theme';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="text-xl font-semibold text-foreground mb-6 pb-2 border-b border-border">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">{title}</h3>
      {children}
    </div>
  );
}

function ColorSwatch({ name, variable, className }: { name: string; variable: string; className?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-12 h-12 rounded-lg border border-border ${className}`} />
      <div>
        <p className="font-medium text-foreground text-sm">{name}</p>
        <p className="text-xs text-muted-foreground font-mono">{variable}</p>
      </div>
    </div>
  );
}

export default function DesignSystemPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [searchValue, setSearchValue] = useState('');

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl p-6 md:p-8 lg:p-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-3xl font-bold text-foreground mb-2">Reciperep Design System</h1>
          <p className="text-muted-foreground">
            A kitchen-first design system with warm, terracotta-inspired colors and three-font typography.
          </p>
        </div>

        {/* Theme Toggle */}
        <Section title="Theme">
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground">Current theme:</p>
            <div className="flex gap-2">
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('light')}
              >
                <Sun className="h-4 w-4" />
                Light
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('dark')}
              >
                <Moon className="h-4 w-4" />
                Dark
              </Button>
              <Button
                variant={theme === 'system' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('system')}
              >
                <Monitor className="h-4 w-4" />
                System
              </Button>
            </div>
            <span className="text-xs text-muted-foreground">
              (Resolved: {resolvedTheme})
            </span>
          </div>
        </Section>

        {/* Branding */}
        <Section title="Branding">
          <Subsection title="Logo Inline">
            <div className="flex flex-col gap-6">
              <div className="p-6 rounded-lg bg-white border border-border">
                <Image
                  src="/logo/Reciperep logo inline 840x180.png"
                  alt="Reciperep Logo Inline"
                  width={280}
                  height={60}
                  className="h-12 w-auto"
                />
              </div>
              <div className="p-6 rounded-lg bg-zinc-900 border border-border">
                <Image
                  src="/logo/Reciperep logo inline 840x180.png"
                  alt="Reciperep Logo Inline"
                  width={280}
                  height={60}
                  className="h-12 w-auto"
                />
              </div>
              <p className="text-xs text-muted-foreground font-mono">/logo/Reciperep logo inline 840x180.png</p>
            </div>
          </Subsection>

          <Subsection title="Logo Icon">
            <div className="flex gap-6">
              <div className="p-4 rounded-lg bg-white border border-border">
                <Image
                  src="/logo/Reciperep logoicon 260x260.png"
                  alt="Reciperep Logo Icon"
                  width={64}
                  height={64}
                  className="h-16 w-16"
                />
              </div>
              <div className="p-4 rounded-lg bg-zinc-900 border border-border">
                <Image
                  src="/logo/Reciperep logoicon 260x260.png"
                  alt="Reciperep Logo Icon"
                  width={64}
                  height={64}
                  className="h-16 w-16"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-4">/logo/Reciperep logoicon 260x260.png</p>
          </Subsection>

          <Subsection title="Favicon">
            <div className="flex gap-6 items-end">
              <div className="flex flex-col items-center gap-2">
                <div className="p-2 rounded-lg bg-white border border-border">
                  <Image
                    src="/logo/reciperep-favicon-512x512.png"
                    alt="Reciperep Favicon"
                    width={32}
                    height={32}
                    className="h-8 w-8"
                  />
                </div>
                <span className="text-xs text-muted-foreground">32px</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="p-2 rounded-lg bg-white border border-border">
                  <Image
                    src="/logo/reciperep-favicon-512x512.png"
                    alt="Reciperep Favicon"
                    width={48}
                    height={48}
                    className="h-12 w-12"
                  />
                </div>
                <span className="text-xs text-muted-foreground">48px</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="p-2 rounded-lg bg-white border border-border">
                  <Image
                    src="/logo/reciperep-favicon-512x512.png"
                    alt="Reciperep Favicon"
                    width={64}
                    height={64}
                    className="h-16 w-16"
                  />
                </div>
                <span className="text-xs text-muted-foreground">64px</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-4">/logo/reciperep-favicon-512x512.png</p>
          </Subsection>
        </Section>

        {/* Colors */}
        <Section title="Colors">
          <Subsection title="Core Brand Colors">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <ColorSwatch name="Terracotta" variable="--color-terracotta" className="bg-primary" />
              <ColorSwatch name="Green" variable="--color-green" className="bg-[hsl(var(--color-green))]" />
              <ColorSwatch name="Teal" variable="--color-teal" className="bg-[hsl(var(--color-teal))]" />
              <ColorSwatch name="Amber" variable="--color-amber" className="bg-[hsl(var(--color-amber))]" />
              <ColorSwatch name="Red" variable="--color-red" className="bg-destructive" />
              <ColorSwatch name="Slate" variable="--color-slate" className="bg-[hsl(var(--color-slate))]" />
              <ColorSwatch name="Sage" variable="--color-sage" className="bg-tertiary" />
            </div>
          </Subsection>

          <Subsection title="Semantic Colors">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <ColorSwatch name="Background" variable="--background" className="bg-background" />
              <ColorSwatch name="Foreground" variable="--foreground" className="bg-foreground" />
              <ColorSwatch name="Card" variable="--card" className="bg-card" />
              <ColorSwatch name="Secondary" variable="--secondary" className="bg-secondary" />
              <ColorSwatch name="Muted" variable="--muted" className="bg-muted" />
              <ColorSwatch name="Accent" variable="--accent" className="bg-accent" />
              <ColorSwatch name="Border" variable="--border" className="bg-border" />
              <ColorSwatch name="Ring" variable="--ring" className="bg-ring" />
            </div>
          </Subsection>
        </Section>

        {/* Typography */}
        <Section title="Typography">
          <Subsection title="Font Families">
            <div className="space-y-4">
              <div>
                <p className="text-2xl font-normal" style={{ fontFamily: 'var(--font-sans)' }}>
                  CoFo Sans Variable — Body text and UI elements
                </p>
                <p className="text-xs text-muted-foreground font-mono mt-1">--font-sans</p>
              </div>
              <div>
                <p className="text-2xl font-normal" style={{ fontFamily: 'var(--font-display)' }}>
                  Fractul Variable — Display headings
                </p>
                <p className="text-xs text-muted-foreground font-mono mt-1">--font-display</p>
              </div>
              <div>
                <p className="text-2xl font-normal font-mono">
                  CoFo Sans Mono — Code and measurements
                </p>
                <p className="text-xs text-muted-foreground font-mono mt-1">--font-mono</p>
              </div>
            </div>
          </Subsection>

          <Subsection title="Headings">
            <div className="space-y-4">
              <h1 className="text-4xl font-bold">Heading 1 — The quick brown fox</h1>
              <h2 className="text-3xl font-bold">Heading 2 — The quick brown fox</h2>
              <h3 className="text-2xl font-semibold">Heading 3 — The quick brown fox</h3>
              <h4 className="text-xl font-semibold">Heading 4 — The quick brown fox</h4>
              <h5 className="text-lg font-medium">Heading 5 — The quick brown fox</h5>
              <h6 className="text-base font-medium">Heading 6 — The quick brown fox</h6>
            </div>
          </Subsection>

          <Subsection title="Body Text">
            <div className="space-y-3 max-w-2xl">
              <p className="text-foreground">
                Primary text — Used for main content and important information. This is the default text color
                that provides optimal readability against the background.
              </p>
              <p className="text-muted-foreground">
                Muted text — Used for secondary information, descriptions, and helper text. This color is
                less prominent but still readable.
              </p>
            </div>
          </Subsection>
        </Section>

        {/* Buttons */}
        <Section title="Buttons">
          <Subsection title="Variants">
            <div className="flex flex-wrap gap-4">
              <Button variant="default">Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
            </div>
          </Subsection>

          <Subsection title="Sizes">
            <div className="flex flex-wrap items-center gap-4">
              <Button size="lg">Large</Button>
              <Button size="default">Default</Button>
              <Button size="sm">Small</Button>
              <Button size="icon"><Plus className="h-4 w-4" /></Button>
            </div>
          </Subsection>

          <Subsection title="With Icons">
            <div className="flex flex-wrap gap-4">
              <Button>
                <Plus className="h-4 w-4" />
                New Recipe
              </Button>
              <Button variant="outline">
                <Package className="h-4 w-4" />
                Add Ingredient
              </Button>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
          </Subsection>

          <Subsection title="States">
            <div className="flex flex-wrap gap-4">
              <Button>Enabled</Button>
              <Button disabled>Disabled</Button>
            </div>
          </Subsection>
        </Section>

        {/* Badges */}
        <Section title="Badges">
          <Subsection title="Variants">
            <div className="flex flex-wrap gap-3">
              <Badge variant="default">Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="info">Info</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="destructive">Destructive</Badge>
            </div>
          </Subsection>

          <Subsection title="Recipe Status Examples">
            <div className="flex flex-wrap gap-3">
              <Badge variant="secondary">draft</Badge>
              <Badge variant="info">testing</Badge>
              <Badge variant="success">approved</Badge>
              <Badge variant="destructive">archived</Badge>
            </div>
          </Subsection>

          <Subsection title="Status Label Classes">
            <div className="flex flex-wrap gap-3">
              <span className="status-draft">Draft</span>
              <span className="status-testing">Testing</span>
              <span className="status-approved">Approved</span>
              <span className="status-archived">Archived</span>
              <span className="status-active">Active</span>
              <span className="status-inactive">Inactive</span>
            </div>
          </Subsection>

          <Subsection title="Inventory Status">
            <div className="flex flex-wrap gap-3">
              <span className="status-optimal">Optimal</span>
              <span className="status-low">Low Stock</span>
              <span className="status-excess">Excess</span>
            </div>
          </Subsection>
        </Section>

        {/* Form Inputs */}
        <Section title="Form Inputs">
          <div className="max-w-md space-y-6">
            <Subsection title="Text Input">
              <Input placeholder="Enter recipe name..." />
            </Subsection>

            <Subsection title="Search Input">
              <SearchInput
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onClear={() => setSearchValue('')}
                placeholder="Search ingredients..."
              />
            </Subsection>

            <Subsection title="Select">
              <Select
                options={[
                  { value: 'draft', label: 'Draft' },
                  { value: 'testing', label: 'Testing' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'archived', label: 'Archived' },
                ]}
                defaultValue="draft"
              />
            </Subsection>

            <Subsection title="Textarea">
              <Textarea placeholder="Enter cooking instructions..." />
            </Subsection>

            <Subsection title="Input States">
              <div className="space-y-3">
                <Input placeholder="Normal input" />
                <Input placeholder="Disabled input" disabled />
              </div>
            </Subsection>
          </div>
        </Section>

        {/* Cards */}
        <Section title="Cards">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Card</CardTitle>
              </CardHeader>
              <CardContent>
                A simple card with just a title and content.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>With Description</CardTitle>
                <CardDescription>Supporting text goes here</CardDescription>
              </CardHeader>
              <CardContent>
                Cards can have descriptions for additional context.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>With Footer</CardTitle>
              </CardHeader>
              <CardContent>
                This card has a footer section for actions or metadata.
              </CardContent>
              <CardFooter>
                <Button size="sm">Action</Button>
                <Button size="sm" variant="ghost">Cancel</Button>
              </CardFooter>
            </Card>

            <Card interactive>
              <CardHeader>
                <CardTitle>Interactive Card</CardTitle>
              </CardHeader>
              <CardContent>
                Hover over this card to see the lift effect.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Image
                    src="/logo/Reciperep logoicon 260x260.png"
                    alt="Reciperep"
                    width={20}
                    height={20}
                    className="h-5 w-5"
                  />
                  <CardTitle>Recipe Card</CardTitle>
                </div>
                <Badge variant="success">approved</Badge>
              </CardHeader>
              <CardContent>
                <p>A recipe card example with icon and badge.</p>
                <p className="mt-2 text-xs text-muted-foreground">Yield: 10 portions</p>
              </CardContent>
              <CardFooter>
                <span className="text-sm text-muted-foreground">Cost:</span>
                <span className="text-sm font-medium text-foreground ml-1">$12.50</span>
              </CardFooter>
            </Card>
          </div>
        </Section>

        {/* Skeletons */}
        <Section title="Loading States">
          <Subsection title="Skeleton">
            <div className="space-y-4 max-w-md">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <div className="flex gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              </div>
            </div>
          </Subsection>

          <Subsection title="Card Skeleton">
            <div className="max-w-sm">
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-2/3" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-4/5" />
                </CardContent>
              </Card>
            </div>
          </Subsection>
        </Section>

        {/* Page Components */}
        <Section title="Page Components">
          <Subsection title="Page Header">
            <div className="rounded-lg border border-border p-4 bg-card">
              <PageHeader
                title="Ingredients Library"
                description="Manage your ingredient database and costs"
              >
                <Button>
                  <Plus className="h-4 w-4" />
                  Add Ingredient
                </Button>
              </PageHeader>
            </div>
          </Subsection>

          <Subsection title="Group Section">
            <div className="rounded-lg border border-border p-4 bg-card">
              <GroupSection title="Active Ingredients" count={3}>
                <Card>
                  <CardContent className="pt-4">Butter</CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">Flour</CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">Sugar</CardContent>
                </Card>
              </GroupSection>
            </div>
          </Subsection>
        </Section>

        {/* Utility Classes */}
        <Section title="Utility Classes">
          <Subsection title="Animations">
            <div className="flex gap-6">
              <Card interactive className="flow-ui-hover-lift w-40">
                <CardContent className="pt-4 text-center">
                  <p className="text-sm">.flow-ui-hover-lift</p>
                </CardContent>
              </Card>
              <Button className="flow-ui-active-scale">
                .flow-ui-active-scale
              </Button>
            </div>
          </Subsection>

          <Subsection title="Gradients">
            <div className="flex gap-6">
              <div className="w-40 h-24 rounded-lg mono-gradient" />
              <p className="mono-gradient-text text-2xl font-bold">
                Gradient Text
              </p>
            </div>
          </Subsection>
        </Section>

        {/* Icons */}
        <Section title="Icons">
          <p className="text-sm text-muted-foreground mb-4">
            Icons are from Lucide React. Use consistent sizing: h-4 w-4 (16px), h-5 w-5 (20px), h-6 w-6 (24px).
          </p>
          <div className="flex flex-wrap gap-6">
            <div className="flex flex-col items-center gap-2">
              <Package className="h-6 w-6 text-foreground" />
              <span className="text-xs text-muted-foreground">Package</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <BookOpen className="h-6 w-6 text-foreground" />
              <span className="text-xs text-muted-foreground">BookOpen</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Plus className="h-6 w-6 text-foreground" />
              <span className="text-xs text-muted-foreground">Plus</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Trash2 className="h-6 w-6 text-foreground" />
              <span className="text-xs text-muted-foreground">Trash2</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Search className="h-6 w-6 text-foreground" />
              <span className="text-xs text-muted-foreground">Search</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <GripVertical className="h-6 w-6 text-foreground" />
              <span className="text-xs text-muted-foreground">GripVertical</span>
            </div>
          </div>
        </Section>

        {/* Spacing */}
        <Section title="Spacing Scale">
          <p className="text-sm text-muted-foreground mb-4">
            Standard Tailwind spacing scale. Common patterns used in the app:
          </p>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-4">
              <code className="font-mono text-muted-foreground w-24">gap-2</code>
              <span>8px — Tight spacing between related elements</span>
            </div>
            <div className="flex items-center gap-4">
              <code className="font-mono text-muted-foreground w-24">gap-4</code>
              <span>16px — Standard spacing between elements</span>
            </div>
            <div className="flex items-center gap-4">
              <code className="font-mono text-muted-foreground w-24">gap-6</code>
              <span>24px — Generous spacing for sections</span>
            </div>
            <div className="flex items-center gap-4">
              <code className="font-mono text-muted-foreground w-24">p-4</code>
              <span>16px — Card and component padding</span>
            </div>
            <div className="flex items-center gap-4">
              <code className="font-mono text-muted-foreground w-24">p-6</code>
              <span>24px — Page and section padding</span>
            </div>
            <div className="flex items-center gap-4">
              <code className="font-mono text-muted-foreground w-24">mb-6</code>
              <span>24px — Section bottom margin</span>
            </div>
            <div className="flex items-center gap-4">
              <code className="font-mono text-muted-foreground w-24">mb-8</code>
              <span>32px — Large section bottom margin</span>
            </div>
          </div>
        </Section>

        {/* Border Radius */}
        <Section title="Border Radius">
          <div className="flex flex-wrap gap-6">
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 bg-primary rounded-sm" />
              <span className="text-xs text-muted-foreground">rounded-sm</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 bg-primary rounded-md" />
              <span className="text-xs text-muted-foreground">rounded-md</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 bg-primary rounded-lg" />
              <span className="text-xs text-muted-foreground">rounded-lg</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 bg-primary rounded-xl" />
              <span className="text-xs text-muted-foreground">rounded-xl</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 bg-primary rounded-full" />
              <span className="text-xs text-muted-foreground">rounded-full</span>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
