import { RealCanvasWorkspace } from "@/components/mockup/real-canvas-workspace";

interface CanvasPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function CanvasPage({ params }: CanvasPageProps) {
  const { projectId } = await params;
  return <RealCanvasWorkspace projectId={projectId} />;
}
