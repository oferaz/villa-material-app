"use client";

import { ComponentType, useEffect, useMemo, useState } from "react";
import { Boxes, Presentation } from "lucide-react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { NewProjectWizardPayload, TopNav } from "@/components/layout/top-nav";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { BudgetOverview } from "@/components/budget/budget-overview";
import { MaterialsGallery } from "@/components/materials/materials-gallery";
import { HouseRoomTree } from "@/components/rooms/house-room-tree";
import { ProjectRoomsStack } from "@/components/rooms/project-rooms-stack";
import { AddObjectDialog } from "@/components/rooms/add-object-dialog";
import { ProductOptionsPanel } from "@/components/products/product-options-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { budgetCategoryOrder, calculateProjectBudget, createMockProjectBudget, resolveBudgetCategory } from "@/lib/mock/budget";
import { buildProductOptionFromLink, searchMockCatalogOptions } from "@/lib/mock/material-search";
import { createMockRoomObject } from "@/lib/mock/projects";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { addLinkMaterialForCurrentUser, searchMaterialsForCurrentUser } from "@/lib/supabase/materials-repository";
import { createRoomForHouse, deleteProjectById, loadProjectsForWorkspace, renameRoomById } from "@/lib/supabase/projects-repository";
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

function isLinkOption(option: ProductOption): boolean {
  return option.sourceType === "link";
}

function createInitialBudgetMap(projects: Project[] = []): Record<string, ProjectBudget> {
  return projects.reduce<Record<string, ProjectBudget>>((acc, item) => {
    acc[item.id] = createMockProjectBudget();
    return acc;
  }, {});
}

export function ProjectWorkspace({ initialProjectId }: ProjectWorkspaceProps) {
  const router = useRouter();
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
    router.push(`/projects/${projectId}`);
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

  function buildObjectInstance(
    roomId: string,
    objectName: string,
    category: string,
    basePrice: number,
    seedSuffix: string
  ): RoomObject {
    if (isSupabaseConfigured) {
      return {
        id: `${roomId}-object-${Date.now()}-${Math.floor(Math.random() * 1000)}-${seedSuffix}`,
        roomId,
        name: objectName,
        category,
        quantity: 1,
        productOptions: [],
      };
    }

    return createMockRoomObject(roomId, objectName, category, basePrice, `${roomId}-${objectName}-${seedSuffix}`);
  }

  function handleAddObject(
    roomId: string,
    objectName: string,
    category: string,
    basePrice = 8500,
    quantity = 1,
    mode: "stack" | "separate" = "stack"
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

    if (mode === "stack" && existingMatch) {
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

    const existingSameNameCount = target.room.objects.filter(
      (item) => item.name.trim().toLowerCase() === normalizedName.toLowerCase()
    ).length;

    const newObjects: RoomObject[] = Array.from({ length: safeQuantity }, (_, index) => {
      const finalName =
        mode === "separate" && safeQuantity > 1
          ? `${normalizedName} ${existingSameNameCount + index + 1}`
          : normalizedName;
      return buildObjectInstance(
        roomId,
        finalName,
        normalizedCategory,
        basePrice,
        `${target.room.objects.length}-${existingSameNameCount}-${index}`
      );
    });

    updateCurrentProject((targetProject) => {
      return {
        ...targetProject,
        houses: targetProject.houses.map((house) => ({
          ...house,
          rooms: house.rooms.map((room) =>
            room.id === roomId
              ? {
                  ...room,
                  objects: [...room.objects, ...newObjects],
                }
              : room
          ),
        })),
      };
    });

    setActiveTab("rooms");
    setSelectedHouseId(target.house.id);
    setSelectedRoomId(roomId);
    setSelectedObjectId(newObjects[0]?.id ?? "");
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

    updateObjectById(selectedObject.id, (objectItem) => ({
      ...objectItem,
      selectedProductId: productId,
    }));
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
    payload: { url: string; name?: string; supplier?: string; price?: number }
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
      onRenameRoom={handleRenameRoom}
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
      <ProjectRoomsStack
        houses={project.houses}
        selectedRoomId={selectedRoom?.id ?? ""}
        selectedObjectId={selectedObject?.id ?? ""}
        onAddSuggestion={(roomId, objectName, category, basePrice) => handleAddObject(roomId, objectName, category, basePrice)}
        onSelectObject={handleSelectObject}
        onDeleteObject={handleDeleteObject}
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
        onCreateObject={(objectName, category, quantity, mode) => {
          if (!addObjectRoomId) {
            return;
          }
          handleAddObject(addObjectRoomId, objectName, category, 8500, quantity, mode);
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
      roomsContent={roomsContent}
      materialsContent={materialsContent}
      budgetContent={budgetContent}
      clientContent={clientContent}
    />
  );

  return <AppShell topNav={topNav} sidebar={sidebar} main={main} rightPanel={rightPanel} />;
}
