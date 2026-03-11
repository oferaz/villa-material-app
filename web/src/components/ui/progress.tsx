import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  indicatorClassName?: string;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, indicatorClassName, value = 0, ...props }, ref) => {
    const safeValue = Math.max(0, Math.min(100, value));

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={safeValue}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn("relative h-2 w-full overflow-hidden rounded-full bg-slate-100", className)}
        {...props}
      >
        <div
          className={cn("h-full rounded-full bg-primary transition-all", indicatorClassName)}
          style={{ width: `${safeValue}%` }}
        />
      </div>
    );
  }
);

Progress.displayName = "Progress";

export { Progress };
