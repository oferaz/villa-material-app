"use client";

import { ReactNode, useState } from "react";
import { Menu, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface AppShellProps {
  topNav: ReactNode;
  main: ReactNode;
  sidebar?: ReactNode;
  rightPanel?: ReactNode;
  className?: string;
}

export function AppShell({ topNav, main, sidebar, rightPanel, className }: AppShellProps) {
  const hasSplitLayout = Boolean(sidebar) || Boolean(rightPanel);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);

  return (
    <div className={cn("min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-white", className)}>
      {topNav}
      <div className="mx-auto w-full max-w-[1800px] p-4 lg:p-6">
        {hasSplitLayout ? (
          <>
            <div className="fixed inset-x-2 bottom-3 z-40 flex gap-1.5 rounded-xl border border-slate-200 bg-white/95 p-1.5 shadow-lg backdrop-blur sm:inset-x-4 sm:bottom-4 sm:gap-2 sm:p-2 lg:hidden">
              {sidebar ? (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 min-w-0 bg-white px-2 text-xs sm:px-3 sm:text-sm"
                  onClick={() => setIsLeftPanelOpen(true)}
                >
                  <Menu className="h-4 w-4" />
                  <span className="truncate sm:hidden">Map</span>
                  <span className="hidden truncate sm:inline">Project Map</span>
                </Button>
              ) : null}
              {rightPanel ? (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 min-w-0 bg-white px-2 text-xs sm:px-3 sm:text-sm"
                  onClick={() => setIsRightPanelOpen(true)}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  <span className="truncate">Options</span>
                </Button>
              ) : null}
            </div>

            {sidebar ? (
              <Dialog open={isLeftPanelOpen} onOpenChange={setIsLeftPanelOpen}>
                <DialogContent className="left-0 top-0 h-dvh w-[calc(100vw-0.75rem)] max-w-[340px] translate-x-0 translate-y-0 rounded-none border-r p-0 sm:w-[88vw] sm:max-w-[420px]">
                  <DialogHeader className="border-b border-slate-200 px-4 py-3">
                    <DialogTitle className="text-base">Project Map</DialogTitle>
                  </DialogHeader>
                  <div className="h-[calc(100dvh-58px)] overflow-x-hidden overflow-y-auto p-3 sm:p-4">{sidebar}</div>
                </DialogContent>
              </Dialog>
            ) : null}

            {rightPanel ? (
              <Dialog open={isRightPanelOpen} onOpenChange={setIsRightPanelOpen}>
                <DialogContent className="left-auto right-0 top-0 h-dvh w-[calc(100vw-0.75rem)] max-w-[340px] translate-x-0 translate-y-0 rounded-none border-l p-0 sm:w-[88vw] sm:max-w-[420px]">
                  <DialogHeader className="border-b border-slate-200 px-4 py-3">
                    <DialogTitle className="text-base">Product Options</DialogTitle>
                  </DialogHeader>
                  <div className="h-[calc(100dvh-58px)] overflow-x-hidden overflow-y-auto p-3 sm:p-4">{rightPanel}</div>
                </DialogContent>
              </Dialog>
            ) : null}

            <div className="grid min-h-[calc(100vh-120px)] grid-cols-1 gap-5 pb-24 lg:grid-cols-[320px_minmax(0,1fr)_380px] lg:pb-0">
              <div className="hidden space-y-4 lg:sticky lg:top-[88px] lg:block lg:h-[calc(100vh-110px)] lg:overflow-y-auto">
                {sidebar}
              </div>
              <div className="space-y-4">{main}</div>
              <div className="hidden space-y-4 lg:sticky lg:top-[88px] lg:block lg:h-[calc(100vh-110px)] lg:overflow-hidden">
                {rightPanel}
              </div>
            </div>
          </>
        ) : (
          <div>{main}</div>
        )}
      </div>
    </div>
  );
}

