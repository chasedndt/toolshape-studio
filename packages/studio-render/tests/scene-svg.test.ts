import { describe, expect, it } from "vitest";
import type { Effect, Scene, SceneNode } from "@toolshape/studio-domain";
import { createImageExportPlan, createVariantExportPlans, renderSceneToSvg } from "../src";

/**
 * The design pillar could produce nine platform variants and export none of
 * them. These cover the renderer that closes that, and lean hardest on the
 * parts where a mistake leaves the export looking finished while being wrong:
 * escaping, missing assets, and draw order.
 */

const TRANSFORM = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotationDeg: 0, opacity: 1 };

function base(id: string, overrides: Partial<SceneNode> = {}) {
  return {
    id,
    name: id,
    revision: 0,
    visible: true,
    locked: false,
    zIndex: 0,
    transform: { ...TRANSFORM },
    size: { width: 100, height: 100 },
    effectIds: [],
    animations: {},
    ...overrides,
  };
}

function shape(id: string, overrides: Record<string, unknown> = {}): SceneNode {
  return { ...base(id), type: "shape", shape: "rectangle", fill: "#ff0000", cornerRadius: 0, ...overrides } as SceneNode;
}

function text(id: string, overrides: Record<string, unknown> = {}): SceneNode {
  return {
    ...base(id),
    type: "text",
    content: "Hello",
    fontFamily: "Inter",
    fontSize: 24,
    fontWeight: 600,
    lineHeight: 1.4,
    alignment: "left",
    color: "#ffffff",
    maxLines: 0,
    ...overrides,
  } as SceneNode;
}

function scene(nodes: SceneNode[], overrides: Partial<Scene> = {}): Scene {
  return {
    id: "scene-1",
    name: "Scene",
    revision: 0,
    size: { width: 400, height: 300 },
    safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
    background: "#101014",
    nodeIds: nodes.map((node) => node.id),
    nodes,
    ...overrides,
  };
}

describe("renderSceneToSvg", () => {
  it("emits a document sized to the scene", () => {
    const svg = renderSceneToSvg(scene([shape("a")]));
    expect(svg).toContain('width="400" height="300"');
    expect(svg).toContain('viewBox="0 0 400 300"');
  });

  it("paints the scene background", () => {
    expect(renderSceneToSvg(scene([]))).toContain('fill="#101014"');
  });

  it("draws nodes in z-index order", () => {
    const svg = renderSceneToSvg(
      scene([shape("front", { zIndex: 10, fill: "#00ff00" }), shape("back", { zIndex: 1, fill: "#0000ff" })]),
    );
    // Later in the document paints on top, so the higher z-index must come last.
    expect(svg.indexOf("#0000ff")).toBeLessThan(svg.indexOf("#00ff00"));
  });

  it("breaks z-index ties deterministically", () => {
    // Two nodes at the same depth must not swap places between runs, or the
    // same design exports to a different file each time.
    const nodes = [shape("b", { fill: "#00ff00" }), shape("a", { fill: "#0000ff" })];
    const first = renderSceneToSvg(scene(nodes));
    const second = renderSceneToSvg(scene([...nodes].reverse()));
    expect(first).toBe(second);
  });

  it("omits an invisible node", () => {
    expect(renderSceneToSvg(scene([shape("a", { visible: false, fill: "#abcdef" })]))).not.toContain("#abcdef");
  });

  it("omits a fully transparent node", () => {
    const svg = renderSceneToSvg(scene([shape("a", { transform: { ...TRANSFORM, opacity: 0 }, fill: "#abcdef" })]));
    expect(svg).not.toContain("#abcdef");
  });

  it("clips content to the scene bounds", () => {
    expect(renderSceneToSvg(scene([shape("a")]))).toContain('clip-path="url(#scene-bounds)"');
  });
});

describe("renderSceneToSvg escaping", () => {
  it("escapes text content rather than emitting it as markup", () => {
    // An exported design is something the user hands to someone else, and it
    // has to be inert when they open it.
    const svg = renderSceneToSvg(scene([text("a", { content: "</text><script>alert(1)</script>" })]));
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });

  it("escapes the scene name in the title", () => {
    const svg = renderSceneToSvg(scene([], { name: 'Bad" onload="x' }));
    expect(svg).not.toContain('onload="x"');
    expect(svg).toContain("&quot;");
  });

  it("strips a font family that would escape its attribute", () => {
    const svg = renderSceneToSvg(scene([text("a", { fontFamily: 'Inter" onload="alert(1)' })]));
    // The letters may survive inside the value; what must not survive is the
    // quote that would end the attribute and start a new one.
    expect(svg).not.toContain("onload=");
    expect(svg).toContain('font-family="Inter onloadalert1"');
  });

  it("refuses a fill that is a reference rather than a colour", () => {
    // The attribute grammar also accepts url(#...), which points at arbitrary
    // other content.
    expect(() => renderSceneToSvg(scene([shape("a", { fill: "url(#evil)" })]))).toThrow(/hex colour/i);
  });

  it("refuses a background that is not a colour", () => {
    expect(() => renderSceneToSvg(scene([], { background: "javascript:alert(1)" }))).toThrow(/hex colour/i);
  });

  it("strips control characters that XML cannot represent", () => {
    const bell = String.fromCharCode(7);
    const svg = renderSceneToSvg(scene([text("a", { content: `one${bell}two` })]));
    expect(svg).toContain("onetwo");
    expect(svg).not.toContain(bell);
  });
});

describe("renderSceneToSvg images", () => {
  const image = (overrides: Record<string, unknown> = {}): SceneNode =>
    ({ ...base("img"), type: "image", assetId: "asset-1", fit: "cover", cornerRadius: 0, ...overrides }) as SceneNode;

  const data = { "asset-1": { mediaType: "image/png", base64: "iVBORw0KGgo=" } };

  it("embeds image bytes as a data URI", () => {
    const svg = renderSceneToSvg(scene([image()]), { imageData: data });
    expect(svg).toContain("data:image/png;base64,iVBORw0KGgo=");
  });

  it("never emits a remote reference", () => {
    // A remote href would turn an exported design into a tracking beacon that
    // reports every time the recipient opens it.
    const svg = renderSceneToSvg(scene([image()]), { imageData: data });
    expect(svg).not.toMatch(/href="https?:/);
  });

  it("refuses an image whose bytes were not supplied", () => {
    // Rejected rather than drawn as a placeholder: an export with a silent hole
    // in it looks finished, and gets sent.
    expect(() => renderSceneToSvg(scene([image()]))).toThrow(/were not supplied/i);
  });

  it("refuses a media type that is not an image", () => {
    expect(() =>
      renderSceneToSvg(scene([image()]), {
        imageData: { "asset-1": { mediaType: "text/html", base64: "abcd" } },
      }),
    ).toThrow(/unsupported media type/i);
  });

  it("refuses payload that is not base64", () => {
    expect(() =>
      renderSceneToSvg(scene([image()]), {
        imageData: { "asset-1": { mediaType: "image/png", base64: '"><script>' } },
      }),
    ).toThrow(/base64/i);
  });

  it("clips a rounded image instead of letting the corners show", () => {
    const svg = renderSceneToSvg(scene([image({ cornerRadius: 12 })]), { imageData: data });
    expect(svg).toContain("<clipPath");
  });
});

describe("renderSceneToSvg effects", () => {
  const effect = (type: Effect["type"], parameters: Record<string, number>): Effect => ({
    id: `effect-${type}`,
    type,
    enabled: true,
    parameters,
    revision: 0,
  });

  it("expresses blur as a filter primitive rather than a CSS shorthand", () => {
    // The shorthand only works where a CSS engine is present, so an SVG using
    // it renders in a browser and silently loses its effects everywhere else.
    const svg = renderSceneToSvg(scene([shape("a", { effectIds: ["effect-blur"] })]), {
      effects: [effect("blur", { radius: 10 })],
    });
    expect(svg).toContain("<feGaussianBlur");
    expect(svg).not.toContain("filter: blur");
  });

  it("expresses saturation and hue as colour matrices", () => {
    const svg = renderSceneToSvg(
      scene([shape("a", { effectIds: ["effect-saturation", "effect-colour-shift"] })]),
      { effects: [effect("saturation", { amount: 0.2 }), effect("colour-shift", { hueDegrees: 90 })] },
    );
    expect(svg).toContain('type="saturate"');
    expect(svg).toContain('type="hueRotate"');
  });

  it("applies opacity as an attribute, not a filter", () => {
    const svg = renderSceneToSvg(scene([shape("a", { effectIds: ["effect-opacity"] })]), {
      effects: [effect("opacity", { amount: 0.5 })],
    });
    expect(svg).toContain('opacity="0.5"');
    expect(svg).not.toContain("<filter");
  });

  it("ignores a disabled effect", () => {
    const svg = renderSceneToSvg(scene([shape("a", { effectIds: ["effect-blur"] })]), {
      effects: [{ ...effect("blur", { radius: 10 }), enabled: false }],
    });
    expect(svg).not.toContain("feGaussianBlur");
  });
});

describe("renderSceneToSvg groups", () => {
  it("draws a grouped child once, inside its group", () => {
    // Drawing it at the top level too would paint it twice: once with the
    // group's transform and once without.
    const child = shape("child", { fill: "#123456" });
    const group = { ...base("group"), type: "group", childIds: ["child"] } as SceneNode;
    const svg = renderSceneToSvg(scene([group, child]));
    expect(svg.split("#123456")).toHaveLength(2);
  });
});

describe("createImageExportPlan", () => {
  const target = scene([shape("a")]);

  it("infers the format from the output path", () => {
    expect(createImageExportPlan({ scene: target, outputPath: "/out/design.png" }).format).toBe("png");
    expect(createImageExportPlan({ scene: target, outputPath: "/out/design.jpg" }).format).toBe("jpeg");
    expect(createImageExportPlan({ scene: target, outputPath: "/out/design.pdf" }).format).toBe("pdf");
  });

  it("scales the output from the scene size", () => {
    const plan = createImageExportPlan({ scene: target, outputPath: "/out/design.png", scale: 3 });
    expect(plan.width).toBe(1200);
    expect(plan.height).toBe(900);
  });

  it("gives every format the same document", () => {
    // A PNG and a PDF of the same scene must not disagree about where the text
    // sits, which is only guaranteed if one renderer produces both.
    const png = createImageExportPlan({ scene: target, outputPath: "/out/a.png" });
    const pdf = createImageExportPlan({ scene: target, outputPath: "/out/a.pdf" });
    expect(png.document).toBe(pdf.document);
  });

  it("adds an XML prolog only for a standalone svg file", () => {
    expect(createImageExportPlan({ scene: target, outputPath: "/out/a.svg" }).document).toMatch(/^<\?xml/);
    expect(createImageExportPlan({ scene: target, outputPath: "/out/a.png" }).document).not.toMatch(/^<\?xml/);
  });

  it("writes to a partial path first", () => {
    const plan = createImageExportPlan({ scene: target, outputPath: "/out/design.png" });
    expect(plan.partialOutputPath).not.toBe(plan.finalOutputPath);
    expect(plan.partialOutputPath).toContain(".partial.png");
  });

  it("reports quality only for lossy formats", () => {
    expect(createImageExportPlan({ scene: target, outputPath: "/out/a.png" }).quality).toBeNull();
    expect(createImageExportPlan({ scene: target, outputPath: "/out/a.jpg", quality: 70 }).quality).toBe(70);
  });

  it("refuses quality on a lossless format", () => {
    // A caller who set quality on a PNG should find out, not assume it took.
    expect(() => createImageExportPlan({ scene: target, outputPath: "/out/a.png", quality: 70 })).toThrow(
      /lossless/i,
    );
  });

  it("refuses a transparent background where the format has no alpha", () => {
    expect(() =>
      createImageExportPlan({ scene: target, outputPath: "/out/a.jpg", transparentBackground: true }),
    ).toThrow(/alpha/i);
  });

  it("drops the background when transparency is asked for", () => {
    const plan = createImageExportPlan({
      scene: target,
      outputPath: "/out/a.png",
      transparentBackground: true,
    });
    expect(plan.document).toContain("#00000000");
    expect(plan.transparent).toBe(true);
  });

  it("refuses a format that disagrees with the path extension", () => {
    // PNG bytes in a file called .jpeg open in nothing by name and are trusted
    // by extension everywhere downstream.
    expect(() =>
      createImageExportPlan({ scene: target, outputPath: "/out/a.jpeg", format: "png" }),
    ).toThrow(/does not match/i);
  });

  it("refuses an unrecognised extension", () => {
    expect(() => createImageExportPlan({ scene: target, outputPath: "/out/a.tiff" })).toThrow(
      /cannot infer/i,
    );
  });

  it("refuses an export beyond the megapixel ceiling", () => {
    expect(() => createImageExportPlan({ scene: target, outputPath: "/out/a.png", scale: 60 })).toThrow(
      /megapixel/i,
    );
  });

  it("refuses a non-positive scale", () => {
    expect(() => createImageExportPlan({ scene: target, outputPath: "/out/a.png", scale: 0 })).toThrow(
      /positive/i,
    );
  });
});

describe("createVariantExportPlans", () => {
  it("plans one file per scene", () => {
    const plans = createVariantExportPlans({
      scenes: [scene([shape("a")], { id: "story" }), scene([shape("a")], { id: "square" })],
      directory: "/out",
      format: "png",
    });
    expect(plans.map((plan) => plan.finalOutputPath.replace(/\\/g, "/"))).toEqual([
      "/out/story.png",
      "/out/square.png",
    ]);
  });

  it("uses the .jpg extension for jpeg", () => {
    const [plan] = createVariantExportPlans({
      scenes: [scene([shape("a")], { id: "story" })],
      directory: "/out",
      format: "jpeg",
    });
    expect(plan.finalOutputPath).toContain("story.jpg");
  });

  it("refuses two scenes that resolve to the same filename", () => {
    // Otherwise the second export silently overwrites the first and the batch
    // reports success having produced one fewer file than asked for.
    expect(() =>
      createVariantExportPlans({
        scenes: [scene([], { id: "a/b" }), scene([], { id: "a-b" })],
        directory: "/out",
        format: "png",
      }),
    ).toThrow(/same export filename/i);
  });

  it("refuses an empty batch", () => {
    expect(() => createVariantExportPlans({ scenes: [], directory: "/out", format: "png" })).toThrow(
      /at least one scene/i,
    );
  });
});
