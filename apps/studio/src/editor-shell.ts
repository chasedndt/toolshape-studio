export type WorkspaceId = "create" | "edit" | "review" | "automate";
export type LeftPanelId = "media" | "layers" | "text" | "audio" | "captions";
export type RightPanelId = "inspector" | "agent" | "quality";
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
}

export const WORKSPACES: readonly WorkspaceDefinition[] = [
  { id: "create", label: "Create", description: "Canvas and layered design", shortcut: "1" },
  { id: "edit", label: "Edit", description: "Preview and temporal edit", shortcut: "2" },
  { id: "review", label: "Review", description: "Diffs, quality and approval", shortcut: "3" },
  { id: "automate", label: "Automate", description: "Plans, tasks and jobs", shortcut: "4" },
] as const;

const WORKSPACE_DEFAULTS: Record<WorkspaceId, Omit<EditorShellState, "workspace" | "activeMenu">> = {
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
    rightPanel: "agent",
    visibility: { left: true, right: true, timeline: true },
  },
  automate: {
    leftPanel: "media",
    rightPanel: "agent",
    visibility: { left: true, right: true, timeline: false },
  },
};

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
