import { describe, expect, it } from "vitest";
import {
  createEditorShellState,
  selectLeftPanel,
  selectRightPanel,
  setActiveMenu,
  switchWorkspace,
  toggleShellRegion,
} from "./editor-shell";

describe("editor shell view state", () => {
  it("starts in the complete edit workspace without touching document state", () => {
    expect(createEditorShellState()).toEqual({
      workspace: "edit",
      leftPanel: "media",
      rightPanel: "inspector",
      visibility: { left: true, right: true, timeline: true },
      activeMenu: null,
    });
  });

  it("applies deterministic workspace arrangements and closes menus", () => {
    const state = setActiveMenu(createEditorShellState(), "view");

    expect(switchWorkspace(state, "create")).toEqual({
      workspace: "create",
      leftPanel: "layers",
      rightPanel: "inspector",
      visibility: { left: true, right: true, timeline: false },
      activeMenu: null,
    });
    expect(switchWorkspace(state, "review")).toEqual({
      workspace: "review",
      leftPanel: "layers",
      rightPanel: "agent",
      visibility: { left: true, right: true, timeline: true },
      activeMenu: null,
    });
    expect(switchWorkspace(state, "automate")).toEqual({
      workspace: "automate",
      leftPanel: "media",
      rightPanel: "agent",
      visibility: { left: true, right: true, timeline: false },
      activeMenu: null,
    });
  });

  it("toggles regions independently and always closes the active menu", () => {
    const state = setActiveMenu(createEditorShellState(), "view");
    const withoutRight = toggleShellRegion(state, "right");
    const withoutTimeline = toggleShellRegion(withoutRight, "timeline");

    expect(withoutTimeline.visibility).toEqual({ left: true, right: false, timeline: false });
    expect(withoutTimeline.activeMenu).toBeNull();
  });

  it("reopens a rail when a panel inside it is selected", () => {
    const hidden = toggleShellRegion(toggleShellRegion(createEditorShellState(), "left"), "right");

    expect(selectLeftPanel(hidden, "captions")).toMatchObject({
      leftPanel: "captions",
      visibility: { left: true, right: false, timeline: true },
    });
    expect(selectRightPanel(hidden, "quality")).toMatchObject({
      rightPanel: "quality",
      visibility: { left: false, right: true, timeline: true },
    });
  });
});
