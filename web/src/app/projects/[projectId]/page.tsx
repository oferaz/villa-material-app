import { ProjectWorkspace } from "@/components/projects/project-workspace";

interface ProjectPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;
  return <ProjectWorkspace initialProjectId={projectId} />;
}
