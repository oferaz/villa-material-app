import { RealCanvasWorkspace } from "@/components/mockup/real-canvas-workspace";

interface ProjectPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;
  return <RealCanvasWorkspace projectId={projectId} />;
}

