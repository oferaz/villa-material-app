"use client";

import { Search } from "lucide-react";
import { Project } from "@/types";
import { Input } from "@/components/ui/input";
import { ProjectSwitcher } from "@/components/projects/project-switcher";

interface TopNavProps {
  projects: Project[];
  selectedProjectId: string;
  onProjectChange: (projectId: string) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

export function TopNav({
  projects,
  selectedProjectId,
  onProjectChange,
  searchQuery,
  onSearchChange,
}: TopNavProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-white/95 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
        <div className="rounded bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground">Materia</div>
        <ProjectSwitcher projects={projects} value={selectedProjectId} onChange={onProjectChange} />
        <div className="relative ml-auto w-full max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search rooms, objects, suppliers..."
            className="pl-9"
          />
        </div>
      </div>
    </header>
  );
}
