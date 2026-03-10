"use client";

import { ChevronDown } from "lucide-react";
import { Project } from "@/types";

interface ProjectSwitcherProps {
  projects: Project[];
  value: string;
  onChange: (projectId: string) => void;
}

export function ProjectSwitcher({ projects, value, onChange }: ProjectSwitcherProps) {
  return (
    <div className="relative min-w-56">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full appearance-none rounded-md border border-input bg-white px-3 pr-9 text-sm"
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-gray-500" />
    </div>
  );
}
