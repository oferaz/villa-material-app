"use client";

import { Building2, ChevronDown, Search, UserCircle2 } from "lucide-react";
import { Project } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ProjectSwitcher } from "@/components/projects/project-switcher";

interface TopNavProps {
  title: string;
  subtitle?: string;
  projects: Project[];
  selectedProjectId?: string;
  onProjectChange?: (projectId: string) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

export function TopNav({
  title,
  subtitle,
  projects,
  selectedProjectId,
  onProjectChange,
  searchQuery,
  onSearchChange,
}: TopNavProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1800px] items-center gap-4 px-4 py-3 lg:px-6">
        <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 md:flex">
          <Building2 className="h-4 w-4 text-primary" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{title}</p>
            {subtitle ? <p className="text-[11px] text-slate-500">{subtitle}</p> : null}
          </div>
        </div>

        {projects.length > 0 && selectedProjectId && onProjectChange ? (
          <ProjectSwitcher
            projects={projects}
            selectedProjectId={selectedProjectId}
            onProjectChange={onProjectChange}
          />
        ) : (
          <div className="hidden text-sm font-semibold text-slate-700 md:block">Materia</div>
        )}

        <div className="relative ml-auto w-full max-w-xl">
          <Search className="pointer-events-none absolute left-4 top-3 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search product options..."
            className="h-10 rounded-full border-slate-300 bg-slate-50 pl-10 text-sm shadow-inner focus-visible:bg-white"
          />
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="hidden md:inline-flex">
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New project flow</DialogTitle>
              <DialogDescription>
                Project creation wizard is part of the next migration stage. This dialog is a structural placeholder.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button">Understood</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Separator orientation="vertical" className="hidden h-6 md:block" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open profile menu">
              <UserCircle2 className="h-5 w-5" />
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Designer account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Preferences</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

