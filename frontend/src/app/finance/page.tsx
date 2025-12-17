'use client';

import { DollarSign, TrendingUp, PieChart, FileDown, Building2 } from 'lucide-react';
import { PageHeader, Card, CardContent, Button, Select } from '@/components/ui';

export default function FinancePage() {
  return (
    <div className="h-full overflow-auto">
      <div className="p-6 max-w-7xl mx-auto">
        <PageHeader
          title="Finance Reporting"
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
        <Card className="mb-6 border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-800 dark:text-amber-300">
                  Atlas Integration Required
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
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
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Total Sales</p>
                  <p className="text-2xl font-bold text-zinc-300 dark:text-zinc-700 mt-1">
                    $--,---
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-1">
                    vs last month
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-zinc-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Total COGS</p>
                  <p className="text-2xl font-bold text-zinc-300 dark:text-zinc-700 mt-1">
                    $--,---
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-1">
                    vs last month
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <PieChart className="h-6 w-6 text-zinc-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Gross Margin</p>
                  <p className="text-2xl font-bold text-zinc-300 dark:text-zinc-700 mt-1">
                    --.-%
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-1">
                    vs last month
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-zinc-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sales by Recipe Table - Placeholder */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Sales + COGS by Recipe
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="text-left py-3 px-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      Recipe
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      Sold
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      Revenue
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      COGS
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      Margin
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Placeholder rows */}
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800">
                      <td className="py-3 px-4">
                        <div className="h-4 w-32 bg-zinc-100 dark:bg-zinc-800 rounded" />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="h-4 w-12 bg-zinc-100 dark:bg-zinc-800 rounded ml-auto" />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="h-4 w-16 bg-zinc-100 dark:bg-zinc-800 rounded ml-auto" />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="h-4 w-14 bg-zinc-100 dark:bg-zinc-800 rounded ml-auto" />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="h-4 w-12 bg-zinc-100 dark:bg-zinc-800 rounded ml-auto" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-sm text-zinc-400 dark:text-zinc-500 text-center mt-6">
              Data will appear once Atlas integration is complete
            </p>
          </CardContent>
        </Card>

        {/* Margin Bandwidth Chart - Placeholder */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Margin Bandwidth
            </h2>

            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
              Showing margin range per recipe based on supplier price variations (best/worst case)
            </p>

            <div className="h-64 bg-zinc-50 dark:bg-zinc-900 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <PieChart className="h-12 w-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
                <p className="text-zinc-400 dark:text-zinc-500">
                  Chart placeholder
                </p>
                <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-1">
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
