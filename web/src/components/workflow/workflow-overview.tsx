import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { WorkflowSummary } from "@/lib/workflow/summary";

interface WorkflowOverviewProps {
  title: string;
  summary: WorkflowSummary;
  description?: string;
  compact?: boolean;
}

export function WorkflowOverview({ title, summary, description, compact = false }: WorkflowOverviewProps) {
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
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
          <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-red-700">
            {summary.stages.materialMissing} unassigned
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700">
            {summary.stages.materialAssigned} assigned
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700">
            {summary.stages.poApproved} PO approved
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700">
            {summary.stages.ordered} ordered
          </div>
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">
            {summary.stages.installed} installed
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Remaining work: {summary.actionsRemaining} actions (assign, approve, order, install).
        </p>
      </CardContent>
    </Card>
  );
}

