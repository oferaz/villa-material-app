"use client";

import { ReactNode, useEffect, useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface WorkspaceShellProps {
  projectName: string;
  customer: string;
  location: string;
  housesCount: number;
  roomsCount: number;
  objectsCount: number;
  activeTab: "rooms" | "materials" | "budget" | "client";
  onTabChange: (value: "rooms" | "materials" | "budget" | "client") => void;
  onRenameProject?: (nextName: string) => Promise<void> | void;
  onDeleteProject?: () => Promise<void> | void;
  roomsContent: ReactNode;
  materialsContent: ReactNode;
  budgetContent: ReactNode;
  clientContent: ReactNode;
}

export function WorkspaceShell({
  projectName,
  customer,
  location,
  housesCount,
  roomsCount,
  objectsCount,
  activeTab,
  onTabChange,
  onRenameProject,
  onDeleteProject,
  roomsContent,
  materialsContent,
  budgetContent,
  clientContent,
}: WorkspaceShellProps) {
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState(projectName);
  const [isSavingProjectName, setIsSavingProjectName] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState(false);

  useEffect(() => {
    if (!isEditingProjectName) {
      setProjectNameDraft(projectName);
    }
  }, [isEditingProjectName, projectName]);

  async function handleSaveProjectName() {
    if (!onRenameProject) {
      setIsEditingProjectName(false);
      return;
    }

    const normalizedName = projectNameDraft.trim();
    if (!normalizedName) {
      setProjectNameDraft(projectName);
      setIsEditingProjectName(false);
      return;
    }

    if (normalizedName === projectName) {
      setIsEditingProjectName(false);
      return;
    }

    setIsSavingProjectName(true);
    try {
      await onRenameProject(normalizedName);
      setIsEditingProjectName(false);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to rename project.");
    } finally {
      setIsSavingProjectName(false);
    }
  }

  function handleCancelProjectRename() {
    setProjectNameDraft(projectName);
    setIsEditingProjectName(false);
  }

  async function handleDeleteProject() {
    if (!onDeleteProject) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${projectName}"?\n\nThis will remove all houses, rooms, objects, and budget data in this project.`
    );
    if (!confirmed) {
      return;
    }

    setIsDeletingProject(true);
    try {
      await onDeleteProject();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to delete project.");
    } finally {
      setIsDeletingProject(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 bg-gradient-to-r from-white to-slate-50 shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            {isEditingProjectName ? (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Input
                  autoFocus
                  value={projectNameDraft}
                  onChange={(event) => setProjectNameDraft(event.target.value)}
                  className="h-10 max-w-xl text-lg font-semibold"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleSaveProjectName();
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      handleCancelProjectRename();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => void handleSaveProjectName()}
                  disabled={isSavingProjectName}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleCancelProjectRename}
                  disabled={isSavingProjectName}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <CardTitle className="truncate text-2xl">{projectName}</CardTitle>
                  {onRenameProject ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-600"
                      onClick={() => setIsEditingProjectName(true)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
                {onDeleteProject ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 border-rose-200 text-rose-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-800"
                    onClick={() => void handleDeleteProject()}
                    disabled={isDeletingProject}
                  >
                    <Trash2 className="h-4 w-4" />
                    {isDeletingProject ? "Deleting..." : "Delete project"}
                  </Button>
                ) : null}
              </div>
            )}
          </div>
          <CardDescription>
            {customer} - {location}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <span>{housesCount} houses</span>
          <Separator orientation="vertical" className="h-4" />
          <span>{roomsCount} rooms</span>
          <Separator orientation="vertical" className="h-4" />
          <span>{objectsCount} objects</span>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="pt-5">
          <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as "rooms" | "materials" | "budget" | "client")}>
            <TabsList className="sticky top-[72px] z-20 w-full justify-start overflow-x-auto border border-slate-200 bg-white/95 shadow-sm backdrop-blur">
              <TabsTrigger value="rooms">Rooms</TabsTrigger>
              <TabsTrigger value="materials">Materials</TabsTrigger>
              <TabsTrigger value="budget">Budget</TabsTrigger>
              <TabsTrigger value="client">Client View</TabsTrigger>
            </TabsList>

            <TabsContent value="rooms">{roomsContent}</TabsContent>
            <TabsContent value="materials">{materialsContent}</TabsContent>
            <TabsContent value="budget">{budgetContent}</TabsContent>
            <TabsContent value="client">{clientContent}</TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
