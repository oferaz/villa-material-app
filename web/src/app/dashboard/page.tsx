import Link from "next/link";
import { mockProjects } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-gray-600">Projects shell with mock data.</p>
        </div>
        <Link href="/login" className="text-sm text-blue-600 underline">
          Login page
        </Link>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {mockProjects.map((project) => (
          <Card key={project.id}>
            <CardHeader>
              <CardTitle>{project.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">Customer: {project.customer}</p>
              <p className="mt-1 text-sm text-gray-600">Houses: {project.houses.length}</p>
              <Link href={`/projects/${project.id}`} className="mt-3 inline-block text-sm text-blue-600 underline">
                Open project
              </Link>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
