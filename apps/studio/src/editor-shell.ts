/**
 * Editor shell view state.
 *
 * Every value here is ephemeral operator preference. None of it enters
 * StudioProject, revisions, operation history, adapter documents, or project
 * digests — switching workspace or hiding a panel must never advance the
 * project revision (ADR 0009, ADR 0011).
 */
export type WorkspaceId = "home" | "capture" | "create" | "edit" | "review" | "automate";
export type LeftPanelId = "media" | "layers" | "text" | "audio" | "captions" | "sources";
export type RightPanelId = "inspector" | "agent" | "quality" | "capture" | "activity";
export type ShellRegion = "left" | "right" | "timeline";
export type AppMenuId = "file" | "edit" | "view";

export interface EditorShellState {
  workspace: WorkspaceId;
  leftPanel: LeftPanelId;
  rightPanel: RightPanelId;
  visibility: Record<ShellRegion, boolean>;
  activeMenu: AppMenuId | null;
}

export interface WorkspaceDefinition {
  id: WorkspaceId;
  label: string;
  description: string;
  shortcut: string;
  /**
   * Full-bleed workspaces own the whole viewport and suppress the rails and
   * timeline. Home is a dashboard, not an editing surface.
   */
  fullBleed?: boolean;
}

export const WORKSPACES: readonly WorkspaceDefinition[] = [
  { id: "home", label: "Home", description: "Projects, agent activity and jobs", shortcut: "1", fullBleed: true },
  { id: "capture", label: "Capture", description: "Record screen, window and camera", shortcut: "2" },
  { id: "create", label: "Create", description: "Canvas and layered design", shortcut: "3" },
  { id: "edit", label: "Edit", description: "Preview and temporal edit", shortcut: "4" },
  { id: "review", label: "Review", description: "Diffs, quality and approval", shortcut: "5" },
  { id: "automate", label: "Automate", description: "Plans, tasks and jobs", shortcut: "6" },
] as const;

const WORKSPACE_DEFAULTS: Record<WorkspaceId, Omit<EditorShellState, "workspace" | "activeMenu">> = {
  home: {
    leftPanel: "media",
    rightPanel: "agent",
    visibility: { left: false, right: false, timeline: false },
  },
  capture: {
    leftPanel: "sources",
    rightPanel: "capture",
    visibility: { left: true, right: true, timeline: false },
  },
  create: {
    leftPanel: "layers",
    rightPanel: "inspector",
    visibility: { left: true, right: true, timeline: false },
  },
  edit: {
    leftPanel: "media",
    rightPanel: "inspector",
    visibility: { left: true, right: true, timeline: true },
  },
  review: {
    leftPanel: "layers",
    // Review opens on Activity: the point of this workspace is seeing what
    // changed and who changed it, human or agent.
    rightPanel: "activity",
    visibility: { left: true, right: true, timeline: true },
  },
  automate: {
    leftPanel: "media",
    rightPanel: "agent",
    visibility: { left: true, right: true, timeline: false },
  },
};

export function isFullBleedWorkspace(workspace: WorkspaceId): boolean {
  return WORKSPACES.find((candidate) => candidate.id === workspace)?.fullBleed === true;
}

export function createEditorShellState(workspace: WorkspaceId = "edit"): EditorShellState {
  return {
    workspace,
    ...WORKSPACE_DEFAULTS[workspace],
    visibility: { ...WORKSPACE_DEFAULTS[workspace].visibility },
    activeMenu: null,
  };
}

export function switchWorkspace(state: EditorShellState, workspace: WorkspaceId): EditorShellState {
  return createEditorShellState(workspace);
}

export function toggleShellRegion(state: EditorShellState, region: ShellRegion): EditorShellState {
  return {
    ...state,
    visibility: { ...state.visibility, [region]: !state.visibility[region] },
    activeMenu: null,
  };
}

export function selectLeftPanel(state: EditorShellState, panel: LeftPanelId): EditorShellState {
  return {
    ...state,
    leftPanel: panel,
    visibility: { ...state.visibility, left: true },
    activeMenu: null,
  };
}

export function selectRightPanel(state: EditorShellState, panel: RightPanelId): EditorShellState {
  return {
    ...state,
    rightPanel: panel,
    visibility: { ...state.visibility, right: true },
    activeMenu: null,
  };
}

export function setActiveMenu(state: EditorShellState, menu: AppMenuId | null): EditorShellState {
  return { ...state, activeMenu: state.activeMenu === menu ? null : menu };
}
