import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { WorkflowSummary } from "@/lib/workflow/summary";
import { cn } from "@/lib/utils";
import { WorkflowStage } from "@/types";

interface WorkflowOverviewProps {
  title: string;
  summary: WorkflowSummary;
  description?: string;
  compact?: boolean;
  selectedStages?: WorkflowStage[];
  onToggleStage?: (stage: WorkflowStage) => void;
  onClearStageFilter?: () => void;
}

const workflowStageConfig: Array<{
  stage: WorkflowStage;
  label: string;
  toneClass: string;
  fillClass: string;
  countKey: keyof WorkflowSummary["stages"];
}> = [
  {
    stage: "material_missing",
    label: "unassigned",
    toneClass: "border-slate-200 bg-slate-50/80 text-slate-700",
    fillClass: "bg-slate-300",
    countKey: "materialMissing",
  },
  {
    stage: "material_assigned",
    label: "assigned",
    toneClass: "border-slate-200 bg-slate-50/80 text-slate-700",
    fillClass: "bg-sky-300",
    countKey: "materialAssigned",
  },
  {
    stage: "po_approved",
    label: "PO approved",
    toneClass: "border-slate-200 bg-slate-50/80 text-slate-700",
    fillClass: "bg-sky-400",
    countKey: "poApproved",
  },
  {
    stage: "ordered",
    label: "ordered",
    toneClass: "border-slate-200 bg-slate-50/80 text-slate-700",
    fillClass: "bg-sky-500",
    countKey: "ordered",
  },
  {
    stage: "installed",
    label: "installed",
    toneClass: "border-slate-200 bg-slate-50/80 text-slate-700",
    fillClass: "bg-sky-600",
    countKey: "installed",
  },
];

function getStageRatio(summary: WorkflowSummary, count: number): string {
  if (summary.totalItems <= 0) {
    return "0/0";
  }
  return `${count}/${summary.totalItems}`;
}

function getStageFillPercent(summary: WorkflowSummary, count: number): number {
  if (summary.totalItems <= 0) {
    return 0;
  }
  return Math.round((count / summary.totalItems) * 100);
}

function getWorkflowFilterSummary(selectedStages: WorkflowStage[]): string {
  if (selectedStages.length === 0) {
    return "Showing all statuses";
  }
  const labels = workflowStageConfig
    .filter((item) => selectedStages.includes(item.stage))
    .map((item) => item.label);
  return `Filtered by: ${labels.join(", ")}`;
}

export function WorkflowOverview({
  title,
  summary,
  description,
  compact = false,
  selectedStages = [],
  onToggleStage,
  onClearStageFilter,
}: WorkflowOverviewProps) {
  if (compact) {
    return (
      <div className="space-y-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
          <span className="text-[10px] font-semibold text-slate-700">{summary.completionPercent}%</span>
        </div>
        <Progress value={summary.completionPercent} className="h-1" />
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 sm:grid-cols-5">
          {workflowStageConfig.map((item) => {
            const count = summary.stages[item.countKey];
            const fillPercent = getStageFillPercent(summary, count);
            return (
              <div key={item.stage} className="space-y-0.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-medium text-slate-700">{item.label}</span>
                  <span className="font-semibold text-slate-600">{getStageRatio(summary, count)}</span>
                </div>
                <div className={cn("h-0.5 overflow-hidden rounded-full bg-slate-100", item.toneClass)}>
                  <div className={cn("h-full", item.fillClass)} style={{ width: `${fillPercent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">{summary.totalItems} total objects</span>
          <span className="font-semibold text-slate-800">{summary.completionPercent}% complete</span>
        </div>
        <Progress value={summary.completionPercent} />
        {onToggleStage ? (
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{getWorkflowFilterSummary(selectedStages)}</span>
            {selectedStages.length > 0 && onClearStageFilter ? (
              <button
                type="button"
                className="font-semibold text-slate-700 underline underline-offset-2 hover:text-slate-900"
                onClick={onClearStageFilter}
              >
                Clear
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
          {workflowStageConfig.map((item) => {
            const count = summary.stages[item.countKey];
            const fillPercent = getStageFillPercent(summary, count);
            const isSelected = selectedStages.includes(item.stage);
            const isInteractive = Boolean(onToggleStage);

            if (isInteractive) {
              return (
                <button
                  key={item.stage}
                  type="button"
                  onClick={() => onToggleStage?.(item.stage)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-left transition hover:shadow-sm",
                    item.toneClass,
                    isSelected ? "ring-2 ring-slate-900 ring-offset-1" : ""
                  )}
                  aria-pressed={isSelected}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-semibold">{item.label}</span>
                    <span className="font-semibold">{getStageRatio(summary, count)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full border border-slate-200/80 bg-slate-100">
                    <div className={cn("h-full", item.fillClass)} style={{ width: `${fillPercent}%` }} />
                  </div>
                </button>
              );
            }

            return (
              <div key={item.stage} className={cn("rounded-md border px-2 py-1", item.toneClass)}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-semibold">{item.label}</span>
                  <span className="font-semibold">{getStageRatio(summary, count)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full border border-slate-200/80 bg-slate-100">
                  <div className={cn("h-full", item.fillClass)} style={{ width: `${fillPercent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-slate-500">
          Stage distribution across {summary.totalItems} object{summary.totalItems === 1 ? "" : "s"}.
        </p>
      </CardContent>
    </Card>
  );
}
