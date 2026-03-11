"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Building2, Home } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { TopNav } from "@/components/layout/top-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { mockProjects } from "@/lib/mock/projects";

export default function DashboardPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return mockProjects;
    }
    return mockProjects.filter((project) => {
      return project.name.toLowerCase().includes(q) || project.customer.toLowerCase().includes(q);
    });
  }, [searchQuery]);

  const topNav = (
    <TopNav
      title="Materia"
      subtitle="Design and procurement workspace"
      projects={mockProjects}
      selectedProjectId={mockProjects[0]?.id}
      onProjectChange={(projectId) => router.push(`/projects/${projectId}`)}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
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
          <Badge variant="secondary">{mockProjects.length} Projects</Badge>
          <Badge variant="secondary">
            {mockProjects.reduce((acc, project) => acc + project.houses.length, 0)} Houses
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

