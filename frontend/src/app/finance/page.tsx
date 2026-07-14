'use client';

import { DollarSign, TrendingUp, PieChart, FileDown, Building2 } from 'lucide-react';
import { PageHeader, Card, CardContent, Button, Select } from '@/components/ui';

export default function FinancePage() {
  return (
    <div className="h-full overflow-auto">
      <div className="p-6 max-w-7xl mx-auto">
        <PageHeader
          title="Finance reporting"
          description="Sales data combined with COGS from recipes"
        >
          <div className="flex items-center gap-2">
            <Select
              value="dec-2024"
              onChange={() => {}}
              options={[{ value: 'dec-2024', label: 'December 2024' }]}
              className="w-40"
              disabled
            />
            <Button variant="outline" disabled>
              <FileDown className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </PageHeader>

        {/* Dependency Notice */}
        <Card className="mb-6 border-[var(--color-feedback-warning)] bg-[var(--color-feedback-warning-tint)]">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 text-[var(--color-feedback-warning)] mt-0.5" />
              <div>
                <h3 className="font-medium text-[var(--color-feedback-warning)]">
                  Atlas integration required
                </h3>
                <p className="text-sm text-[var(--color-feedback-warning)] mt-1">
                  This page requires integration with Atlas POS to display sales data.
                  COGS calculations will be available once Atlas integration is complete (Plan 04).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards - Placeholders */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total sales</p>
                  <p className="text-[30px] font-medium tabular-nums text-muted-foreground mt-1">
                    $--,---
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    vs last month
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total COGS</p>
                  <p className="text-[30px] font-medium tabular-nums text-muted-foreground mt-1">
                    $--,---
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    vs last month
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center">
                  <PieChart className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Gross margin</p>
                  <p className="text-[30px] font-medium tabular-nums text-muted-foreground mt-1">
                    --.-%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    vs last month
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sales by Recipe Table - Placeholder */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <h2 className="text-xl font-medium text-foreground mb-4">
              Sales + COGS by recipe
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Recipe
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                      Sold
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                      Revenue
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                      COGS
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                      Margin
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Placeholder rows */}
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="py-3 px-4">
                        <div className="h-4 w-32 bg-secondary rounded" />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="h-4 w-12 bg-secondary rounded ml-auto" />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="h-4 w-16 bg-secondary rounded ml-auto" />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="h-4 w-14 bg-secondary rounded ml-auto" />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="h-4 w-12 bg-secondary rounded ml-auto" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-sm text-muted-foreground text-center mt-6">
              Data will appear once Atlas integration is complete
            </p>
          </CardContent>
        </Card>

        {/* Margin Bandwidth Chart - Placeholder */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-medium text-foreground mb-4">
              Margin bandwidth
            </h2>

            <p className="text-sm text-muted-foreground mb-6">
              Showing margin range per recipe based on supplier price variations (best/worst case)
            </p>

            <div className="h-64 bg-secondary rounded-xl flex items-center justify-center">
              <div className="text-center">
                <PieChart className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  Chart placeholder
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Requires sales data from Atlas
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
