import { describe, expect, it } from "vitest";
import type { Scene } from "@toolshape/studio-domain";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";
import { reframeScene, verifyVariant, type VariantFormat } from "../src";

/**
 * Variants are the clearest case for an agent doing the work: twelve formats by
 * hand drift, twelve by machine do not, and every result can be checked in code
 * rather than judged by eye.
 *
 * So these tests exercise the checker as hard as the reframer — including
 * against deliberately broken variants, because a verifier that only ever sees
 * correct input proves nothing.
 */

const PORTRAIT: VariantFormat = { id: "story", name: "Story", size: { width: 1080, height: 1920 } };
const SQUARE: VariantFormat = { id: "square", name: "Square", size: { width: 1080, height: 1080 } };
const LANDSCAPE: VariantFormat = { id: "wide", name: "Wide", size: { width: 1920, height: 1080 } };

function source(): Scene {
  return createGoldenStudioProject().scenes[0];
}

describe("reframing", () => {
  it("produces a scene at the requested size", () => {
    const variant = reframeScene({ scene: source(), format: SQUARE });
    expect(variant.size).toEqual({ width: 1080, height: 1080 });
  });

  it("keeps every layer", () => {
    const scene = source();
    const variant = reframeScene({ scene, format: LANDSCAPE });
    expect(variant.nodes).toHaveLength(scene.nodes.length);
    expect(variant.nodeIds).toHaveLength(scene.nodes.length);
  });

  it("gives variant nodes distinct ids so both can live in one project", () => {
    const scene = source();
    const variant = reframeScene({ scene, format: SQUARE });
    for (const [index, node] of variant.nodes.entries()) {
      expect(node.id).not.toBe(scene.nodes[index].id);
      expect(node.id).toContain(scene.nodes[index].id);
    }
    expect(variant.id).not.toBe(scene.id);
  });

  it("scales uniformly rather than stretching to fit", () => {
    // Taking each axis independently would distort a logo or a face.
    const variant = reframeScene({ scene: source(), format: LANDSCAPE });
    for (const node of variant.nodes) {
      expect(node.transform.scaleX).toBeCloseTo(node.transform.scaleY, 6);
    }
  });

  it("anchors to the centre so a composition does not drift into a corner", () => {
    const scene = source();
    const variant = reframeScene({ scene, format: SQUARE });

    const centreOf = (node: { transform: { x: number; y: number; scaleX: number; scaleY: number }; size: { width: number; height: number } }, size: { width: number; height: number }) => ({
      x: (node.transform.x + (node.size.width * node.transform.scaleX) / 2) / size.width,
      y: (node.transform.y + (node.size.height * node.transform.scaleY) / 2) / size.height,
    });

    // A node dead-centre in the source stays dead-centre in the variant.
    const middleIndex = scene.nodes.findIndex((node) => {
      const centre = centreOf(node, scene.size);
      return Math.abs(centre.x - 0.5) < 0.12;
    });
    if (middleIndex < 0) return;
    const after = centreOf(variant.nodes[middleIndex], variant.size);
    expect(after.x).toBeCloseTo(0.5, 1);
  });

  it("is deterministic", () => {
    const scene = source();
    expect(JSON.stringify(reframeScene({ scene, format: PORTRAIT }))).toBe(
      JSON.stringify(reframeScene({ scene, format: PORTRAIT })),
    );
  });
});

describe("verification", () => {
  it("passes a variant its own reframer produced", () => {
    const scene = source();
    for (const format of [PORTRAIT, SQUARE, LANDSCAPE]) {
      const variant = reframeScene({ scene, format });
      expect(verifyVariant({ source: scene, variant })).toEqual([]);
    }
  });

  it("catches a layer pushed outside the frame", () => {
    const scene = source();
    const variant = reframeScene({ scene, format: SQUARE });
    variant.nodes[0].transform.x = variant.size.width + 10;
    const issues = verifyVariant({ source: scene, variant });
    expect(issues.some((issue) => issue.code === "variant.outside-frame")).toBe(true);
  });

  it("catches a layer crossing the safe area", () => {
    const scene = source();
    const variant = reframeScene({ scene, format: SQUARE });
    variant.safeArea = { top: 400, right: 400, bottom: 400, left: 400 };
    const issues = verifyVariant({ source: scene, variant });
    expect(issues.some((issue) => issue.code === "variant.outside-safe-area")).toBe(true);
  });

  it("catches non-uniform scaling", () => {
    const scene = source();
    const variant = reframeScene({ scene, format: SQUARE });
    variant.nodes[0].transform.scaleX *= 1.5;
    const issues = verifyVariant({ source: scene, variant });
    expect(issues.some((issue) => issue.code === "variant.aspect-distorted")).toBe(true);
  });

  it("catches reordered layers", () => {
    // A variant that reorders layers is a different design, however similar it
    // looks at a glance.
    const scene = source();
    const variant = reframeScene({ scene, format: SQUARE });
    const [first, second] = [variant.nodes[0].zIndex, variant.nodes[1].zIndex];
    variant.nodes[0].zIndex = second;
    variant.nodes[1].zIndex = first;
    const issues = verifyVariant({ source: scene, variant });
    expect(issues.some((issue) => issue.code === "variant.order-changed")).toBe(true);
  });

  it("catches a dropped layer", () => {
    const scene = source();
    const variant = reframeScene({ scene, format: SQUARE });
    variant.nodes = variant.nodes.slice(1);
    const issues = verifyVariant({ source: scene, variant });
    expect(issues.some((issue) => issue.code === "variant.node-count-changed")).toBe(true);
  });

  it("flags text shrunk below legibility", () => {
    const scene = source();
    const variant = reframeScene({ scene, format: SQUARE });
    const text = variant.nodes.find((node) => node.type === "text");
    if (!text) return;
    text.transform.scaleX *= 0.2;
    text.transform.scaleY *= 0.2;
    const issues = verifyVariant({ source: scene, variant, minimumTextScale: 0.5 });
    expect(issues.some((issue) => issue.code === "variant.text-shrunk-below-legibility")).toBe(true);
  });

  it("does not merely re-run the reframer", () => {
    // A verifier that recomputes and compares would pass anything the reframer
    // produces, including a wrong reframer. This variant is internally
    // consistent and still wrong, and must be caught.
    const scene = source();
    const variant = reframeScene({ scene, format: SQUARE });
    for (const node of variant.nodes) {
      node.transform.x -= 5000;
    }
    expect(verifyVariant({ source: scene, variant }).length).toBeGreaterThan(0);
  });
});
