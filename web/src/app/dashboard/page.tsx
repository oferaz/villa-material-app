"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Building2, Home, MessageSquareText, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { NewProjectWizardPayload, TopNav } from "@/components/layout/top-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteProjectById, loadProjectsForWorkspace } from "@/lib/supabase/projects-repository";
import { createProjectWithWizard } from "@/lib/supabase/projects-wizard";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { Project } from "@/types";

export default function DashboardPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [isAuthChecked, setIsAuthChecked] = useState(!isSupabaseConfigured);
  const [isSignedIn, setIsSignedIn] = useState(!isSupabaseConfigured);
  const [isCreatingDemoProject, setIsCreatingDemoProject] = useState(false);
  const feedbackUrl = process.env.NEXT_PUBLIC_FEEDBACK_URL?.trim() || "";

  useEffect(() => {
    let isCancelled = false;

    async function loadProjects() {
      if (isSupabaseConfigured) {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (isCancelled) {
          return;
        }

        const signedIn = Boolean(session);
        setIsSignedIn(signedIn);
        setIsAuthChecked(true);

        if (!signedIn) {
          setProjects([]);
          return;
        }
      }

      const loadedProjects = await loadProjectsForWorkspace();
      if (!isCancelled) {
        setProjects(loadedProjects);
      }
    }

    void loadProjects();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        void loadProjects();
      }
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

  async function handleCreateProject(payload: NewProjectWizardPayload) {
    const projectId = await createProjectWithWizard({
      name: payload.name,
      clientName: payload.clientName,
      location: payload.location,
      houseNames: payload.houseNames,
      houseSizesSqm: payload.houseSizesSqm,
    });

    const loadedProjects = await loadProjectsForWorkspace();
    setProjects(loadedProjects);
    router.push(`/projects/${projectId}`);
  }

  async function handleDeleteProject(projectId: string) {
    await deleteProjectById(projectId);
    const loadedProjects = await loadProjectsForWorkspace();
    setProjects(loadedProjects);
  }

  async function handleCreateDemoProject() {
    if (!isSupabaseConfigured || !isSignedIn || isCreatingDemoProject) {
      return;
    }

    setIsCreatingDemoProject(true);
    try {
      const projectId = await createProjectWithWizard({
        name: "Demo Villa Starter",
        clientName: "Demo Family",
        location: "Abu Dhabi",
        houseNames: ["Main Villa", "Guest House"],
        houseSizesSqm: [360, 120],
      });

      const loadedProjects = await loadProjectsForWorkspace();
      setProjects(loadedProjects);
      router.push(`/projects/${projectId}`);
    } finally {
      setIsCreatingDemoProject(false);
    }
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
      onCreateProject={isSupabaseConfigured && isSignedIn ? handleCreateProject : undefined}
      onDeleteProject={isSupabaseConfigured && isSignedIn ? handleDeleteProject : undefined}
    />
  );

  if (isSupabaseConfigured && !isAuthChecked) {
    return <main className="p-6">Checking session...</main>;
  }

  if (isSupabaseConfigured && isAuthChecked && !isSignedIn) {
    return (
      <AppShell
        topNav={topNav}
        main={
          <Card className="mx-auto mt-6 max-w-xl border-slate-200">
            <CardHeader>
              <CardTitle>Sign in required</CardTitle>
              <CardDescription>Project data is protected. Please sign in to continue.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button type="button" onClick={() => router.push("/login")}>
                Go to login
              </Button>
            </CardContent>
          </Card>
        }
      />
    );
  }

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

      {projects.length === 0 ? (
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-slate-50">
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-blue-600" />
              Start with demo content
            </CardTitle>
            <CardDescription>
              Create a sample project with houses so first-time users can explore the full flow immediately.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void handleCreateDemoProject()} disabled={isCreatingDemoProject}>
              {isCreatingDemoProject ? "Creating demo..." : "Create demo project"}
            </Button>
            {feedbackUrl ? (
              <Button type="button" variant="outline" asChild>
                <a href={feedbackUrl} target="_blank" rel="noreferrer">
                  <MessageSquareText className="h-4 w-4" />
                  Send feedback
                </a>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

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
                {project.houses.reduce((acc, house) => acc + house.rooms.length, 0)} rooms -{" "}
                {project.houses.reduce(
                  (acc, house) =>
                    acc +
                    house.rooms.reduce(
                      (roomAcc, room) =>
                        roomAcc + room.objects.reduce((objAcc, objectItem) => objAcc + Math.max(1, objectItem.quantity), 0),
                      0
                    ),
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

      {projects.length > 0 && filteredProjects.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="py-6 text-sm text-slate-600">
            No projects match your search. Try a different name or clear the search box.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );

  return <AppShell topNav={topNav} main={main} />;
}
