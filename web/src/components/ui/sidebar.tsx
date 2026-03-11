import { cn } from "@/lib/utils";

interface SidebarProps {
  className?: string;
  children: React.ReactNode;
}

export function Sidebar({ className, children }: SidebarProps) {
  return <aside className={cn("rounded-xl border bg-white p-4 shadow-sm", className)}>{children}</aside>;
}

