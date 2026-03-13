"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Building2, Home } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { TopNav } from "@/components/layout/top-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { mockProjects } from "@/lib/mock/projects";
import { loadProjectsForWorkspace } from "@/lib/supabase/projects-repository";
import { supabase } from "@/lib/supabase/client";
import { Project } from "@/types";

export default function DashboardPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [projects, setProjects] = useState<Project[]>(() => structuredClone(mockProjects));

  useEffect(() => {
    let isCancelled = false;

    async function loadProjects() {
      const loadedProjects = await loadProjectsForWorkspace();
      if (!isCancelled && loadedProjects.length > 0) {
        setProjects(loadedProjects);
      }
    }

    void loadProjects();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadProjects();
    });

    return () => {
      isCancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return projects;
    }
    return projects.filter((project) => {
      return project.name.toLowerCase().includes(q) || project.customer.toLowerCase().includes(q);
    });
  }, [projects, searchQuery]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const topNav = (
    <TopNav
      title="Materia"
      subtitle="Design and procurement workspace"
      projects={projects}
      selectedProjectId={projects[0]?.id}
      onProjectChange={(projectId) => router.push(`/projects/${projectId}`)}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onSignOut={handleSignOut}
    />
  );

  const main = (
    <div className="space-y-5">
      <Card className="border-slate-200 bg-gradient-to-r from-white to-slate-50">
        <CardHeader>
          <CardTitle className="text-2xl">Project Dashboard</CardTitle>
          <CardDescription>
            Fast overview of active villa projects, room scope, and customer context.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant="secondary">{projects.length} Projects</Badge>
          <Badge variant="secondary">
            {projects.reduce((acc, project) => acc + project.houses.length, 0)} Houses
          </Badge>
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredProjects.map((project) => (
          <Card key={project.id} className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-md bg-slate-100">
                <Building2 className="h-4 w-4 text-slate-700" />
              </div>
              <CardTitle>{project.name}</CardTitle>
              <CardDescription>{project.customer}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              <p className="inline-flex items-center gap-2">
                <Home className="h-4 w-4" />
                {project.houses.length} houses
              </p>
              <p>
                {project.houses.reduce((acc, house) => acc + house.rooms.length, 0)} rooms •{" "}
                {project.houses.reduce(
                  (acc, house) => acc + house.rooms.reduce((roomAcc, room) => roomAcc + room.objects.length, 0),
                  0
                )} objects
              </p>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full justify-between">
                <Link href={`/projects/${project.id}`}>
                  Open workspace
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </section>
    </div>
  );

  return <AppShell topNav={topNav} main={main} />;
}

