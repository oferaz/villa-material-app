"use client";

import { useEffect, useMemo, useState } from "react";
import { BudgetCategoryName, ProjectBudget } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { buildCategoryBudgetMap, budgetCategoryOrder } from "@/lib/mock/budget";

interface BudgetOverviewProps {
  budget: ProjectBudget;
  onSaveBudget: (payload: { totalBudget: number; categoryBudgets: Record<BudgetCategoryName, number> }) => void;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function sanitizeNumber(value: string): number {
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.round(parsed));
}

export function BudgetOverview({ budget, onSaveBudget }: BudgetOverviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [totalBudgetInput, setTotalBudgetInput] = useState("");
  const [categoryInputs, setCategoryInputs] = useState<Record<BudgetCategoryName, string>>(
    {} as Record<BudgetCategoryName, string>
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setTotalBudgetInput(String(budget.totalBudget));
    const nextInputs = budgetCategoryOrder.reduce<Record<BudgetCategoryName, string>>((acc, categoryName) => {
      const category = budget.categories.find((item) => item.name === categoryName);
      acc[categoryName] = String(category?.totalBudget ?? 0);
      return acc;
    }, {} as Record<BudgetCategoryName, string>);
    setCategoryInputs(nextInputs);
  }, [isOpen, budget]);

  const categoryBudgetMap = useMemo(() => buildCategoryBudgetMap(budget.categories), [budget.categories]);

  function handleSave() {
    const categoryBudgets = budgetCategoryOrder.reduce<Record<BudgetCategoryName, number>>((acc, categoryName) => {
      acc[categoryName] = sanitizeNumber(categoryInputs[categoryName] ?? "0");
      return acc;
    }, {} as Record<BudgetCategoryName, number>);

    onSaveBudget({
      totalBudget: sanitizeNumber(totalBudgetInput),
      categoryBudgets,
    });
    setIsOpen(false);
  }

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Project Budget Overview</CardTitle>
            <CardDescription>
              Track planned vs allocated budget from selected materials and products. Tiles, bathroom, and kitchen
              selections are size-aware when room or house size is set.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={() => setIsOpen(true)}>
            Edit Budget
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Budget</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatCurrency(budget.totalBudget)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Allocated</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatCurrency(budget.allocatedAmount)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Remaining</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatCurrency(budget.remainingAmount)}</p>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {budget.categories.map((category) => {
          const percent = category.totalBudget > 0 ? (category.allocatedAmount / category.totalBudget) * 100 : 0;
          const isOver = category.remainingAmount < 0;
          return (
            <Card key={category.id} className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{category.name}</CardTitle>
                  <Badge variant={isOver ? "danger" : "success"}>{Math.round(percent)}%</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Budget</span>
                    <span className="font-medium text-slate-800">{formatCurrency(category.totalBudget)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Allocated</span>
                    <span className="font-medium text-slate-800">{formatCurrency(category.allocatedAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Remaining</span>
                    <span className={`font-medium ${isOver ? "text-red-600" : "text-slate-800"}`}>
                      {formatCurrency(category.remainingAmount)}
                    </span>
                  </div>
                </div>
                <Progress value={percent} indicatorClassName={isOver ? "bg-red-500" : "bg-emerald-500"} />
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit budget</DialogTitle>
            <DialogDescription>Adjust total budget and planned amounts per category.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-slate-700">Total project budget</p>
              <Input value={totalBudgetInput} onChange={(event) => setTotalBudgetInput(event.target.value)} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {budgetCategoryOrder.map((categoryName) => (
                <div key={categoryName} className="space-y-1.5">
                  <p className="text-sm font-medium text-slate-700">{categoryName}</p>
                  <Input
                    value={categoryInputs[categoryName] ?? String(categoryBudgetMap[categoryName] ?? 0)}
                    onChange={(event) =>
                      setCategoryInputs((prev) => ({
                        ...prev,
                        [categoryName]: event.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave}>
              Save budget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
