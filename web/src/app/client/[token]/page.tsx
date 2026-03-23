import { PublicClientView } from "@/components/client-view/public-client-view";

interface ClientViewPageProps {
  params: Promise<{ token: string }>;
}

export default async function ClientViewPage({ params }: ClientViewPageProps) {
  const { token } = await params;
  return <PublicClientView token={token} />;
}

