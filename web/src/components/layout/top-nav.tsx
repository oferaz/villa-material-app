"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, MessageSquare, Plus, Search, Trash2, UserCircle2 } from "lucide-react";
import { Project } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ProjectSwitcher } from "@/components/projects/project-switcher";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { loadCurrentUserProfile, saveCurrentUserProfile } from "@/lib/supabase/profile-repository";
import { defaultUserPreferences, loadUserPreferences, saveUserPreferences, UserPreferences } from "@/lib/user-preferences";

const INITIAL_HOUSE_NAME = "Main House";

export interface NewProjectWizardPayload {
  name: string;
  clientName: string;
  location: string;
  houseNames: string[];
  houseSizesSqm: number[];
}

export interface TopNavSearchResultItem {
  id: string;
  title: string;
  subtitle?: string;
}

export interface TopNavSearchResultGroup {
  key: string;
  label: string;
  items: TopNavSearchResultItem[];
}

interface TopNavProps {
  title: string;
  subtitle?: string;
  projects: Project[];
  selectedProjectId?: string;
  onProjectChange?: (projectId: string) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchResultGroups?: TopNavSearchResultGroup[];
  onSelectSearchResult?: (item: TopNavSearchResultItem) => void;
  onSignOut?: () => void;
  onCreateProject?: (payload: NewProjectWizardPayload) => Promise<void> | void;
}

export function TopNav({
  title,
  subtitle,
  projects,
  selectedProjectId,
  onProjectChange,
  searchQuery,
  onSearchChange,
  searchResultGroups = [],
  onSelectSearchResult,
  onSignOut,
  onCreateProject,
}: TopNavProps) {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [projectName, setProjectName] = useState("");
  const [clientName, setClientName] = useState("");
  const [location, setLocation] = useState("");
  const [houseNames, setHouseNames] = useState<string[]>([INITIAL_HOUSE_NAME]);
  const [houseSizesSqmInput, setHouseSizesSqmInput] = useState<string[]>([""]);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileEmail, setProfileEmail] = useState("");
  const [profileFullName, setProfileFullName] = useState("");
  const [profileCompanyName, setProfileCompanyName] = useState("");
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>(defaultUserPreferences);
  const [isPreferencesHydrated, setIsPreferencesHydrated] = useState(false);
  const [preferencesStatus, setPreferencesStatus] = useState<string | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const feedbackUrl = process.env.NEXT_PUBLIC_FEEDBACK_URL?.trim() || "";
  const hasSearchQuery = searchQuery.trim().length > 0;
  const hasSearchResults = searchResultGroups.some((group) => group.items.length > 0);
  const shouldShowSearchResults = hasSearchQuery && isSearchFocused;

  const normalizedHouseData = useMemo(
    () =>
      houseNames
        .map((houseName, index) => {
          const normalizedName = houseName.trim();
          const rawSize = Number(houseSizesSqmInput[index] ?? "");
          const normalizedSize = Number.isFinite(rawSize) && rawSize > 0 ? Math.round(rawSize * 100) / 100 : 0;
          return {
            name: normalizedName,
            sizeSqm: normalizedSize,
          };
        })
        .filter((house) => house.name.length > 0),
    [houseNames, houseSizesSqmInput]
  );

  useEffect(() => {
    setPreferences(loadUserPreferences());
    setIsPreferencesHydrated(true);
  }, []);

  useEffect(() => {
    if (!isProfileOpen) {
      return;
    }

    setProfileError(null);
    setProfileStatus(null);

    if (!isSupabaseConfigured) {
      setProfileEmail("");
      setProfileFullName("");
      setProfileCompanyName("");
      return;
    }

    setIsProfileLoading(true);
    void loadCurrentUserProfile()
      .then((profile) => {
        setProfileEmail(profile?.email ?? "");
        setProfileFullName(profile?.fullName ?? "");
        setProfileCompanyName(profile?.companyName ?? "");
      })
      .catch((error) => {
        setProfileError(error instanceof Error ? error.message : "Failed to load profile.");
      })
      .finally(() => {
        setIsProfileLoading(false);
      });
  }, [isProfileOpen]);

  function resetWizardState() {
    setWizardStep(1);
    setProjectName("");
    setClientName("");
    setLocation("");
    setHouseNames([INITIAL_HOUSE_NAME]);
    setHouseSizesSqmInput([""]);
    setWizardError(null);
    setIsCreatingProject(false);
  }

  function handleWizardOpenChange(nextOpen: boolean) {
    setIsWizardOpen(nextOpen);
    if (!nextOpen) {
      resetWizardState();
    }
  }

  function handleAddHouse() {
    setHouseNames((prev) => [...prev, ""]);
    setHouseSizesSqmInput((prev) => [...prev, ""]);
  }

  function handleRemoveHouse(index: number) {
    setHouseNames((prev) => {
      if (prev.length <= 1) {
        return prev;
      }
      return prev.filter((_, currentIndex) => currentIndex !== index);
    });
    setHouseSizesSqmInput((prev) => {
      if (prev.length <= 1) {
        return prev;
      }
      return prev.filter((_, currentIndex) => currentIndex !== index);
    });
  }

  function handleHouseNameChange(index: number, nextValue: string) {
    setHouseNames((prev) => prev.map((value, currentIndex) => (currentIndex === index ? nextValue : value)));
  }

  function handleHouseSizeChange(index: number, nextValue: string) {
    setHouseSizesSqmInput((prev) => prev.map((value, currentIndex) => (currentIndex === index ? nextValue : value)));
  }

  async function handleSubmitNewProject() {
    if (!onCreateProject) {
      return;
    }

    const normalizedName = projectName.trim();
    if (!normalizedName) {
      setWizardError("Project name is required.");
      return;
    }

    if (normalizedHouseData.length === 0) {
      setWizardError("Add at least one house.");
      return;
    }

    setWizardError(null);
    setIsCreatingProject(true);

    try {
      await onCreateProject({
        name: normalizedName,
        clientName: clientName.trim(),
        location: location.trim(),
        houseNames: normalizedHouseData.map((house) => house.name),
        houseSizesSqm: normalizedHouseData.map((house) => house.sizeSqm),
      });

      setIsWizardOpen(false);
      resetWizardState();
    } catch (error) {
      setWizardError(error instanceof Error ? error.message : "Failed to create project.");
    } finally {
      setIsCreatingProject(false);
    }
  }

  async function handleSaveProfile() {
    if (!isSupabaseConfigured) {
      setProfileError("Supabase is not configured for this environment.");
      return;
    }

    setProfileError(null);
    setProfileStatus(null);
    setIsProfileSaving(true);
    try {
      const saved = await saveCurrentUserProfile({
        fullName: profileFullName,
        companyName: profileCompanyName,
      });
      setProfileEmail(saved.email);
      setProfileFullName(saved.fullName);
      setProfileCompanyName(saved.companyName);
      setProfileStatus("Profile saved.");
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Failed to save profile.");
    } finally {
      setIsProfileSaving(false);
    }
  }

  function handleSavePreferences() {
    saveUserPreferences(preferences);
    setPreferencesStatus("Preferences saved on this device.");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1800px] flex-wrap items-center gap-2 px-4 py-3 md:gap-4 lg:px-6">
        <Link
          href="/dashboard"
          className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 transition hover:bg-slate-200 md:flex"
        >
          <Image src="/materia-logo.png" alt="Materia" width={16} height={16} className="rounded-sm object-contain" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{title}</p>
            {subtitle ? <p className="text-[11px] text-slate-500">{subtitle}</p> : null}
          </div>
        </Link>

        {projects.length > 0 && selectedProjectId && onProjectChange ? (
          <div className="order-1 min-w-0 flex-1 md:flex-none">
            <ProjectSwitcher
              projects={projects}
              selectedProjectId={selectedProjectId}
              onProjectChange={onProjectChange}
            />
          </div>
        ) : (
          <div className="order-1 hidden text-sm font-semibold text-slate-700 md:block">Materia</div>
        )}

        <div
          className="order-3 relative w-full md:order-none md:ml-auto md:max-w-xl"
          onFocus={() => setIsSearchFocused(true)}
          onBlur={(event) => {
            const nextTarget = event.relatedTarget as Node | null;
            if (!event.currentTarget.contains(nextTarget)) {
              setIsSearchFocused(false);
            }
          }}
        >
          <Search className="pointer-events-none absolute left-4 top-3 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search project, rooms, objects, materials..."
            className="h-10 rounded-full border-slate-300 bg-slate-50 pl-10 text-sm shadow-inner focus-visible:bg-white"
            aria-expanded={shouldShowSearchResults}
          />
          {shouldShowSearchResults ? (
            <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-[55vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
              {hasSearchResults ? (
                <div className="space-y-2">
                  {searchResultGroups.map((group) => {
                    if (group.items.length === 0) {
                      return null;
                    }
                    return (
                      <section key={group.key} className="space-y-1">
                        <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{group.label}</p>
                        {group.items.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-100"
                            onMouseDown={(event) => {
                              event.preventDefault();
                            }}
                            onClick={() => {
                              onSelectSearchResult?.(item);
                              setIsSearchFocused(false);
                            }}
                          >
                            <p className="truncate text-sm font-medium text-slate-800">{item.title}</p>
                            {item.subtitle ? <p className="truncate text-xs text-slate-500">{item.subtitle}</p> : null}
                          </button>
                        ))}
                      </section>
                    );
                  })}
                </div>
              ) : (
                <p className="px-2 py-3 text-sm text-slate-500">No results found.</p>
              )}
            </div>
          ) : null}
        </div>

        <Dialog open={isWizardOpen} onOpenChange={handleWizardOpenChange}>
          <DialogTrigger asChild>
            <Button
              className="order-2 shrink-0 whitespace-nowrap border-blue-600 bg-blue-600 text-white hover:border-blue-700 hover:bg-blue-700 md:order-none"
              disabled={!onCreateProject}
            >
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create new project</DialogTitle>
              <DialogDescription>Step {wizardStep} of 3</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {wizardStep === 1 ? (
                <div className="space-y-3">
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Project name</span>
                    <Input
                      placeholder="Palm Heights"
                      value={projectName}
                      onChange={(event) => setProjectName(event.target.value)}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Client name</span>
                    <Input
                      placeholder="Haddad Family"
                      value={clientName}
                      onChange={(event) => setClientName(event.target.value)}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Location</span>
                    <Input
                      placeholder="Abu Dhabi"
                      value={location}
                      onChange={(event) => setLocation(event.target.value)}
                    />
                  </label>
                </div>
              ) : null}

              {wizardStep === 2 ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Houses</p>
                  <p className="text-xs text-slate-500">
                    Each house will start with default rooms: Entry, Living Room, Kitchen, Dining Room, Bedroom,
                    Bathroom.
                  </p>
                  {houseNames.map((houseName, index) => (
                    <div key={`house-${index}`} className="grid grid-cols-[1fr_140px_auto] items-center gap-2">
                      <Input
                        placeholder={`House ${index + 1}`}
                        value={houseName}
                        onChange={(event) => handleHouseNameChange(index, event.target.value)}
                      />
                      <Input
                        type="number"
                        min={0}
                        step="0.1"
                        placeholder="Size (m2)"
                        value={houseSizesSqmInput[index] ?? ""}
                        onChange={(event) => handleHouseSizeChange(index, event.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove house ${index + 1}`}
                        onClick={() => handleRemoveHouse(index)}
                        disabled={houseNames.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" onClick={handleAddHouse}>
                    <Plus className="h-4 w-4" />
                    Add house
                  </Button>
                </div>
              ) : null}

              {wizardStep === 3 ? (
                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p>
                    <span className="font-semibold text-slate-700">Project:</span> {projectName.trim()}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Client:</span>{" "}
                    {clientName.trim() || "Not specified"}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Location:</span>{" "}
                    {location.trim() || "Not specified"}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Houses:</span>
                  </p>
                  <ul className="space-y-1 rounded-md border border-slate-200 bg-white p-2">
                    {normalizedHouseData.map((house, index) => (
                      <li key={`${house.name}-${index}`} className="flex items-center justify-between text-xs text-slate-700">
                        <span>{house.name}</span>
                        <span>{house.sizeSqm > 0 ? `${house.sizeSqm} m2` : "Size not set"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {wizardError ? <p className="text-sm text-red-600">{wizardError}</p> : null}
            </div>

            <DialogFooter>
              {wizardStep > 1 ? (
                <Button type="button" variant="outline" onClick={() => setWizardStep((prev) => (prev - 1) as 1 | 2 | 3)}>
                  Back
                </Button>
              ) : null}

              {wizardStep < 3 ? (
                <Button
                  type="button"
                  onClick={() => {
                    if (wizardStep === 1 && !projectName.trim()) {
                      setWizardError("Project name is required.");
                      return;
                    }
                    if (wizardStep === 2 && normalizedHouseData.length === 0) {
                      setWizardError("Add at least one house.");
                      return;
                    }
                    setWizardError(null);
                    setWizardStep((prev) => (prev + 1) as 1 | 2 | 3);
                  }}
                >
                  Next
                </Button>
              ) : (
                <Button type="button" onClick={handleSubmitNewProject} disabled={!onCreateProject || isCreatingProject}>
                  {isCreatingProject ? "Creating..." : "Create project"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isProfileOpen}
          onOpenChange={(nextOpen) => {
            setIsProfileOpen(nextOpen);
            if (!nextOpen) {
              setProfileError(null);
              setProfileStatus(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Profile</DialogTitle>
              <DialogDescription>Set your designer details used across workspace collaboration.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</span>
                <Input value={profileEmail || "Signed in user"} readOnly disabled />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Full name</span>
                <Input
                  placeholder="Your full name"
                  value={profileFullName}
                  onChange={(event) => setProfileFullName(event.target.value)}
                  disabled={isProfileLoading || isProfileSaving || !isSupabaseConfigured}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Company name</span>
                <Input
                  placeholder="Your studio or company"
                  value={profileCompanyName}
                  onChange={(event) => setProfileCompanyName(event.target.value)}
                  disabled={isProfileLoading || isProfileSaving || !isSupabaseConfigured}
                />
              </label>
              {profileError ? <p className="text-sm text-red-600">{profileError}</p> : null}
              {profileStatus ? <p className="text-sm text-green-700">{profileStatus}</p> : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsProfileOpen(false)}>
                Close
              </Button>
              <Button
                type="button"
                onClick={() => void handleSaveProfile()}
                disabled={isProfileLoading || isProfileSaving || !isSupabaseConfigured}
              >
                {isProfileSaving ? "Saving..." : "Save profile"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isPreferencesOpen}
          onOpenChange={(nextOpen) => {
            setIsPreferencesOpen(nextOpen);
            if (!nextOpen) {
              setPreferencesStatus(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Preferences</DialogTitle>
              <DialogDescription>Personalize how your workspace behaves on this device.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Default currency</span>
                <select
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={preferences.defaultCurrency}
                  onChange={(event) =>
                    setPreferences((prev) => ({
                      ...prev,
                      defaultCurrency: event.target.value as UserPreferences["defaultCurrency"],
                    }))
                  }
                  disabled={!isPreferencesHydrated}
                >
                  <option value="USD">USD</option>
                  <option value="AED">AED</option>
                  <option value="EUR">EUR</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Area unit</span>
                <select
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={preferences.areaUnit}
                  onChange={(event) =>
                    setPreferences((prev) => ({
                      ...prev,
                      areaUnit: event.target.value as UserPreferences["areaUnit"],
                    }))
                  }
                  disabled={!isPreferencesHydrated}
                >
                  <option value="sqm">Square meter (m2)</option>
                  <option value="sqft">Square feet (ft2)</option>
                </select>
              </label>
              <label className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                <span className="text-sm text-slate-700">Compact list density</span>
                <input
                  type="checkbox"
                  checked={preferences.compactDensity}
                  onChange={(event) =>
                    setPreferences((prev) => ({
                      ...prev,
                      compactDensity: event.target.checked,
                    }))
                  }
                  disabled={!isPreferencesHydrated}
                />
              </label>
              <label className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                <span className="text-sm text-slate-700">Show workflow hints</span>
                <input
                  type="checkbox"
                  checked={preferences.showWorkflowHints}
                  onChange={(event) =>
                    setPreferences((prev) => ({
                      ...prev,
                      showWorkflowHints: event.target.checked,
                    }))
                  }
                  disabled={!isPreferencesHydrated}
                />
              </label>
              {preferencesStatus ? <p className="text-sm text-green-700">{preferencesStatus}</p> : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPreferencesOpen(false)}>
                Close
              </Button>
              <Button type="button" onClick={handleSavePreferences} disabled={!isPreferencesHydrated}>
                Save preferences
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Separator orientation="vertical" className="order-2 hidden h-6 md:block" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open profile menu" className="order-2 ml-auto md:order-none md:ml-0">
              <UserCircle2 className="h-5 w-5" />
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Designer account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                setIsProfileOpen(true);
              }}
            >
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                setIsPreferencesOpen(true);
              }}
            >
              Preferences
            </DropdownMenuItem>
            {feedbackUrl ? (
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  window.open(feedbackUrl, "_blank", "noopener,noreferrer");
                }}
              >
                <MessageSquare className="h-4 w-4" />
                Send feedback
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(event) => {
                if (!onSignOut) {
                  return;
                }
                event.preventDefault();
                onSignOut();
              }}
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

