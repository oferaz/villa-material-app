"use client";

import React from "react";
import { getObjectWorkflowStage, getWorkflowStageLabel, Project, ProjectBudget } from "@/types";

interface SpreadsheetViewProps {
  project: Project;
  budget: ProjectBudget;
}

function formatCurrency(value: number | undefined | null, currency: string): string {
  if (value === undefined || value === null) {
    return "—";
  }
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function BooleanBadge({ value }: { value: boolean | undefined }) {
  if (value) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
        Yes
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
      No
    </span>
  );
}

const COL_HEADERS = [
  "Object name",
  "Category",
  "Qty",
  "Material",
  "Supplier",
  "Unit price",
  "Total",
  "Budget allowance",
  "vs. Allowance",
  "Workflow",
  "PO approved",
  "Ordered",
  "Installed",
];

export function SpreadsheetView({ project, budget }: SpreadsheetViewProps) {
  const currency = project.currency || "USD";

  // Pre-index room budgets by roomId for O(1) lookup
  const roomBudgetByRoomId = new Map(budget.rooms.map((rb) => [rb.roomId, rb]));
  const houseBudgetByHouseId = new Map(budget.houses.map((hb) => [hb.houseId, hb]));

  return (
    <div className="overflow-auto rounded-lg border border-slate-200" style={{ maxHeight: "calc(100vh - 260px)" }}>
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="sticky top-0 z-10 bg-slate-800 text-white">
            {/* Group label column — also sticky horizontally */}
            <th className="sticky left-0 z-20 bg-slate-800 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide">
              <div className="w-[140px] truncate">House / Room</div>
            </th>
            {COL_HEADERS.map((header) => (
              <th
                key={header}
                className="bg-slate-800 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide last:pr-4"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {project.houses.map((house) => {
            const houseBudget = houseBudgetByHouseId.get(house.id);
            // Compute house-level totals across all rooms
            let houseAllocatedTotal = 0;

            const houseRows = house.rooms.map((room) => {
              const roomBudget = roomBudgetByRoomId.get(room.id);
              const roomPlanned = roomBudget?.totalBudget ?? null;
              let roomAllocatedTotal = 0;

              const objectRows = room.objects.map((obj) => {
                const selectedOption =
                  obj.productOptions.find((opt) => opt.id === obj.selectedProductId) ?? undefined;
                const qty = Math.max(1, obj.quantity || 1);
                const unitPrice = selectedOption?.price;
                const total = unitPrice !== undefined ? qty * unitPrice : undefined;
                const allowance = obj.budgetAllowance ?? null;

                let deltaClass = "text-slate-400";
                let deltaDisplay = "—";
                if (total !== undefined && allowance !== null) {
                  const delta = total - allowance;
                  deltaDisplay =
                    (delta >= 0 ? "+" : "") +
                    formatCurrency(delta, currency);
                  deltaClass = delta <= 0 ? "text-green-600" : "text-red-600";
                }

                const workflowStage = getObjectWorkflowStage(obj);
                const workflowLabel = getWorkflowStageLabel(workflowStage);

                if (total !== undefined) {
                  roomAllocatedTotal += total;
                }

                return (
                  <tr
                    key={obj.id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 hover:bg-slate-50" />
                    <td className="px-3 py-2 font-medium text-slate-800">
                      <div className="w-[160px] truncate" title={obj.name}>{obj.name}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      <div className="w-[110px] truncate" title={obj.category ?? ""}>{obj.category}</div>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      <div className="w-[40px] text-right">{qty}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      <div className="w-[180px] truncate" title={selectedOption?.name ?? ""}>{selectedOption?.name ?? "—"}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      <div className="w-[140px] truncate" title={selectedOption?.supplier ?? ""}>{selectedOption?.supplier ?? "—"}</div>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      <div className="w-[90px] text-right">{unitPrice !== undefined ? formatCurrency(unitPrice, currency) : "—"}</div>
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-slate-800">
                      <div className="w-[90px] text-right">{total !== undefined ? formatCurrency(total, currency) : "—"}</div>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">
                      <div className="w-[90px] text-right">{allowance !== null ? formatCurrency(allowance, currency) : "—"}</div>
                    </td>
                    <td className={`px-3 py-2 text-right font-medium ${deltaClass}`}>
                      <div className="w-[90px] text-right">{deltaDisplay}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      <div className="w-[110px] truncate" title={workflowLabel}>{workflowLabel}</div>
                    </td>
                    <td className="px-3 py-2">
                      <BooleanBadge value={obj.poApproved} />
                    </td>
                    <td className="px-3 py-2">
                      <BooleanBadge value={obj.ordered} />
                    </td>
                    <td className="px-3 py-2 pr-4">
                      <BooleanBadge value={obj.installed} />
                    </td>
                  </tr>
                );
              });

              houseAllocatedTotal += roomAllocatedTotal;

              const roomRemaining =
                roomPlanned !== null ? roomPlanned - roomAllocatedTotal : null;
              const roomRemainingClass =
                roomRemaining === null
                  ? "text-slate-400"
                  : roomRemaining >= 0
                  ? "text-green-600"
                  : "text-red-600";

              return (
                <React.Fragment key={room.id}>
                  {/* Room sub-header */}
                  <tr className="bg-slate-200">
                    <td
                      colSpan={COL_HEADERS.length + 1}
                      className="sticky left-0 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600"
                    >
                      {room.name}
                    </td>
                  </tr>

                  {objectRows}

                  {/* Room subtotal row */}
                  <tr className="border-b border-teal-100 bg-teal-50 font-medium">
                    <td className="sticky left-0 z-10 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-700">
                      {room.name} subtotal
                    </td>
                    {/* Object name */}
                    <td />
                    {/* Category */}
                    <td />
                    {/* Qty */}
                    <td />
                    {/* Material */}
                    <td />
                    {/* Supplier */}
                    <td />
                    {/* Unit price */}
                    <td />
                    {/* Total */}
                    <td className="whitespace-nowrap px-3 py-2 text-right text-teal-800">
                      {formatCurrency(roomAllocatedTotal, currency)}
                    </td>
                    {/* Budget allowance = room planned budget */}
                    <td className="whitespace-nowrap px-3 py-2 text-right text-slate-600">
                      {roomPlanned !== null ? formatCurrency(roomPlanned, currency) : "—"}
                    </td>
                    {/* vs. Allowance = remaining */}
                    <td className={`whitespace-nowrap px-3 py-2 text-right ${roomRemainingClass}`}>
                      {roomRemaining !== null
                        ? (roomRemaining >= 0 ? "+" : "") + formatCurrency(roomRemaining, currency)
                        : "—"}
                    </td>
                    {/* Workflow */}
                    <td />
                    {/* PO approved */}
                    <td />
                    {/* Ordered */}
                    <td />
                    {/* Installed */}
                    <td />
                  </tr>
                </React.Fragment>
              );
            });

            const houseRemaining = houseBudget
              ? houseBudget.totalBudget - houseAllocatedTotal
              : null;
            const houseRemainingClass =
              houseRemaining === null
                ? "text-slate-400"
                : houseRemaining >= 0
                ? "text-green-600"
                : "text-red-600";

            return (
              <React.Fragment key={house.id}>
                {/* House group header */}
                <tr className="bg-slate-800 text-white">
                  <td
                    colSpan={COL_HEADERS.length + 1}
                    className="sticky left-0 bg-slate-800 px-3 py-2.5 text-sm font-bold uppercase tracking-wide"
                  >
                    {house.name}
                  </td>
                </tr>

                {houseRows}

                {/* House subtotal row */}
                <tr key={`house-subtotal-${house.id}`} className="border-b border-teal-200 bg-teal-50 font-medium">
                  <td className="sticky left-0 z-10 bg-teal-50 px-3 py-2 text-sm font-bold text-teal-800">
                    {house.name} total
                  </td>
                  {/* Object name */}
                  <td />
                  {/* Category */}
                  <td />
                  {/* Qty */}
                  <td />
                  {/* Material */}
                  <td />
                  {/* Supplier */}
                  <td />
                  {/* Unit price */}
                  <td />
                  {/* Total */}
                  <td className="whitespace-nowrap px-3 py-2 text-right font-bold text-teal-900">
                    {formatCurrency(houseAllocatedTotal, currency)}
                  </td>
                  {/* Budget allowance = house planned budget */}
                  <td className="whitespace-nowrap px-3 py-2 text-right text-slate-600">
                    {houseBudget ? formatCurrency(houseBudget.totalBudget, currency) : "—"}
                  </td>
                  {/* vs. Allowance */}
                  <td className={`whitespace-nowrap px-3 py-2 text-right font-bold ${houseRemainingClass}`}>
                    {houseRemaining !== null
                      ? (houseRemaining >= 0 ? "+" : "") + formatCurrency(houseRemaining, currency)
                      : "—"}
                  </td>
                  {/* Workflow */}
                  <td />
                  {/* PO approved */}
                  <td />
                  {/* Ordered */}
                  <td />
                  {/* Installed */}
                  <td />
                </tr>
              </React.Fragment>
            );
          })}

          {/* Project total row */}
          {(() => {
            const projectAllocated = budget.allocatedAmount;
            const projectTotal = budget.totalBudget;
            const projectRemaining = budget.remainingAmount;
            const projectRemainingClass =
              projectRemaining >= 0 ? "text-green-600" : "text-red-600";

            return (
              <tr className="border-t-2 border-slate-300 bg-slate-800 text-white">
                <td className="sticky left-0 z-10 bg-slate-800 px-3 py-3 text-sm font-bold uppercase tracking-wide">
                  Project total
                </td>
                {/* Object name */}
                <td />
                {/* Category */}
                <td />
                {/* Qty */}
                <td />
                {/* Material */}
                <td />
                {/* Supplier */}
                <td />
                {/* Unit price */}
                <td />
                {/* Total */}
                <td className="whitespace-nowrap px-3 py-3 text-right text-base font-bold">
                  {formatCurrency(projectAllocated, currency)}
                </td>
                {/* Budget allowance */}
                <td className="whitespace-nowrap px-3 py-3 text-right text-slate-300">
                  {formatCurrency(projectTotal, currency)}
                </td>
                {/* vs. Allowance */}
                <td className={`whitespace-nowrap px-3 py-3 text-right text-base font-bold ${projectRemainingClass}`}>
                  {(projectRemaining >= 0 ? "+" : "") + formatCurrency(projectRemaining, currency)}
                </td>
                {/* Workflow */}
                <td />
                {/* PO approved */}
                <td />
                {/* Ordered */}
                <td />
                {/* Installed */}
                <td />
              </tr>
            );
          })()}
        </tbody>
      </table>
    </div>
  );
}
