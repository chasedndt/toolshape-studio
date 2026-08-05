import type { SafeArea, Scene, SceneNode, Size } from "@toolshape/studio-domain";

/**
 * Reframing one design into every platform format.
 *
 * This is the flagship agent workflow, and the reason is not that it is hard —
 * it is that it is *repetitive precision work with a checkable answer*. A human
 * resizing twelve variants by hand will drift; an agent will not, and every
 * result can be verified in code rather than judged by eye.
 *
 * So the deliverable is two functions, not one: a deterministic reframe, and an
 * independent check of whether a reframe is correct. The check does not trust
 * the reframe, which is what makes "the variants are correct" a fact rather
 * than a claim.
 */

export interface VariantFormat {
  id: string;
  name: string;
  size: Size;
}

export interface ReframeSceneOptions {
  scene: Scene;
  format: VariantFormat;
  /** Suffix for the produced scene and node ids. Keeps variants addressable. */
  idSuffix?: string;
}

/**
 * The scale that fits the source into the target without cropping content.
 *
 * The smaller of the two axis ratios: taking the larger would overflow the
 * frame on the other axis, which is how naive resizing pushes text off-canvas.
 */
function fitScale(from: Size, to: Size): number {
  return Math.min(to.width / from.width, to.height / from.height);
}

function scaleSafeArea(safeArea: SafeArea, scale: number): SafeArea {
  return {
    top: safeArea.top * scale,
    right: safeArea.right * scale,
    bottom: safeArea.bottom * scale,
    left: safeArea.left * scale,
  };
}

/**
 * Produces one variant of a scene at a new size.
 *
 * Positions are reframed relative to the centre rather than the origin. Scaling
 * raw coordinates from the top-left drifts every element toward one corner as
 * the aspect changes; anchoring to the centre keeps a composition looking like
 * the same composition.
 */
export function reframeScene(options: ReframeSceneOptions): Scene {
  const { scene, format } = options;
  const suffix = options.idSuffix ?? format.id;
  const scale = fitScale(scene.size, format.size);

  const sourceCentre = { x: scene.size.width / 2, y: scene.size.height / 2 };
  const targetCentre = { x: format.size.width / 2, y: format.size.height / 2 };

  const nodes: SceneNode[] = scene.nodes.map((node) => {
    // The node's own centre, so scaling does not shift it relative to itself.
    const centreX = node.transform.x + (node.size.width * node.transform.scaleX) / 2;
    const centreY = node.transform.y + (node.size.height * node.transform.scaleY) / 2;

    const nextCentreX = targetCentre.x + (centreX - sourceCentre.x) * scale;
    const nextCentreY = targetCentre.y + (centreY - sourceCentre.y) * scale;
    const nextScaleX = node.transform.scaleX * scale;
    const nextScaleY = node.transform.scaleY * scale;

    return {
      ...structuredClone(node),
      id: `${node.id}--${suffix}`,
      transform: {
        ...node.transform,
        x: nextCentreX - (node.size.width * nextScaleX) / 2,
        y: nextCentreY - (node.size.height * nextScaleY) / 2,
        scaleX: nextScaleX,
        scaleY: nextScaleY,
      },
    };
  });

  return {
    ...structuredClone(scene),
    id: `${scene.id}--${suffix}`,
    name: `${scene.name} · ${format.name}`,
    revision: 0,
    size: { ...format.size },
    safeArea: scaleSafeArea(scene.safeArea, scale),
    nodeIds: nodes.map((node) => node.id),
    nodes,
  };
}

export type VariantIssueCode =
  | "variant.node-count-changed"
  | "variant.order-changed"
  | "variant.outside-frame"
  | "variant.outside-safe-area"
  | "variant.aspect-distorted"
  | "variant.text-shrunk-below-legibility";

export interface VariantIssue {
  code: VariantIssueCode;
  nodeId?: string;
  message: string;
}

function boundsOf(node: SceneNode): { x: number; y: number; width: number; height: number } {
  return {
    x: node.transform.x,
    y: node.transform.y,
    width: node.size.width * node.transform.scaleX,
    height: node.size.height * node.transform.scaleY,
  };
}

function withinFrame(node: SceneNode, scene: Scene): boolean {
  const bounds = boundsOf(node);
  return (
    bounds.x >= -0.5 &&
    bounds.y >= -0.5 &&
    bounds.x + bounds.width <= scene.size.width + 0.5 &&
    bounds.y + bounds.height <= scene.size.height + 0.5
  );
}

function withinSafeArea(node: SceneNode, scene: Scene): boolean {
  const bounds = boundsOf(node);
  return (
    bounds.x >= scene.safeArea.left - 0.5 &&
    bounds.y >= scene.safeArea.top - 0.5 &&
    bounds.x + bounds.width <= scene.size.width - scene.safeArea.right + 0.5 &&
    bounds.y + bounds.height <= scene.size.height - scene.safeArea.bottom + 0.5
  );
}

export interface VerifyVariantOptions {
  source: Scene;
  variant: Scene;
  /** Text below this fraction of its original scale is treated as illegible. */
  minimumTextScale?: number;
}

/**
 * Checks a variant independently of how it was produced.
 *
 * Deliberately not a re-run of `reframeScene` compared against itself — that
 * would only prove the function is deterministic, which is not the question.
 * These are properties a correct variant must have regardless of who or what
 * made it, so a hand-edited or agent-authored variant is held to the same bar.
 */
export function verifyVariant(options: VerifyVariantOptions): VariantIssue[] {
  const { source, variant } = options;
  const minimumTextScale = options.minimumTextScale ?? 0.5;
  const issues: VariantIssue[] = [];

  if (source.nodes.length !== variant.nodes.length) {
    issues.push({
      code: "variant.node-count-changed",
      message: `Variant has ${variant.nodes.length} layers where the source has ${source.nodes.length}.`,
    });
    return issues;
  }

  // Hierarchy is stacking order. A variant that reorders layers is a different
  // design, however similar it looks at a glance.
  const sourceOrder = [...source.nodes].sort((a, b) => a.zIndex - b.zIndex).map((node) => node.name);
  const variantOrder = [...variant.nodes].sort((a, b) => a.zIndex - b.zIndex).map((node) => node.name);
  if (sourceOrder.join("|") !== variantOrder.join("|")) {
    issues.push({ code: "variant.order-changed", message: "Layer stacking order differs from the source." });
  }

  for (const [index, node] of variant.nodes.entries()) {
    const origin = source.nodes[index];

    // Compared against the source rather than against zero. A full-bleed
    // background or a decorative element that runs off the edge is a design
    // decision, and flagging it would report the designer's intent as a defect.
    // What matters is whether reframing made something worse.
    if (withinFrame(origin, source) && !withinFrame(node, variant)) {
      issues.push({
        code: "variant.outside-frame",
        nodeId: node.id,
        message: `“${node.name}” was inside the source frame but falls outside the variant.`,
      });
    }

    if (withinSafeArea(origin, source) && !withinSafeArea(node, variant)) {
      issues.push({
        code: "variant.outside-safe-area",
        nodeId: node.id,
        message: `“${node.name}” was inside the source safe area but crosses the variant's.`,
      });
    }

    // Non-uniform scaling stretches a logo or a face. Uniform scaling is the
    // whole reason fitScale takes the smaller ratio.
    const ratioX = node.transform.scaleX / (origin.transform.scaleX || 1);
    const ratioY = node.transform.scaleY / (origin.transform.scaleY || 1);
    if (Math.abs(ratioX - ratioY) > 0.001) {
      issues.push({
        code: "variant.aspect-distorted",
        nodeId: node.id,
        message: `“${node.name}” was scaled non-uniformly.`,
      });
    }

    if (node.type === "text" && ratioX < minimumTextScale) {
      issues.push({
        code: "variant.text-shrunk-below-legibility",
        nodeId: node.id,
        message: `“${node.name}” shrank to ${(ratioX * 100).toFixed(0)}% and may be illegible.`,
      });
    }
  }

  return issues;
}
