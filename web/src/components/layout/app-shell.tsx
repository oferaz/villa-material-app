"use client";

import { ReactNode, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Menu, SlidersHorizontal } from "lucide-react";
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
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);

  useEffect(() => {
    if (!rightPanel) {
      return;
    }

    const openRightPanel = () => setIsRightPanelOpen(true);
    const closeRightPanel = () => setIsRightPanelOpen(false);

    window.addEventListener("materia:open-right-panel", openRightPanel);
    window.addEventListener("materia:close-right-panel", closeRightPanel);

    return () => {
      window.removeEventListener("materia:open-right-panel", openRightPanel);
      window.removeEventListener("materia:close-right-panel", closeRightPanel);
    };
  }, [rightPanel]);

  const desktopGridCols = (() => {
    if (sidebar && rightPanel) {
      if (isLeftPanelCollapsed && isRightPanelCollapsed) {
        return "56px minmax(0,1fr) 56px";
      }
      if (isLeftPanelCollapsed) {
        return "56px minmax(0,3fr) minmax(0,1fr)";
      }
      if (isRightPanelCollapsed) {
        return "minmax(0,1fr) minmax(0,3fr) 56px";
      }
      return "minmax(0,1fr) minmax(0,2fr) minmax(0,1fr)";
    }

    if (sidebar) {
      return isLeftPanelCollapsed ? "56px minmax(0,1fr)" : "minmax(0,1fr) minmax(0,3fr)";
    }

    if (rightPanel) {
      return isRightPanelCollapsed ? "minmax(0,1fr) 56px" : "minmax(0,3fr) minmax(0,1fr)";
    }

    return "minmax(0,1fr)";
  })();
  const panelToggleBtnClass = "h-7 w-7 lg:h-8 lg:w-8 2xl:h-9 2xl:w-9";

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

            <div
              className="grid min-h-[calc(100vh-120px)] grid-cols-1 gap-5 pb-24 lg:[grid-template-columns:var(--desktop-grid-cols)] lg:pb-0"
              style={{ ["--desktop-grid-cols" as string]: desktopGridCols }}
            >
              {sidebar ? (
                <div className="hidden min-w-0 lg:sticky lg:top-[88px] lg:block lg:h-[calc(100vh-110px)]">
                  {isLeftPanelCollapsed ? (
                    <div className="flex h-full items-start justify-center rounded-2xl border border-slate-200 bg-white/80 p-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className={panelToggleBtnClass}
                        onClick={() => setIsLeftPanelCollapsed(false)}
                        title="Expand project map"
                      >
                        <ChevronRight className="h-4 w-4" />
                        <span className="sr-only">Expand project map</span>
                      </Button>
                    </div>
                  ) : (
                    <div className="h-full overflow-x-hidden overflow-y-auto rounded-2xl border border-slate-200 bg-white/80">
                      <div className="sticky top-0 z-20 flex justify-end border-b border-slate-200 bg-white/95 px-2 py-2 backdrop-blur">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className={panelToggleBtnClass}
                          onClick={() => setIsLeftPanelCollapsed(true)}
                          title="Minimize project map"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          <span className="sr-only">Minimize project map</span>
                        </Button>
                      </div>
                      <div className="p-2">{sidebar}</div>
                    </div>
                  )}
                </div>
              ) : null}

              <div className="min-w-0 space-y-4">{main}</div>

              {rightPanel ? (
                <div className="hidden min-w-0 lg:sticky lg:top-[88px] lg:block lg:h-[calc(100vh-110px)]">
                  {isRightPanelCollapsed ? (
                    <div className="flex h-full items-start justify-center rounded-2xl border border-slate-200 bg-white/80 p-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className={panelToggleBtnClass}
                        onClick={() => setIsRightPanelCollapsed(false)}
                        title="Expand options panel"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        <span className="sr-only">Expand options panel</span>
                      </Button>
                    </div>
                  ) : (
                    <div className="h-full overflow-x-hidden overflow-y-auto rounded-2xl border border-slate-200 bg-white/80">
                      <div className="sticky top-0 z-20 flex justify-start border-b border-slate-200 bg-white/95 px-2 py-2 backdrop-blur">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className={panelToggleBtnClass}
                          onClick={() => setIsRightPanelCollapsed(true)}
                          title="Minimize options panel"
                        >
                          <ChevronRight className="h-4 w-4" />
                          <span className="sr-only">Minimize options panel</span>
                        </Button>
                      </div>
                      <div className="p-2">{rightPanel}</div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <div>{main}</div>
        )}
      </div>
    </div>
  );
}
