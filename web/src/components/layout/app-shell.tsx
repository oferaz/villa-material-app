"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AppShellProps {
  topNav: ReactNode;
  main: ReactNode;
  sidebar?: ReactNode;
  rightPanel?: ReactNode;
  className?: string;
}

export function AppShell({ topNav, main, sidebar, rightPanel, className }: AppShellProps) {
  const hasSplitLayout = Boolean(sidebar) || Boolean(rightPanel);

  return (
    <div className={cn("min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-white", className)}>
      {topNav}
      <div className="mx-auto w-full max-w-[1800px] p-4 lg:p-6">
        {hasSplitLayout ? (
          <div className="grid min-h-[calc(100vh-120px)] grid-cols-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)_380px]">
            <div className="space-y-4 lg:sticky lg:top-[88px] lg:h-[calc(100vh-110px)]">{sidebar}</div>
            <div className="space-y-4">{main}</div>
            <div className="space-y-4 lg:sticky lg:top-[88px] lg:h-[calc(100vh-110px)] lg:overflow-hidden">{rightPanel}</div>
          </div>
        ) : (
          <div>{main}</div>
        )}
      </div>
    </div>
  );
}

