"use client";

import { Project } from "@/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProjectSwitcherProps {
  projects: Project[];
  selectedProjectId: string;
  onProjectChange: (projectId: string) => void;
}

export function ProjectSwitcher({ projects, selectedProjectId, onProjectChange }: ProjectSwitcherProps) {
  const selectedProject = projects.find((project) => project.id === selectedProjectId) || projects[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="min-w-[220px] justify-start">
          <span className="truncate">{selectedProject?.name || "Select project"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {projects.map((project) => (
          <DropdownMenuItem key={project.id} onClick={() => onProjectChange(project.id)}>
            {project.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

