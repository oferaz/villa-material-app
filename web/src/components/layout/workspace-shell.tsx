import { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface WorkspaceShellProps {
  projectName: string;
  customer: string;
  location: string;
  housesCount: number;
  roomsCount: number;
  objectsCount: number;
  activeTab: "rooms" | "materials" | "budget" | "client";
  onTabChange: (value: "rooms" | "materials" | "budget" | "client") => void;
  roomsContent: ReactNode;
  materialsContent: ReactNode;
  budgetContent: ReactNode;
  clientContent: ReactNode;
}

export function WorkspaceShell({
  projectName,
  customer,
  location,
  housesCount,
  roomsCount,
  objectsCount,
  activeTab,
  onTabChange,
  roomsContent,
  materialsContent,
  budgetContent,
  clientContent,
}: WorkspaceShellProps) {
  return (
    <div className="space-y-4">
      <Card className="border-slate-200 bg-gradient-to-r from-white to-slate-50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl">{projectName}</CardTitle>
          <CardDescription>
            {customer} - {location}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <span>{housesCount} houses</span>
          <Separator orientation="vertical" className="h-4" />
          <span>{roomsCount} rooms</span>
          <Separator orientation="vertical" className="h-4" />
          <span>{objectsCount} objects</span>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="pt-5">
          <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as "rooms" | "materials" | "budget" | "client")}>
            <TabsList className="sticky top-[72px] z-20 w-full justify-start overflow-x-auto border border-slate-200 bg-white/95 shadow-sm backdrop-blur">
              <TabsTrigger value="rooms">Rooms</TabsTrigger>
              <TabsTrigger value="materials">Materials</TabsTrigger>
              <TabsTrigger value="budget">Budget</TabsTrigger>
              <TabsTrigger value="client">Client View</TabsTrigger>
            </TabsList>

            <TabsContent value="rooms">{roomsContent}</TabsContent>
            <TabsContent value="materials">{materialsContent}</TabsContent>
            <TabsContent value="budget">{budgetContent}</TabsContent>
            <TabsContent value="client">{clientContent}</TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
