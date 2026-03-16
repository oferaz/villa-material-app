"use client";

import { ComponentType, useEffect, useMemo, useState } from "react";
import { Boxes, Info, Presentation, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { NewProjectWizardPayload, TopNav } from "@/components/layout/top-nav";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { BudgetOverview } from "@/components/budget/budget-overview";
import { MaterialsGallery } from "@/components/materials/materials-gallery";
import { HouseRoomTree } from "@/components/rooms/house-room-tree";
import { ProjectRoomsStack } from "@/components/rooms/project-rooms-stack";
import { AddObjectDialog } from "@/components/rooms/add-object-dialog";
import { ProductOptionsPanel } from "@/components/products/product-options-panel";
import { WorkflowOverview } from "@/components/workflow/workflow-overview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { budgetCategoryOrder, calculateProjectBudget, createMockProjectBudget, resolveBudgetCategory } from "@/lib/mock/budget";
import { buildProductOptionFromLink, searchMockCatalogOptions } from "@/lib/mock/material-search";
import { createMockRoomObject } from "@/lib/mock/projects";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { addLinkMaterialForCurrentUser, searchMaterialsForCurrentUser } from "@/lib/supabase/materials-repository";
import {
  createHouseForProject,
  createRoomForHouse,
  deleteProjectById,
  duplicateHouseWithContents,
  loadProjectsForWorkspace,
  renameHouseById,
  renameProjectById,
  renameRoomById,
  updateRoomObjectSelectedMaterialById,
  updateRoomObjectWorkflowById,
} from "@/lib/supabase/projects-repository";
import { summarizeWorkflowForProject } from "@/lib/workflow/summary";
import { createProjectWithWizard } from "@/lib/supabase/projects-wizard";
import { BudgetCategoryName, ProductOption, Project, ProjectBudget, Room, RoomObject, RoomType } from "@/types";

interface ProjectWorkspaceProps {
  initialProjectId: string;
}

type WorkspaceTab = "rooms" | "materials" | "budget" | "client";
const ROOM_SPY_OFFSET = 190;

function PlaceholderTab({
  title,
  description,
  details,
  icon: Icon,
}: {
  title: string;
  description: string;
  details: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="border-slate-200 bg-gradient-to-br from-white to-slate-100 shadow-sm">
      <CardHeader>
        <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-md bg-slate-900 text-white">
          <Icon className="h-5 w-5" />
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="rounded-lg border border-slate-200 bg-white/80 p-3 text-sm text-slate-600">{details}</p>
      </CardContent>
    </Card>
  );
}

function RightPanelPlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <Card className="h-full border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function findRoomInProject(project: Project | undefined, roomId: string) {
  if (!project) {
    return undefined;
  }
  for (const house of project.houses) {
    const room = house.rooms.find((item) => item.id === roomId);
    if (room) {
      return { house, room };
    }
  }
  return undefined;
}

function findObjectInProject(project: Project | undefined, objectId: string) {
  if (!project) {
    return undefined;
  }
  for (const house of project.houses) {
    for (const room of house.rooms) {
      const objectItem = room.objects.find((item) => item.id === objectId);
      if (objectItem) {
        return { house, room, objectItem };
      }
    }
  }
  return undefined;
}

function normalizeWorkflowState(
  roomObject: RoomObject,
  patch: Partial<Pick<RoomObject, "poApproved" | "ordered" | "installed">>
) {
  let poApproved = patch.poApproved ?? Boolean(roomObject.poApproved);
  let ordered = patch.ordered ?? Boolean(roomObject.ordered);
  let installed = patch.installed ?? Boolean(roomObject.installed);

  if (patch.ordered === true) {
    poApproved = true;
  }
  if (patch.installed === true) {
    poApproved = true;
    ordered = true;
  }

  if (patch.poApproved === false) {
    ordered = false;
    installed = false;
  }
  if (patch.ordered === false) {
    installed = false;
  }

  if (!roomObject.selectedProductId) {
    poApproved = false;
    ordered = false;
    installed = false;
  }

  return {
    poApproved,
    ordered,
    installed,
  };
}

function isLinkOption(option: ProductOption): boolean {
  return option.sourceType === "link";
}

function createInitialBudgetMap(projects: Project[] = []): Record<string, ProjectBudget> {
  return projects.reduce<Record<string, ProjectBudget>>((acc, item) => {
    acc[item.id] = createMockProjectBudget();
    return acc;
  }, {});
}

const defaultHouseRoomBlueprint: Array<{ name: string; type: RoomType }> = [
  { name: "Entry", type: "entry" },
  { name: "Living Room", type: "living_room" },
  { name: "Kitchen", type: "kitchen" },
  { name: "Dining Room", type: "dining_room" },
  { name: "Bedroom", type: "bedroom" },
  { name: "Bathroom", type: "bathroom" },
];

export function ProjectWorkspace({ initialProjectId }: ProjectWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectBudgets, setProjectBudgets] = useState<Record<string, ProjectBudget>>(() =>
    createInitialBudgetMap([])
  );
  const [isAuthChecked, setIsAuthChecked] = useState(!isSupabaseConfigured);
  const [isSignedIn, setIsSignedIn] = useState(!isSupabaseConfigured);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("rooms");
  const [selectedHouseId, setSelectedHouseId] = useState<string>("");
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [selectedObjectId, setSelectedObjectId] = useState<string>("");
  const [addObjectRoomId, setAddObjectRoomId] = useState<string | null>(null);
  const [pendingScrollRoomId, setPendingScrollRoomId] = useState<string | null>(null);
  const [showDefaultStructureNotice, setShowDefaultStructureNotice] = useState(false);

  useEffect(() => {
    if (searchParams.get("onboarding") === "default-rooms") {
      setShowDefaultStructureNotice(true);
    }
  }, [searchParams]);

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
          setProjectBudgets({});
          return;
        }
      }

      const loadedProjects = await loadProjectsForWorkspace();
      if (isCancelled) {
        return;
      }

      setProjects(loadedProjects);
      setProjectBudgets((prev) => {
        const next = createInitialBudgetMap(loadedProjects);
        for (const [projectId, budget] of Object.entries(prev)) {
          if (next[projectId]) {
            next[projectId] = budget;
          }
        }
        return next;
      });
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

  const project = useMemo(() => {
    return projects.find((item) => item.id === initialProjectId) ?? projects[0];
  }, [projects, initialProjectId]);

  const selectedHouse = useMemo(() => {
    return project?.houses.find((house) => house.id === selectedHouseId) ?? project?.houses[0];
  }, [project, selectedHouseId]);

  const selectedRoom = useMemo(() => {
    return selectedHouse?.rooms.find((room) => room.id === selectedRoomId) ?? selectedHouse?.rooms[0];
  }, [selectedHouse, selectedRoomId]);

  const selectedObject = useMemo(() => {
    return selectedRoom?.objects.find((obj) => obj.id === selectedObjectId) ?? selectedRoom?.objects[0];
  }, [selectedRoom, selectedObjectId]);

  const addObjectRoom = useMemo(() => {
    return findRoomInProject(project, addObjectRoomId ?? "")?.room;
  }, [project, addObjectRoomId]);

  const baseProjectBudget = useMemo(() => {
    if (!project) {
      return createMockProjectBudget();
    }
    return projectBudgets[project.id] ?? createMockProjectBudget();
  }, [project, projectBudgets]);

  const calculatedProjectBudget = useMemo(() => {
    return calculateProjectBudget(baseProjectBudget, project);
  }, [baseProjectBudget, project]);

  const projectWorkflowSummary = useMemo(() => {
    if (!project) {
      return summarizeWorkflowForProject({
        id: "",
        name: "",
        customer: "",
        location: "",
        houses: [],
      });
    }
    return summarizeWorkflowForProject(project);
  }, [project]);

  useEffect(() => {
    if (!project) {
      return;
    }

    const fallbackHouse = selectedHouse ?? project.houses[0];
    if (fallbackHouse && fallbackHouse.id !== selectedHouseId) {
      setSelectedHouseId(fallbackHouse.id);
    }

    const fallbackRoom = selectedRoom ?? fallbackHouse?.rooms[0];
    if (fallbackRoom && fallbackRoom.id !== selectedRoomId) {
      setSelectedRoomId(fallbackRoom.id);
    }

    const fallbackObject = selectedObject ?? fallbackRoom?.objects[0];
    const nextObjectId = fallbackObject?.id ?? "";
    if (nextObjectId !== selectedObjectId) {
      setSelectedObjectId(nextObjectId);
    }
  }, [project, selectedHouse, selectedHouseId, selectedRoom, selectedRoomId, selectedObject, selectedObjectId]);

  useEffect(() => {
    if (activeTab !== "rooms" || !pendingScrollRoomId) {
      return;
    }

    const elementId = `room-section-${pendingScrollRoomId}`;
    const target = document.getElementById(elementId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setPendingScrollRoomId(null);
      return;
    }

    const timeout = setTimeout(() => {
      const delayedTarget = document.getElementById(elementId);
      if (delayedTarget) {
        delayedTarget.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setPendingScrollRoomId(null);
    }, 120);

    return () => clearTimeout(timeout);
  }, [activeTab, pendingScrollRoomId]);

  useEffect(() => {
    if (activeTab !== "rooms" || !project || pendingScrollRoomId) {
      return;
    }

    let rafId = 0;

    const updateFromScroll = () => {
      rafId = 0;
      const sections = Array.from(
        document.querySelectorAll<HTMLElement>('[data-room-section="true"]')
      );
      if (sections.length === 0) {
        return;
      }

      let activeSection = sections[0];
      const isNearPageBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8;
      if (isNearPageBottom) {
        activeSection = sections[sections.length - 1];
      } else {
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= ROOM_SPY_OFFSET) {
          activeSection = section;
        } else {
          break;
        }
      }
      }

      const roomId = activeSection.dataset.roomId;
      const houseId = activeSection.dataset.houseId;
      if (!roomId || !houseId || roomId === selectedRoomId) {
        return;
      }

      const house = project.houses.find((item) => item.id === houseId);
      const room = house?.rooms.find((item) => item.id === roomId);
      setSelectedHouseId(houseId);
      setSelectedRoomId(roomId);
      setSelectedObjectId(room?.objects[0]?.id ?? "");
    };

    const onScroll = () => {
      if (rafId) {
        return;
      }
      rafId = window.requestAnimationFrame(updateFromScroll);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("scroll", onScroll);
    };
  }, [activeTab, pendingScrollRoomId, project, selectedRoomId]);

  function updateCurrentProject(updater: (targetProject: Project) => Project) {
    if (!project) {
      return;
    }

    setProjects((prev) =>
      prev.map((item) => {
        if (item.id !== project.id) {
          return item;
        }
        return updater(item);
      })
    );
  }

  function handleProjectChange(projectId: string) {
    router.push(`/projects/${projectId}`);
  }

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
    router.push(`/projects/${projectId}?onboarding=default-rooms`);
  }

  function handleDismissDefaultStructureNotice() {
    setShowDefaultStructureNotice(false);

    if (searchParams.get("onboarding") !== "default-rooms") {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("onboarding");
    const nextQuery = nextParams.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }

  async function handleDeleteProject(projectId: string) {
    const isDeletingCurrentProject = project?.id === projectId;

    await deleteProjectById(projectId);
    const loadedProjects = await loadProjectsForWorkspace();
    setProjects(loadedProjects);

    if (loadedProjects.length === 0) {
      router.push("/dashboard");
      return;
    }

    if (isDeletingCurrentProject) {
      router.push(`/projects/${loadedProjects[0].id}`);
    }
  }

  function handleSelectRoom(houseId: string, roomId: string) {
    setActiveTab("rooms");
    setSelectedHouseId(houseId);
    setSelectedRoomId(roomId);

    const house = project?.houses.find((item) => item.id === houseId);
    const room = house?.rooms.find((item) => item.id === roomId);
    setSelectedObjectId(room?.objects[0]?.id ?? "");
    setPendingScrollRoomId(roomId);
  }

  function handleRenameRoom(roomId: string, nextName: string) {
    const normalizedName = nextName.trim();
    if (!normalizedName) {
      return;
    }

    const previousName = findRoomInProject(project, roomId)?.room.name ?? "";

    updateCurrentProject((targetProject) => ({
      ...targetProject,
      houses: targetProject.houses.map((house) => ({
        ...house,
        rooms: house.rooms.map((room) =>
          room.id === roomId
            ? {
                ...room,
                name: normalizedName,
              }
            : room
        ),
      })),
    }));

    if (isSupabaseConfigured) {
      void renameRoomById(roomId, normalizedName).catch((error) => {
        if (previousName) {
          updateCurrentProject((targetProject) => ({
            ...targetProject,
            houses: targetProject.houses.map((house) => ({
              ...house,
              rooms: house.rooms.map((room) =>
                room.id === roomId
                  ? {
                      ...room,
                      name: previousName,
                    }
                  : room
              ),
            })),
          }));
        }
        window.alert(error instanceof Error ? error.message : "Failed to rename room.");
      });
    }
  }

  function handleRenameHouse(houseId: string, nextName: string) {
    const normalizedName = nextName.trim();
    if (!normalizedName) {
      return;
    }

    const previousName = project?.houses.find((house) => house.id === houseId)?.name ?? "";

    updateCurrentProject((targetProject) => ({
      ...targetProject,
      houses: targetProject.houses.map((house) =>
        house.id === houseId
          ? {
              ...house,
              name: normalizedName,
            }
          : house
      ),
    }));

    if (isSupabaseConfigured) {
      void renameHouseById(houseId, normalizedName).catch((error) => {
        if (previousName) {
          updateCurrentProject((targetProject) => ({
            ...targetProject,
            houses: targetProject.houses.map((house) =>
              house.id === houseId
                ? {
                    ...house,
                    name: previousName,
                  }
                : house
            ),
          }));
        }
        window.alert(error instanceof Error ? error.message : "Failed to rename house.");
      });
    }
  }

  async function handleRenameProject(nextName: string) {
    const normalizedName = nextName.trim();
    if (!project || !normalizedName || normalizedName === project.name) {
      return;
    }

    const previousName = project.name;

    updateCurrentProject((targetProject) => ({
      ...targetProject,
      name: normalizedName,
    }));

    if (isSupabaseConfigured) {
      try {
        await renameProjectById(project.id, normalizedName);
      } catch (error) {
        updateCurrentProject((targetProject) => ({
          ...targetProject,
          name: previousName,
        }));
        throw error;
      }
    }
  }

  async function handleAddRoom(houseId: string, roomName: string, roomType: RoomType, roomSizeSqm?: number) {
    const normalizedName = roomName.trim();
    if (!normalizedName) {
      return;
    }

    if (isSupabaseConfigured) {
      try {
        const createdRoom = await createRoomForHouse({
          houseId,
          name: normalizedName,
          roomType,
          sizeSqm: roomSizeSqm,
        });

        updateCurrentProject((targetProject) => ({
          ...targetProject,
          houses: targetProject.houses.map((house) =>
            house.id === houseId
              ? {
                  ...house,
                  rooms: [...house.rooms, createdRoom],
                }
              : house
          ),
        }));

        setActiveTab("rooms");
        setSelectedHouseId(houseId);
        setSelectedRoomId(createdRoom.id);
        setSelectedObjectId("");
        setPendingScrollRoomId(createdRoom.id);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Failed to add room.");
      }
      return;
    }

    const newRoomId = `${houseId}-room-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newRoom: Room = {
      id: newRoomId,
      houseId,
      name: normalizedName,
      sizeSqm: roomSizeSqm,
      type: roomType,
      objects: [],
    };

    updateCurrentProject((targetProject) => ({
      ...targetProject,
      houses: targetProject.houses.map((house) =>
        house.id === houseId
          ? {
              ...house,
              rooms: [...house.rooms, newRoom],
            }
          : house
      ),
    }));

    setActiveTab("rooms");
    setSelectedHouseId(houseId);
    setSelectedRoomId(newRoomId);
    setSelectedObjectId("");
    setPendingScrollRoomId(newRoomId);
  }

  async function handleAddHouse(houseName: string, houseSizeSqm?: number) {
    const normalizedName = houseName.trim();
    if (!project || !normalizedName) {
      return;
    }

    if (isSupabaseConfigured) {
      try {
        const createdHouse = await createHouseForProject({
          projectId: project.id,
          name: normalizedName,
          sizeSqm: houseSizeSqm,
        });

        updateCurrentProject((targetProject) => ({
          ...targetProject,
          houses: [...targetProject.houses, createdHouse],
        }));

        const firstRoom = createdHouse.rooms[0];
        setSelectedHouseId(createdHouse.id);
        setSelectedRoomId(firstRoom?.id ?? "");
        setSelectedObjectId("");
        if (firstRoom) {
          setPendingScrollRoomId(firstRoom.id);
        }
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Failed to add house.");
      }
      return;
    }

    const newHouseId = `${project.id}-house-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const normalizedSize =
      typeof houseSizeSqm === "number" && Number.isFinite(houseSizeSqm) && houseSizeSqm > 0
        ? Math.round(houseSizeSqm * 100) / 100
        : undefined;

    const newRooms: Room[] = defaultHouseRoomBlueprint.map((roomTemplate, roomIndex) => ({
      id: `${newHouseId}-room-${roomIndex}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      houseId: newHouseId,
      name: roomTemplate.name,
      type: roomTemplate.type,
      objects: [],
    }));

    const newHouse = {
      id: newHouseId,
      projectId: project.id,
      name: normalizedName,
      sizeSqm: normalizedSize,
      rooms: newRooms,
    };

    updateCurrentProject((targetProject) => ({
      ...targetProject,
      houses: [...targetProject.houses, newHouse],
    }));

    setSelectedHouseId(newHouse.id);
    setSelectedRoomId(newRooms[0]?.id ?? "");
    setSelectedObjectId("");
    if (newRooms[0]) {
      setPendingScrollRoomId(newRooms[0].id);
    }
  }

  async function handleDuplicateHouse(houseId: string, duplicateName?: string) {
    if (!project) {
      return;
    }

    const sourceHouse = project.houses.find((house) => house.id === houseId);
    if (!sourceHouse) {
      return;
    }

    const normalizedDuplicateName = (duplicateName?.trim() || `${sourceHouse.name} Copy`).trim();

    if (isSupabaseConfigured) {
      try {
        const duplicatedHouse = await duplicateHouseWithContents({
          projectId: project.id,
          sourceHouse,
          name: normalizedDuplicateName,
        });

        updateCurrentProject((targetProject) => ({
          ...targetProject,
          houses: [...targetProject.houses, duplicatedHouse],
        }));

        const firstRoom = duplicatedHouse.rooms[0];
        setSelectedHouseId(duplicatedHouse.id);
        setSelectedRoomId(firstRoom?.id ?? "");
        setSelectedObjectId(firstRoom?.objects[0]?.id ?? "");
        if (firstRoom) {
          setPendingScrollRoomId(firstRoom.id);
        }
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Failed to duplicate house.");
      }
      return;
    }

    const duplicatedHouseId = `${project.id}-house-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const duplicatedRooms = sourceHouse.rooms.map((sourceRoom, roomIndex) => {
      const duplicatedRoomId = `${duplicatedHouseId}-room-${roomIndex}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      return {
        ...sourceRoom,
        id: duplicatedRoomId,
        houseId: duplicatedHouseId,
        objects: sourceRoom.objects.map((sourceObject, objectIndex) => ({
          ...sourceObject,
          id: `${duplicatedRoomId}-object-${objectIndex}-${Date.now()}`,
          roomId: duplicatedRoomId,
        })),
      };
    });

    const duplicatedHouse = {
      ...sourceHouse,
      id: duplicatedHouseId,
      name: normalizedDuplicateName,
      rooms: duplicatedRooms,
    };

    updateCurrentProject((targetProject) => ({
      ...targetProject,
      houses: [...targetProject.houses, duplicatedHouse],
    }));

    const firstRoom = duplicatedRooms[0];
    setSelectedHouseId(duplicatedHouse.id);
    setSelectedRoomId(firstRoom?.id ?? "");
    setSelectedObjectId(firstRoom?.objects[0]?.id ?? "");
    if (firstRoom) {
      setPendingScrollRoomId(firstRoom.id);
    }
  }

  function buildObjectInstance(
    roomId: string,
    objectName: string,
    category: string,
    basePrice: number,
    seedSuffix: string,
    quantity = 1
  ): RoomObject {
    const safeQuantity = Math.max(1, Math.min(50, Math.round(quantity)));
    if (isSupabaseConfigured) {
      return {
        id: `${roomId}-object-${Date.now()}-${Math.floor(Math.random() * 1000)}-${seedSuffix}`,
        roomId,
        name: objectName,
        category,
        quantity: safeQuantity,
        poApproved: false,
        ordered: false,
        installed: false,
        productOptions: [],
      };
    }

    return {
      ...createMockRoomObject(roomId, objectName, category, basePrice, `${roomId}-${objectName}-${seedSuffix}`),
      quantity: safeQuantity,
    };
  }

  function handleAddObject(
    roomId: string,
    objectName: string,
    category: string,
    basePrice = 8500,
    quantity = 1
  ) {
    const target = findRoomInProject(project, roomId);
    if (!target) {
      return;
    }

    const normalizedName = objectName.trim();
    if (!normalizedName) {
      return;
    }

    const safeQuantity = Math.max(1, Math.min(50, Math.round(quantity)));
    const normalizedCategory = category.trim() || "Custom";

    const existingMatch = target.room.objects.find(
      (item) =>
        item.name.trim().toLowerCase() === normalizedName.toLowerCase() &&
        item.category.trim().toLowerCase() === normalizedCategory.toLowerCase()
    );

    if (existingMatch) {
      updateObjectById(existingMatch.id, (objectItem) => ({
        ...objectItem,
        quantity: Math.max(1, objectItem.quantity + safeQuantity),
      }));
      setActiveTab("rooms");
      setSelectedHouseId(target.house.id);
      setSelectedRoomId(roomId);
      setSelectedObjectId(existingMatch.id);
      setPendingScrollRoomId(roomId);
      return;
    }

    const newObject = buildObjectInstance(
      roomId,
      normalizedName,
      normalizedCategory,
      basePrice,
      `${target.room.objects.length}-${Date.now()}`,
      safeQuantity
    );

    updateCurrentProject((targetProject) => {
      return {
        ...targetProject,
        houses: targetProject.houses.map((house) => ({
          ...house,
          rooms: house.rooms.map((room) =>
            room.id === roomId
              ? {
                  ...room,
                  objects: [...room.objects, newObject],
                }
              : room
          ),
        })),
      };
    });

    setActiveTab("rooms");
    setSelectedHouseId(target.house.id);
    setSelectedRoomId(roomId);
    setSelectedObjectId(newObject.id);
    setPendingScrollRoomId(roomId);
  }

  function handleDeleteObject(roomId: string, objectId: string) {
    const target = findRoomInProject(project, roomId);
    if (!target) {
      return;
    }

    updateCurrentProject((targetProject) => ({
      ...targetProject,
      houses: targetProject.houses.map((house) => ({
        ...house,
        rooms: house.rooms.map((room) =>
          room.id === roomId
            ? {
                ...room,
                objects: room.objects
                  .map((obj) =>
                    obj.id === objectId && obj.quantity > 1 ? { ...obj, quantity: obj.quantity - 1 } : obj
                  )
                  .filter((obj) => !(obj.id === objectId && obj.quantity <= 1)),
              }
            : room
        ),
      })),
    }));

    const removedObject = target.room.objects.find((obj) => obj.id === objectId);
    const willFullyRemove = removedObject ? removedObject.quantity <= 1 : true;
    const remainingObjects = willFullyRemove
      ? target.room.objects.filter((obj) => obj.id !== objectId)
      : target.room.objects.map((obj) =>
          obj.id === objectId ? { ...obj, quantity: Math.max(1, obj.quantity - 1) } : obj
        );

    if (selectedRoomId === roomId && selectedObjectId === objectId && willFullyRemove) {
      setSelectedObjectId(remainingObjects[0]?.id ?? "");
    }
  }

  function handleSelectObject(houseId: string, roomId: string, objectId: string) {
    setActiveTab("rooms");
    setSelectedHouseId(houseId);
    setSelectedRoomId(roomId);
    setSelectedObjectId(objectId);
  }

  function updateObjectById(objectId: string, updater: (objectItem: RoomObject) => RoomObject) {
    updateCurrentProject((targetProject) => ({
      ...targetProject,
      houses: targetProject.houses.map((house) => ({
        ...house,
        rooms: house.rooms.map((room) => ({
          ...room,
          objects: room.objects.map((objectItem) => (objectItem.id === objectId ? updater(objectItem) : objectItem)),
        })),
      })),
    }));
  }

  function handleSelectProduct(productId: string) {
    if (!selectedObject) {
      return;
    }

    const previousObjectState = { ...selectedObject };
    const isMaterialChanged = selectedObject.selectedProductId !== productId;

    updateObjectById(selectedObject.id, (objectItem) => ({
      ...objectItem,
      selectedProductId: productId,
      poApproved: isMaterialChanged ? false : Boolean(objectItem.poApproved),
      ordered: isMaterialChanged ? false : Boolean(objectItem.ordered),
      installed: isMaterialChanged ? false : Boolean(objectItem.installed),
    }));

    if (isSupabaseConfigured) {
      void updateRoomObjectSelectedMaterialById(selectedObject.id, productId)
        .then(async () => {
          if (isMaterialChanged) {
            await updateRoomObjectWorkflowById(selectedObject.id, {
              poApproved: false,
              ordered: false,
              installed: false,
            });
          }
        })
        .catch((error) => {
          updateObjectById(selectedObject.id, () => previousObjectState);
          window.alert(error instanceof Error ? error.message : "Failed to save selected material.");
        });
    }
  }

  function handleUpdateObjectWorkflow(
    objectId: string,
    patch: Partial<Pick<RoomObject, "poApproved" | "ordered" | "installed">>
  ) {
    const locatedObject = findObjectInProject(project, objectId)?.objectItem;
    if (!locatedObject) {
      return;
    }

    const previousState = { ...locatedObject };
    const nextWorkflow = normalizeWorkflowState(locatedObject, patch);

    updateObjectById(objectId, (objectItem) => ({
      ...objectItem,
      ...nextWorkflow,
    }));

    if (isSupabaseConfigured) {
      void updateRoomObjectWorkflowById(objectId, nextWorkflow).catch((error) => {
        updateObjectById(objectId, () => previousState);
        window.alert(error instanceof Error ? error.message : "Failed to update workflow stage.");
      });
    }
  }

  async function handleSearchCatalog(objectId: string, query: string) {
    const targetObject = project?.houses
      .flatMap((house) => house.rooms.flatMap((room) => room.objects))
      .find((objectItem) => objectItem.id === objectId);

    if (!targetObject) {
      return;
    }

    if (isSupabaseConfigured) {
      try {
        const materialOptions = await searchMaterialsForCurrentUser({
          objectName: targetObject.name,
          objectCategory: targetObject.category,
          query,
        });

        updateObjectById(objectId, (objectItem) => {
          const selectedStillVisible = materialOptions.some((option) => option.id === objectItem.selectedProductId);
          return {
            ...objectItem,
            productOptions: materialOptions,
            selectedProductId: selectedStillVisible ? objectItem.selectedProductId : undefined,
          };
        });
      } catch (error) {
        console.warn("Failed to search materials from Supabase.", error);
      }
      return;
    }

    const catalogOptions = searchMockCatalogOptions(targetObject.name, query);

    updateObjectById(objectId, (objectItem) => {
      const linkedOptions = objectItem.productOptions.filter(isLinkOption);
      const nextOptions = [...linkedOptions, ...catalogOptions];
      const selectedStillVisible = nextOptions.some((option) => option.id === objectItem.selectedProductId);

      return {
        ...objectItem,
        productOptions: nextOptions,
        selectedProductId: selectedStillVisible ? objectItem.selectedProductId : undefined,
      };
    });
  }

  function handleAddFromLink(
    objectId: string,
    payload: { url: string; name?: string; supplier?: string; price?: number; imageUrl?: string }
  ) {
    const targetObject = project?.houses
      .flatMap((house) => house.rooms.flatMap((room) => room.objects))
      .find((objectItem) => objectItem.id === objectId);

    if (!targetObject) {
      return;
    }

    if (isSupabaseConfigured) {
      void addLinkMaterialForCurrentUser({
        objectName: targetObject.name,
        objectCategory: targetObject.category,
        url: payload.url,
        name: payload.name,
        supplier: payload.supplier,
        price: payload.price,
        imageUrl: payload.imageUrl,
      })
        .then((savedOption) => {
          updateObjectById(objectId, (objectItem) => {
            const dedupedOptions = [savedOption, ...objectItem.productOptions.filter((item) => item.id !== savedOption.id)];
            return {
              ...objectItem,
              productOptions: dedupedOptions,
              selectedProductId: savedOption.id,
            };
          });
        })
        .catch((error) => {
          window.alert(error instanceof Error ? error.message : "Failed to save link to your material library.");
        });
      return;
    }

    const linkOption = buildProductOptionFromLink({
      objectName: targetObject.name,
      url: payload.url,
      name: payload.name,
      supplier: payload.supplier,
      price: payload.price,
      imageUrl: payload.imageUrl,
      budgetCategory: resolveBudgetCategory(targetObject.name, targetObject.category),
    });

    updateObjectById(objectId, (objectItem) => ({
      ...objectItem,
      productOptions: [linkOption, ...objectItem.productOptions],
    }));
  }

  function handleSaveBudget(payload: { totalBudget: number; categoryBudgets: Record<BudgetCategoryName, number> }) {
    if (!project) {
      return;
    }

    setProjectBudgets((prev) => {
      const current = prev[project.id] ?? createMockProjectBudget();
      const nextCategories = budgetCategoryOrder.map((categoryName) => {
        const existing = current.categories.find((item) => item.name === categoryName);
        const nextBudget = Math.max(0, Math.round(payload.categoryBudgets[categoryName] ?? 0));
        return {
          id: existing?.id ?? categoryName.toLowerCase(),
          name: categoryName,
          totalBudget: nextBudget,
          allocatedAmount: existing?.allocatedAmount ?? 0,
          remainingAmount: nextBudget - (existing?.allocatedAmount ?? 0),
        };
      });

      return {
        ...prev,
        [project.id]: {
          totalBudget: Math.max(0, Math.round(payload.totalBudget)),
          allocatedAmount: current.allocatedAmount,
          remainingAmount: Math.max(0, Math.round(payload.totalBudget)) - current.allocatedAmount,
          categories: nextCategories,
        },
      };
    });
  }

  if (isSupabaseConfigured && !isAuthChecked) {
    return <main className="p-6">Checking session...</main>;
  }

  if (isSupabaseConfigured && isAuthChecked && !isSignedIn) {
    return (
      <AppShell
        topNav={
          <TopNav
            title="Materia Workspace"
            subtitle="Authentication required"
            projects={[]}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        }
        main={
          <Card className="mx-auto mt-6 max-w-xl border-slate-200">
            <CardHeader>
              <CardTitle>Sign in required</CardTitle>
              <CardDescription>Workspace data is now protected by Supabase RLS policies.</CardDescription>
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

  if (!project) {
    return (
      <AppShell
        topNav={
          <TopNav
            title="Materia Workspace"
            subtitle="No accessible project"
            projects={projects}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSignOut={handleSignOut}
            onCreateProject={isSupabaseConfigured && isSignedIn ? handleCreateProject : undefined}
            onDeleteProject={isSupabaseConfigured && isSignedIn ? handleDeleteProject : undefined}
          />
        }
        main={
          <Card className="mx-auto mt-6 max-w-xl border-slate-200">
            <CardHeader>
              <CardTitle>No project access</CardTitle>
              <CardDescription>You are signed in, but no accessible projects were found.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button type="button" variant="outline" onClick={() => router.push("/dashboard")}>
                Back to dashboard
              </Button>
            </CardContent>
          </Card>
        }
      />
    );
  }

  const totalRooms = project.houses.reduce((acc, house) => acc + house.rooms.length, 0);
  const totalObjects = project.houses.reduce(
    (acc, house) =>
      acc +
      house.rooms.reduce(
        (roomAcc, room) => roomAcc + room.objects.reduce((objAcc, objectItem) => objAcc + Math.max(1, objectItem.quantity), 0),
        0
      ),
    0
  );

  const topNav = (
    <TopNav
      title="Materia Workspace"
      subtitle="Designer prototype"
      projects={projects}
      selectedProjectId={project.id}
      onProjectChange={handleProjectChange}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onSignOut={handleSignOut}
      onCreateProject={isSupabaseConfigured && isSignedIn ? handleCreateProject : undefined}
      onDeleteProject={isSupabaseConfigured && isSignedIn ? handleDeleteProject : undefined}
    />
  );

  const sidebar = (
    <HouseRoomTree
      houses={project.houses}
      selectedHouseId={selectedHouse?.id ?? ""}
      selectedRoomId={selectedRoom?.id ?? ""}
      onSelectRoom={handleSelectRoom}
      onRenameHouse={handleRenameHouse}
      onRenameRoom={handleRenameRoom}
      onAddHouse={handleAddHouse}
      onDuplicateHouse={handleDuplicateHouse}
      onAddRoom={handleAddRoom}
    />
  );

  const roomsContent = (
    <div className="space-y-4 pb-20">
      <div className="sticky top-[122px] z-10 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current house</p>
        <p className="text-sm font-semibold text-slate-800">{selectedHouse?.name ?? "No house selected"}</p>
        <p className="text-xs text-slate-500">{selectedRoom?.name ?? "No room selected"}</p>
      </div>
      {showDefaultStructureNotice ? (
        <Card className="border-blue-200 bg-blue-50 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="inline-flex items-center gap-2 text-base text-blue-900">
                  <Info className="h-4 w-4" />
                  Default structure created
                </CardTitle>
                <CardDescription className="mt-1 text-blue-800">
                  Every new house starts with these rooms: Entry, Living Room, Kitchen, Dining Room, Bedroom, Bathroom.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-blue-800"
                onClick={handleDismissDefaultStructureNotice}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
        </Card>
      ) : null}
      <WorkflowOverview
        title="Project progress overview"
        description="Track where you stand across all objects: assign material, approve PO, order, and install."
        summary={projectWorkflowSummary}
      />
      <ProjectRoomsStack
        houses={project.houses}
        selectedRoomId={selectedRoom?.id ?? ""}
        selectedObjectId={selectedObject?.id ?? ""}
        onAddSuggestion={(roomId, objectName, category, basePrice) => handleAddObject(roomId, objectName, category, basePrice)}
        onSelectObject={handleSelectObject}
        onDeleteObject={handleDeleteObject}
        onUpdateWorkflow={handleUpdateObjectWorkflow}
        onOpenAddCustomObject={(roomId) => setAddObjectRoomId(roomId)}
      />
      <AddObjectDialog
        open={Boolean(addObjectRoomId)}
        roomName={addObjectRoom?.name ?? "room"}
        onOpenChange={(open) => {
          if (!open) {
            setAddObjectRoomId(null);
          }
        }}
        onCreateObject={(objectName, category, quantity) => {
          if (!addObjectRoomId) {
            return;
          }
          handleAddObject(addObjectRoomId, objectName, category, 8500, quantity);
          setAddObjectRoomId(null);
        }}
      />
    </div>
  );

  const materialsContent = isSupabaseConfigured ? (
    <MaterialsGallery searchQuery={searchQuery} />
  ) : (
    <PlaceholderTab
      icon={Boxes}
      title="Materials workspace"
      description="Connect Supabase to browse and manage your personal materials database."
      details="Once connected, this tab becomes your searchable gallery where you can review and delete saved materials."
    />
  );

  const budgetContent = <BudgetOverview budget={calculatedProjectBudget} onSaveBudget={handleSaveBudget} />;

  const clientContent = (
    <PlaceholderTab
      icon={Presentation}
      title="Client presentation mode"
      description="Client-facing views and approvals will be prepared from curated selections."
      details="This tab will provide shareable presentation pages with final design choices."
    />
  );

  const rightPanel =
    activeTab === "rooms" ? (
      <ProductOptionsPanel
        roomObject={selectedObject}
        globalSearchQuery={searchQuery}
        onSelectProduct={handleSelectProduct}
        onSearchCatalog={handleSearchCatalog}
        onAddFromLink={handleAddFromLink}
      />
    ) : (
      <RightPanelPlaceholder
        title="Workspace context"
        description="Product option details are shown on the right when working in the Rooms tab."
      />
    );

  const main = (
    <WorkspaceShell
      projectName={project.name}
      customer={project.customer}
      location={project.location}
      housesCount={project.houses.length}
      roomsCount={totalRooms}
      objectsCount={totalObjects}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onRenameProject={handleRenameProject}
      roomsContent={roomsContent}
      materialsContent={materialsContent}
      budgetContent={budgetContent}
      clientContent={clientContent}
    />
  );

  return <AppShell topNav={topNav} sidebar={sidebar} main={main} rightPanel={rightPanel} />;
}
