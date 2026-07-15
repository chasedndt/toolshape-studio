import { describe, expect, it } from "vitest";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";
import {
  applyStudioOperation,
  rational,
  StaleStudioRevisionError,
  validateStudioProject,
} from "../src";

describe("Studio semantic operations", () => {
  it("splits with exact source time and preserves unrelated tracks", () => {
    const project = createGoldenStudioProject();
    const audioBefore = structuredClone(project.timeline.tracks.find((track) => track.id === "track-audio"));
    const result = applyStudioOperation(project, {
      operationId: "op-split",
      type: "timeline.clip.split",
      actor: "operator",
      expectedRevision: 0,
      payload: {
        trackId: "track-video",
        clipId: "clip-main",
        splitAt: rational(4),
        rightClipId: "clip-tail",
      },
    });

    const video = result.project.timeline.tracks.find((track) => track.id === "track-video");
    expect(video?.kind).toBe("video");
    if (video?.kind !== "video") throw new Error("Expected video track");
    expect(video.clips).toHaveLength(2);
    expect(video.clips[0].duration).toEqual(rational(4));
    expect(video.clips[1].start).toEqual(rational(4));
    expect(video.clips[1].sourceIn).toEqual(rational(4));
    expect(result.project.timeline.tracks.find((track) => track.id === "track-audio")).toEqual(audioBefore);
  });

  it("ripple trims subsequent clips and leaves captions untouched", () => {
    const split = applyStudioOperation(createGoldenStudioProject(), {
      operationId: "op-split",
      type: "timeline.clip.split",
      actor: "operator",
      expectedRevision: 0,
      payload: {
        trackId: "track-video",
        clipId: "clip-main",
        splitAt: rational(4),
        rightClipId: "clip-tail",
      },
    });
    const captionsBefore = structuredClone(
      split.project.timeline.tracks.find((track) => track.id === "track-captions"),
    );
    const trimmed = applyStudioOperation(split.project, {
      operationId: "op-ripple-trim",
      type: "timeline.clip.trim",
      actor: "operator",
      expectedRevision: 1,
      payload: {
        trackId: "track-video",
        clipId: "clip-main",
        newStart: rational(0),
        newDuration: rational(7, 2),
        ripple: true,
      },
    });

    const video = trimmed.project.timeline.tracks.find((track) => track.id === "track-video");
    if (video?.kind !== "video") throw new Error("Expected video track");
    expect(video.clips[1].start).toEqual(rational(7, 2));
    expect(trimmed.project.timeline.tracks.find((track) => track.id === "track-captions")).toEqual(
      captionsBefore,
    );
  });

  it("rejects stale operator edits", () => {
    const project = createGoldenStudioProject();
    project.revision = 3;
    expect(() =>
      applyStudioOperation(project, {
        operationId: "op-stale",
        type: "scene.node.update-text",
        actor: "agent",
        expectedRevision: 2,
        payload: { sceneId: "scene-hero", nodeId: "node-title", content: "Stale copy" },
      }),
    ).toThrow(StaleStudioRevisionError);
  });

  it("keeps agent-created content directly editable", () => {
    const project = createGoldenStudioProject();
    const agentResult = applyStudioOperation(project, {
      operationId: "op-agent-copy",
      type: "scene.node.update-text",
      actor: "agent",
      expectedRevision: 0,
      payload: { sceneId: "scene-hero", nodeId: "node-title", content: "Agent proposal" },
    });
    const operatorResult = applyStudioOperation(agentResult.project, {
      operationId: "op-operator-copy",
      type: "scene.node.update-text",
      actor: "operator",
      expectedRevision: 1,
      payload: { sceneId: "scene-hero", nodeId: "node-title", content: "Operator final" },
    });
    const title = operatorResult.project.scenes[0].nodes.find((node) => node.id === "node-title");
    expect(title?.type).toBe("text");
    if (title?.type !== "text") throw new Error("Expected text node");
    expect(title.content).toBe("Operator final");
    expect(operatorResult.project.provenance.map((entry) => entry.actor)).toEqual(["agent", "operator"]);
  });
});

describe("Studio validators", () => {
  it("accepts the golden fixture without invariant errors", () => {
    const issues = validateStudioProject(createGoldenStudioProject());
    expect(issues.filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("detects missing fonts, text overflow and safe-area risk", () => {
    const project = createGoldenStudioProject();
    const title = project.scenes[0].nodes.find((node) => node.id === "node-title");
    if (title?.type !== "text") throw new Error("Expected text node");
    title.fontFamily = "";
    title.content = "x".repeat(500);
    title.transform.x = -100;
    const codes = validateStudioProject(project).map((issue) => issue.code);
    expect(codes).toContain("text.missing-font");
    expect(codes).toContain("text.overflow-risk");
    expect(codes).toContain("scene.safe-area-risk");
  });

  it("rejects mutable or non-content-addressed assets", () => {
    const project = createGoldenStudioProject();
    Object.assign(project.assets[0], { immutable: false, contentHash: "bad" });
    const codes = validateStudioProject(project).map((issue) => issue.code);
    expect(codes).toContain("asset.mutable-source");
    expect(codes).toContain("asset.invalid-content-hash");
  });

  it("accepts strict content-addressed refs and rejects executable schemes", () => {
    const project = createGoldenStudioProject();
    project.assets[0].sourceRef = `content://sha256/${"d".repeat(64)}`;
    expect(validateStudioProject(project).map((issue) => issue.code)).not.toContain(
      "asset.unsafe-source-reference",
    );
    project.assets[0].sourceRef = "javascript:alert('unsafe')";
    expect(validateStudioProject(project).map((issue) => issue.code)).toContain(
      "asset.unsafe-source-reference",
    );
  });
});
