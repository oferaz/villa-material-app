import { Badge } from "@/components/ui/badge";
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
    toneClass: "border-slate-200 bg-slate-50 text-slate-700",
    countKey: "materialAssigned",
  },
  {
    stage: "po_approved",
    label: "PO approved",
    toneClass: "border-slate-200 bg-slate-50 text-slate-700",
    countKey: "poApproved",
  },
  {
    stage: "ordered",
    label: "ordered",
    toneClass: "border-slate-200 bg-slate-50 text-slate-700",
    countKey: "ordered",
  },
  {
    stage: "installed",
    label: "installed",
    toneClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    countKey: "installed",
  },
];

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
          <Badge variant="danger">{summary.stages.materialMissing} unassigned</Badge>
          <Badge variant="secondary">{summary.stages.materialAssigned} assigned</Badge>
          <Badge variant="secondary">{summary.stages.poApproved} PO</Badge>
          <Badge variant="secondary">{summary.stages.ordered} ordered</Badge>
          <Badge variant="success">{summary.stages.installed} installed</Badge>
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
            const isSelected = selectedStages.includes(item.stage);
            const isInteractive = Boolean(onToggleStage);

            if (isInteractive) {
              return (
                <button
                  key={item.stage}
                  type="button"
                  onClick={() => onToggleStage(item.stage)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-left transition hover:shadow-sm",
                    item.toneClass,
                    isSelected ? "border-slate-900 bg-white text-slate-900 shadow-sm" : ""
                  )}
                  aria-pressed={isSelected}
                >
                  {count} {item.label}
                </button>
              );
            }

            return (
              <div key={item.stage} className={cn("rounded-md border px-2 py-1", item.toneClass)}>
                {count} {item.label}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-slate-500">
          Remaining work: {summary.actionsRemaining} actions (assign, approve, order, install).
        </p>
      </CardContent>
    </Card>
  );
}
