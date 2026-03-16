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
  countKey: keyof WorkflowSummary["stages"];
}> = [
  {
    stage: "material_missing",
    label: "unassigned",
    toneClass: "border-red-200 bg-red-50 text-red-700",
    countKey: "materialMissing",
  },
  {
    stage: "material_assigned",
    label: "assigned",
    toneClass: "border-blue-200 bg-blue-50 text-blue-700",
    countKey: "materialAssigned",
  },
  {
    stage: "po_approved",
    label: "PO approved",
    toneClass: "border-amber-200 bg-amber-50 text-amber-700",
    countKey: "poApproved",
  },
  {
    stage: "ordered",
    label: "ordered",
    toneClass: "border-violet-200 bg-violet-50 text-violet-700",
    countKey: "ordered",
  },
  {
    stage: "installed",
    label: "installed",
    toneClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    countKey: "installed",
  },
];

function getStageCompleted(summary: WorkflowSummary, stage: WorkflowStage): boolean {
  if (summary.totalItems <= 0) {
    return false;
  }

  const { materialMissing, materialAssigned, poApproved, installed } = summary.stages;

  switch (stage) {
    case "material_missing":
      return materialMissing === 0;
    case "material_assigned":
      return materialMissing + materialAssigned === 0;
    case "po_approved":
      return materialMissing + materialAssigned + poApproved === 0;
    case "ordered":
      return materialMissing + materialAssigned + poApproved === 0;
    case "installed":
      return installed === summary.totalItems;
    default:
      return false;
  }
}

function getWorkflowFeedback(summary: WorkflowSummary): string {
  if (summary.totalItems <= 0) {
    return "Start by adding objects to this scope.";
  }

  const { materialMissing, materialAssigned, poApproved, ordered, installed } = summary.stages;

  if (installed === summary.totalItems) {
    return "V Great work. All objects are installed.";
  }
  if (ordered > 0) {
    return `V Ordering stage done. ${ordered} item(s) are waiting for installation.`;
  }
  if (poApproved > 0) {
    return `V PO approval stage done. ${poApproved} item(s) are ready to order.`;
  }
  if (materialAssigned > 0) {
    return `V Material assignment done. ${materialAssigned} item(s) are waiting for PO approval.`;
  }
  if (materialMissing > 0) {
    return `${materialMissing} item(s) still need material assignment.`;
  }

  return "Progress is moving forward.";
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
      <div className="space-y-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
          <span className="text-xs font-semibold text-slate-700">{summary.completionPercent}% complete</span>
        </div>
        <Progress value={summary.completionPercent} />
        <div className="flex flex-wrap items-center gap-1.5">
          {workflowStageConfig.map((item) => {
            const stageCompleted = getStageCompleted(summary, item.stage);
            return (
              <span
                key={item.stage}
                className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", item.toneClass)}
              >
                {stageCompleted ? "V " : ""}
                {summary.stages[item.countKey]} {item.label}
              </span>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-500">{getWorkflowFeedback(summary)}</p>
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
            const isSelected = selectedStages.includes(item.stage);
            const isInteractive = Boolean(onToggleStage);
            const stageCompleted = getStageCompleted(summary, item.stage);

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
                  {stageCompleted ? "V " : ""}
                  {count} {item.label}
                </button>
              );
            }

            return (
              <div key={item.stage} className={cn("rounded-md border px-2 py-1", item.toneClass)}>
                {stageCompleted ? "V " : ""}
                {count} {item.label}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-slate-500">{getWorkflowFeedback(summary)}</p>
      </CardContent>
    </Card>
  );
}
