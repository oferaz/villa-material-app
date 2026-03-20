"use client";

import { ReactNode, useEffect, useState } from "react";
import { Check, Download, History, Pencil, RotateCcw, Save, Trash2, UserPlus, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface WorkspaceShellProps {
  projectId: string;
  projectName: string;
  customer: string;
  location: string;
  housesCount: number;
  roomsCount: number;
  objectsCount: number;
  activeTab: "rooms" | "materials" | "budget" | "client";
  onTabChange: (value: "rooms" | "materials" | "budget" | "client") => void;
  onRenameProject?: (nextName: string) => Promise<void> | void;
  onExportProject?: () => Promise<void> | void;
  onDeleteProject?: () => Promise<void> | void;
  onInviteCollaborator?: (email: string, role: "viewer" | "editor") => Promise<void> | void;
  snapshotOptions?: Array<{
    id: string;
    name: string;
    createdAt: string;
  }>;
  onSaveSnapshot?: (snapshotName?: string) => Promise<void> | void;
  onRestoreSnapshot?: (snapshotId: string) => Promise<void> | void;
  roomsContent: ReactNode;
  materialsContent: ReactNode;
  budgetContent: ReactNode;
  clientContent: ReactNode;
}

function looksLikeEmail(value: string): boolean {
  const email = value.trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email);
}

function buildInviteLoginLink(projectId: string, email: string): string {
  const normalizedEmail = email.trim().toLowerCase();
  if (!projectId.trim() || !looksLikeEmail(normalizedEmail) || typeof window === "undefined") {
    return "";
  }

  let baseOrigin = window.location.origin;
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredAppUrl) {
    try {
      baseOrigin = new URL(configuredAppUrl).origin;
    } catch {
      baseOrigin = window.location.origin;
    }
  }

  const inviteUrl = new URL("/login", baseOrigin);
  inviteUrl.searchParams.set("email", normalizedEmail);
  inviteUrl.searchParams.set("next", `/projects/${projectId}`);
  return inviteUrl.toString();
}

export function WorkspaceShell({
  projectId,
  projectName,
  customer,
  location,
  housesCount,
  roomsCount,
  objectsCount,
  activeTab,
  onTabChange,
  onRenameProject,
  onExportProject,
  onDeleteProject,
  onInviteCollaborator,
  snapshotOptions = [],
  onSaveSnapshot,
  onRestoreSnapshot,
  roomsContent,
  materialsContent,
  budgetContent,
  clientContent,
}: WorkspaceShellProps) {
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState(projectName);
  const [isSavingProjectName, setIsSavingProjectName] = useState(false);
  const [isExportingProject, setIsExportingProject] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"viewer" | "editor">("viewer");
  const [isInvitingCollaborator, setIsInvitingCollaborator] = useState(false);
  const [lastInvitedEmail, setLastInvitedEmail] = useState("");
  const [isInviteLinkCopied, setIsInviteLinkCopied] = useState(false);
  const [isSnapshotsDialogOpen, setIsSnapshotsDialogOpen] = useState(false);
  const [snapshotNameDraft, setSnapshotNameDraft] = useState("");
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  const [isRestoringSnapshot, setIsRestoringSnapshot] = useState(false);

  useEffect(() => {
    if (!isEditingProjectName) {
      setProjectNameDraft(projectName);
    }
  }, [isEditingProjectName, projectName]);

  const inviteLoginLink = lastInvitedEmail ? buildInviteLoginLink(projectId, lastInvitedEmail) : "";
  const actionButtonClassName =
    "h-9 min-w-[148px] justify-center border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-100 sm:text-sm";
  const destructiveActionButtonClassName =
    "h-9 min-w-[148px] justify-center border-rose-200 px-3 text-xs text-rose-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-800 sm:text-sm";

  useEffect(() => {
    if (!isSnapshotsDialogOpen) {
      return;
    }
    if (snapshotOptions.length === 0) {
      setSelectedSnapshotId("");
      return;
    }
    const hasSelectedSnapshot = snapshotOptions.some((item) => item.id === selectedSnapshotId);
    if (!hasSelectedSnapshot) {
      setSelectedSnapshotId(snapshotOptions[0].id);
    }
  }, [isSnapshotsDialogOpen, selectedSnapshotId, snapshotOptions]);

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

  async function handleExportProject() {
    if (!onExportProject) {
      return;
    }

    setIsExportingProject(true);
    try {
      await onExportProject();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to export project.");
    } finally {
      setIsExportingProject(false);
    }
  }

  function resetInviteForm() {
    setInviteEmail("");
    setInviteRole("viewer");
    setLastInvitedEmail("");
    setIsInviteLinkCopied(false);
  }

  function handleInviteDialogOpenChange(nextOpen: boolean) {
    if (isInvitingCollaborator) {
      return;
    }
    setIsInviteDialogOpen(nextOpen);
    if (!nextOpen) {
      resetInviteForm();
    }
  }

  async function handleInviteCollaborator() {
    if (!onInviteCollaborator) {
      return;
    }

    const normalizedEmail = inviteEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      window.alert("Collaborator email is required.");
      return;
    }
    if (!looksLikeEmail(normalizedEmail)) {
      window.alert("Enter a valid email address.");
      return;
    }

    setIsInvitingCollaborator(true);
    try {
      await onInviteCollaborator(normalizedEmail, inviteRole);
      setLastInvitedEmail(normalizedEmail);
      setIsInviteLinkCopied(false);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to invite collaborator.");
    } finally {
      setIsInvitingCollaborator(false);
    }
  }

  async function handleCopyInviteLink() {
    if (!inviteLoginLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(inviteLoginLink);
      setIsInviteLinkCopied(true);
    } catch {
      window.alert("Could not copy the invite link automatically. Please copy it manually.");
    }
  }

  function handleSnapshotsDialogOpenChange(nextOpen: boolean) {
    if (isSavingSnapshot || isRestoringSnapshot) {
      return;
    }
    setIsSnapshotsDialogOpen(nextOpen);
    if (!nextOpen) {
      setSnapshotNameDraft("");
    }
  }

  async function handleSaveSnapshot() {
    if (!onSaveSnapshot) {
      return;
    }

    setIsSavingSnapshot(true);
    try {
      await onSaveSnapshot(snapshotNameDraft.trim() || undefined);
      setSnapshotNameDraft("");
      window.alert("Project state saved.");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to save project state.");
    } finally {
      setIsSavingSnapshot(false);
    }
  }

  async function handleRestoreSnapshot() {
    if (!onRestoreSnapshot) {
      return;
    }
    if (!selectedSnapshotId) {
      window.alert("Select a saved state first.");
      return;
    }

    const confirmed = window.confirm(
      "Restore this saved state?\n\nCurrent project structure and object progress will be replaced."
    );
    if (!confirmed) {
      return;
    }

    setIsRestoringSnapshot(true);
    try {
      await onRestoreSnapshot(selectedSnapshotId);
      setIsSnapshotsDialogOpen(false);
      window.alert("Project restored to the selected saved state.");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to restore project state.");
    } finally {
      setIsRestoringSnapshot(false);
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
              <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
                <div className="flex w-full flex-wrap items-stretch gap-2 sm:w-auto sm:justify-end">
                  {onInviteCollaborator ? (
                    <Button
                      type="button"
                      variant="outline"
                      className={actionButtonClassName}
                      onClick={() => setIsInviteDialogOpen(true)}
                    >
                      <UserPlus className="h-4 w-4" />
                      Invite collaborator
                    </Button>
                  ) : null}
                  {onSaveSnapshot || onRestoreSnapshot ? (
                    <Button
                      type="button"
                      variant="outline"
                      className={actionButtonClassName}
                      onClick={() => handleSnapshotsDialogOpenChange(true)}
                    >
                      <History className="h-4 w-4" />
                      Saved states
                    </Button>
                  ) : null}
                  {onExportProject ? (
                    <Button
                      type="button"
                      variant="outline"
                      className={actionButtonClassName}
                      onClick={() => void handleExportProject()}
                      disabled={isExportingProject}
                    >
                      <Download className="h-4 w-4" />
                      {isExportingProject ? "Exporting..." : "Export Excel"}
                    </Button>
                  ) : null}
                  {onDeleteProject ? (
                    <Button
                      type="button"
                      variant="outline"
                      className={destructiveActionButtonClassName}
                      onClick={() => void handleDeleteProject()}
                      disabled={isDeletingProject}
                    >
                      <Trash2 className="h-4 w-4" />
                      {isDeletingProject ? "Deleting..." : "Delete project"}
                    </Button>
                  ) : null}
                </div>
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
            <TabsList className="z-20 w-full justify-start overflow-x-auto border border-slate-200 bg-white/95 shadow-sm backdrop-blur md:sticky md:top-[72px]">
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

      <Dialog open={isInviteDialogOpen} onOpenChange={handleInviteDialogOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite collaborator</DialogTitle>
            <DialogDescription>
              Add a team member by email so they can access this project. If this customer has never logged in before,
              send them the login link after saving the invite.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="invite-email" className="text-sm font-medium text-slate-700">
                Email
              </label>
              <Input
                id="invite-email"
                type="email"
                placeholder="friend@example.com"
                value={inviteEmail}
                onChange={(event) => {
                  setInviteEmail(event.target.value);
                  setLastInvitedEmail("");
                  setIsInviteLinkCopied(false);
                }}
                disabled={isInvitingCollaborator}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleInviteCollaborator();
                  }
                }}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="invite-role" className="text-sm font-medium text-slate-700">
                Role
              </label>
              <select
                id="invite-role"
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none ring-offset-white focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value === "editor" ? "editor" : "viewer")}
                disabled={isInvitingCollaborator}
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
            </div>
            {lastInvitedEmail && inviteLoginLink ? (
              <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-emerald-900">Invite saved for {lastInvitedEmail}</p>
                  <p className="text-xs text-emerald-800">
                    Share this first-login link with the customer. After they sign in with this email, Materia will take
                    them directly to this project.
                  </p>
                </div>
                <Input value={inviteLoginLink} readOnly />
                <div className="flex justify-end">
                  <Button type="button" variant="outline" onClick={() => void handleCopyInviteLink()}>
                    {isInviteLinkCopied ? "Copied" : "Copy login link"}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleInviteDialogOpenChange(false)}
              disabled={isInvitingCollaborator}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleInviteCollaborator()} disabled={isInvitingCollaborator}>
              {isInvitingCollaborator ? "Inviting..." : "Send invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSnapshotsDialogOpen} onOpenChange={handleSnapshotsDialogOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Saved project states</DialogTitle>
            <DialogDescription>
              Save the current project state and restore a previous one whenever needed.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            {onSaveSnapshot ? (
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <label htmlFor="snapshot-name" className="text-sm font-medium text-slate-700">
                  Save current state
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    id="snapshot-name"
                    placeholder="Optional name (e.g. Before supplier changes)"
                    value={snapshotNameDraft}
                    onChange={(event) => setSnapshotNameDraft(event.target.value)}
                    disabled={isSavingSnapshot || isRestoringSnapshot}
                  />
                  <Button
                    type="button"
                    onClick={() => void handleSaveSnapshot()}
                    disabled={isSavingSnapshot || isRestoringSnapshot}
                  >
                    <Save className="h-4 w-4" />
                    {isSavingSnapshot ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <label htmlFor="restore-snapshot" className="text-sm font-medium text-slate-700">
                Restore saved state
              </label>
              <select
                id="restore-snapshot"
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none ring-offset-white focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                value={selectedSnapshotId}
                onChange={(event) => setSelectedSnapshotId(event.target.value)}
                disabled={snapshotOptions.length === 0 || isSavingSnapshot || isRestoringSnapshot}
              >
                {snapshotOptions.length === 0 ? (
                  <option value="">No saved states yet</option>
                ) : (
                  snapshotOptions.map((snapshot) => (
                    <option key={snapshot.id} value={snapshot.id}>
                      {snapshot.name} - {new Date(snapshot.createdAt).toLocaleString()}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSnapshotsDialogOpenChange(false)}
              disabled={isSavingSnapshot || isRestoringSnapshot}
            >
              Cancel
            </Button>
            {onRestoreSnapshot ? (
              <Button
                type="button"
                variant="default"
                onClick={() => void handleRestoreSnapshot()}
                disabled={
                  snapshotOptions.length === 0 || !selectedSnapshotId || isSavingSnapshot || isRestoringSnapshot
                }
              >
                <RotateCcw className="h-4 w-4" />
                {isRestoringSnapshot ? "Restoring..." : "Restore"}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
