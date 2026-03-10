"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TopNav } from "@/components/projects/top-nav";
import { HouseRoomTree } from "@/components/rooms/house-room-tree";
import { RoomObjectsPanel } from "@/components/rooms/room-objects-panel";
import { ProductOptionsPanel } from "@/components/products/product-options-panel";
import { mockProjects } from "@/lib/mock-data";
import { Project } from "@/types";

interface ProjectWorkspaceProps {
  initialProjectId: string;
}

export function ProjectWorkspace({ initialProjectId }: ProjectWorkspaceProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>(() => structuredClone(mockProjects));
  const [searchQuery, setSearchQuery] = useState("");

  const project = useMemo(() => {
    return projects.find((item) => item.id === initialProjectId) || projects[0];
  }, [initialProjectId, projects]);

  const [selectedHouseId, setSelectedHouseId] = useState<string>(() => project?.houses[0]?.id || "");
  const [selectedRoomId, setSelectedRoomId] = useState<string>(() => project?.houses[0]?.rooms[0]?.id || "");
  const [selectedObjectId, setSelectedObjectId] = useState<string>("");

  useEffect(() => {
    if (!project) {
      return;
    }
    const fallbackHouse = project.houses.find((house) => house.id === selectedHouseId) || project.houses[0];
    const fallbackRoom = fallbackHouse?.rooms.find((room) => room.id === selectedRoomId) || fallbackHouse?.rooms[0];

    if (fallbackHouse && fallbackHouse.id !== selectedHouseId) {
      setSelectedHouseId(fallbackHouse.id);
    }
    if (fallbackRoom && fallbackRoom.id !== selectedRoomId) {
      setSelectedRoomId(fallbackRoom.id);
    }
    if (!selectedObjectId && fallbackRoom?.objects[0]) {
      setSelectedObjectId(fallbackRoom.objects[0].id);
    }
  }, [project, selectedHouseId, selectedRoomId, selectedObjectId]);

  const selectedHouse = useMemo(() => {
    return project?.houses.find((house) => house.id === selectedHouseId) || project?.houses[0];
  }, [project, selectedHouseId]);

  const selectedRoom = useMemo(() => {
    return selectedHouse?.rooms.find((room) => room.id === selectedRoomId) || selectedHouse?.rooms[0];
  }, [selectedHouse, selectedRoomId]);

  const selectedObject = useMemo(() => {
    return selectedRoom?.objects.find((obj) => obj.id === selectedObjectId) || selectedRoom?.objects[0];
  }, [selectedObjectId, selectedRoom]);

  function handleProjectChange(projectId: string) {
    router.push(`/projects/${projectId}`);
  }

  function handleSelectRoom(houseId: string, roomId: string) {
    setSelectedHouseId(houseId);
    setSelectedRoomId(roomId);

    const house = project?.houses.find((item) => item.id === houseId);
    const room = house?.rooms.find((item) => item.id === roomId);
    setSelectedObjectId(room?.objects[0]?.id || "");
  }

  function handleRenameRoom(roomId: string, nextName: string) {
    setProjects((prev) => {
      return prev.map((item) => {
        if (item.id !== project?.id) {
          return item;
        }
        return {
          ...item,
          houses: item.houses.map((house) => ({
            ...house,
            rooms: house.rooms.map((room) =>
              room.id === roomId
                ? {
                    ...room,
                    name: nextName,
                  }
                : room
            ),
          })),
        };
      });
    });
  }

  function handleSelectObject(objectId: string) {
    setSelectedObjectId(objectId);
  }

  if (!project) {
    return <main className="p-6">No project found.</main>;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <TopNav
        projects={projects}
        selectedProjectId={project.id}
        onProjectChange={handleProjectChange}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <section className="grid min-h-[calc(100vh-65px)] grid-cols-1 gap-4 p-4 lg:grid-cols-[280px_minmax(0,1fr)_360px] lg:p-6">
        <aside className="rounded-lg border border-border bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">Houses / Rooms</h2>
          <HouseRoomTree
            houses={project.houses}
            selectedHouseId={selectedHouse?.id || ""}
            selectedRoomId={selectedRoom?.id || ""}
            onSelectRoom={handleSelectRoom}
            onRenameRoom={handleRenameRoom}
            searchQuery={searchQuery}
          />
        </aside>

        <section className="min-h-[400px]">
          <RoomObjectsPanel
            room={selectedRoom}
            selectedObjectId={selectedObject?.id || ""}
            onSelectObject={handleSelectObject}
            searchQuery={searchQuery}
          />
        </section>

        <aside className="min-h-[400px]">
          <ProductOptionsPanel roomObject={selectedObject} />
        </aside>
      </section>
    </main>
  );
}
