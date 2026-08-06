import type { Asset, Effect, Scene, SceneNode, TextNode } from "@toolshape/studio-domain";

/**
 * Renders a scene to SVG.
 *
 * The design pillar could produce nine platform variants and export none of
 * them: scenes existed as data with nothing turning them into a file anyone
 * could open. This closes that, and SVG is the right thing to close it with —
 * it is itself a delivery format, it needs no browser to produce, and every
 * raster format we offer is a rasterisation of this one output. One renderer,
 * not one per format.
 *
 * SVG is an active document format, so the escaping and the value checks below
 * are not tidiness. An exported design is something the user hands to someone
 * else, and it has to be inert when they open it.
 */

export interface RenderSceneToSvgOptions {
  /**
   * Bytes for image assets, keyed by asset id, embedded as data URIs.
   *
   * Deliberately not a URL map. A remote href would turn an exported design
   * into a tracking beacon that reports every time the recipient opens it, and
   * would render differently — or not at all — once the host went away.
   */
  imageData?: Readonly<Record<string, { mediaType: string; base64: string }>>;
  effects?: readonly Effect[];
  assets?: readonly Asset[];
  /** Emit an XML prolog. Off for embedding, on for a standalone .svg file. */
  standalone?: boolean;
}

export class SceneRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SceneRenderError";
  }
}

/** Not representable in XML 1.0 at all, so a document containing one fails to parse. */
const CONTROL_CHARACTERS = new RegExp("[\u0000-\u0008\u000B\u000C\u000E-\u001F]", "g");

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/**
 * Escapes text for both element content and attribute values.
 *
 * Control characters are stripped rather than escaped: they are not
 * representable in XML 1.0 at all, and a document containing one fails to
 * parse rather than rendering with a stray glyph.
 */
function escapeXml(value: string): string {
  return value
    .replace(CONTROL_CHARACTERS, "")
    .replace(/[&<>"']/g, (character) => XML_ESCAPES[character]);
}

const COLOUR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * Colours go into presentation attributes, where the grammar also accepts
 * `url(#...)` — a reference to arbitrary other content. Restricting to hex
 * literals keeps a fill from becoming a reference.
 */
function colour(value: string, label: string): string {
  if (!COLOUR.test(value)) {
    throw new SceneRenderError(`${label} must be a hex colour, received ${JSON.stringify(value)}.`);
  }
  return value;
}

/**
 * Font families are emitted into a font-family attribute, which is a
 * comma-separated list — a quote or semicolon there escapes the value.
 */
function fontFamily(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9 _-]/g, "").trim();
  return cleaned.length > 0 ? cleaned : "sans-serif";
}

const MEDIA_TYPE = /^image\/(png|jpeg|webp|gif|avif)$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

function num(value: number): string {
  if (!Number.isFinite(value)) {
    throw new SceneRenderError("A geometry value was not a finite number.");
  }
  // Fixed precision so the same scene always produces byte-identical output,
  // which is what makes an exported file comparable across runs.
  return Number(value.toFixed(4)).toString();
}

/**
 * Effects become filter primitives rather than the CSS `filter` shorthand.
 *
 * The shorthand only works where a CSS engine is present, so an SVG using it
 * renders in a browser and silently loses its effects everywhere else. These
 * primitives are plain SVG 1.1 and survive the trip.
 */
function filterPrimitives(effect: Effect): string | null {
  const parameters = effect.parameters;
  switch (effect.type) {
    case "blur": {
      const radius = parameters.radius ?? 0;
      return radius > 0 ? `<feGaussianBlur stdDeviation="${num(radius / 2)}"/>` : null;
    }
    case "brightness": {
      // Additive, matching the domain's -1..1 range where 0 is unchanged.
      const amount = parameters.amount ?? 0;
      if (amount === 0) return null;
      return (
        `<feComponentTransfer>` +
        ["R", "G", "B"]
          .map((channel) => `<feFunc${channel} type="linear" slope="1" intercept="${num(amount)}"/>`)
          .join("") +
        `</feComponentTransfer>`
      );
    }
    case "contrast": {
      const amount = parameters.amount ?? 1;
      if (amount === 1) return null;
      const intercept = (1 - amount) / 2;
      return (
        `<feComponentTransfer>` +
        ["R", "G", "B"]
          .map(
            (channel) =>
              `<feFunc${channel} type="linear" slope="${num(amount)}" intercept="${num(intercept)}"/>`,
          )
          .join("") +
        `</feComponentTransfer>`
      );
    }
    case "saturation": {
      const amount = parameters.amount ?? 1;
      return amount === 1 ? null : `<feColorMatrix type="saturate" values="${num(amount)}"/>`;
    }
    case "colour-shift": {
      const degrees = parameters.hueDegrees ?? 0;
      return degrees === 0 ? null : `<feColorMatrix type="hueRotate" values="${num(degrees)}"/>`;
    }
    case "opacity":
      // Handled as an attribute on the node, not a filter: a filter would
      // composite the node against transparency and then draw that, which
      // double-applies wherever the node overlaps itself.
      return null;
    default:
      return null;
  }
}

interface NodeEffects {
  filterMarkup: string;
  filterRef: string | null;
  opacity: number;
}

function resolveEffects(node: SceneNode, effects: readonly Effect[]): NodeEffects {
  const applied = node.effectIds
    .map((id) => effects.find((effect) => effect.id === id))
    .filter((effect): effect is Effect => effect !== undefined && effect.enabled);

  const opacity = applied
    .filter((effect) => effect.type === "opacity")
    .reduce((carried, effect) => carried * (effect.parameters.amount ?? 1), 1);

  const primitives = applied.map(filterPrimitives).filter((markup): markup is string => markup !== null);
  if (primitives.length === 0) {
    return { filterMarkup: "", filterRef: null, opacity };
  }

  // Derived from the node id rather than a counter, so inserting a node earlier
  // in the scene does not renumber every filter after it.
  const id = `fx-${escapeXml(node.id)}`;
  return {
    // A generous region: the default -10%/120% clips a wide blur, which reads
    // as a hard edge partway through the falloff.
    filterMarkup: `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">${primitives.join("")}</filter>`,
    filterRef: id,
    opacity,
  };
}

/**
 * Wraps text into lines.
 *
 * SVG has no automatic wrapping, so the break points are decided here against
 * an estimated glyph width. That estimate is the honest limitation of this
 * renderer: without measuring the actual font, a line can come out slightly
 * short or slightly long. It breaks on whitespace and never mid-word, so the
 * error is a ragged edge rather than a broken word.
 */
function wrapText(node: TextNode): string[] {
  const perCharacter = node.fontSize * 0.52;
  const maxCharacters = Math.max(1, Math.floor(node.size.width / perCharacter));
  const lines: string[] = [];

  for (const paragraph of node.content.split("\n")) {
    if (paragraph.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = current.length === 0 ? word : `${current} ${word}`;
      if (candidate.length <= maxCharacters || current.length === 0) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current.length > 0) lines.push(current);
  }

  if (node.maxLines > 0 && lines.length > node.maxLines) {
    const kept = lines.slice(0, node.maxLines);
    // Truncation is marked rather than silent, so an export that lost words
    // says so on its face instead of reading as complete.
    kept[kept.length - 1] = `${kept[kept.length - 1].replace(/\s+\S*$/, "")}…`;
    return kept;
  }
  return lines;
}

function transformAttribute(node: SceneNode): string {
  const { transform, size } = node;
  const parts = [`translate(${num(transform.x)} ${num(transform.y)})`];
  if (transform.rotationDeg !== 0 || transform.scaleX !== 1 || transform.scaleY !== 1) {
    // Rotation and scale are about the node's own centre. Anchoring at the
    // origin instead would send a rotated node sliding away from where the
    // editor showed it.
    const cx = size.width / 2;
    const cy = size.height / 2;
    parts.push(`translate(${num(cx)} ${num(cy)})`);
    if (transform.rotationDeg !== 0) parts.push(`rotate(${num(transform.rotationDeg)})`);
    if (transform.scaleX !== 1 || transform.scaleY !== 1) {
      parts.push(`scale(${num(transform.scaleX)} ${num(transform.scaleY)})`);
    }
    parts.push(`translate(${num(-cx)} ${num(-cy)})`);
  }
  return parts.join(" ");
}

function renderShape(node: Extract<SceneNode, { type: "shape" }>): string {
  const fill = colour(node.fill, `Shape ${node.id} fill`);
  const stroke = node.stroke ? ` stroke="${colour(node.stroke, `Shape ${node.id} stroke`)}"` : "";
  const strokeWidth = node.stroke ? ` stroke-width="${num(node.strokeWidth ?? 1)}"` : "";

  if (node.shape === "ellipse") {
    return (
      `<ellipse cx="${num(node.size.width / 2)}" cy="${num(node.size.height / 2)}" ` +
      `rx="${num(node.size.width / 2)}" ry="${num(node.size.height / 2)}" fill="${fill}"${stroke}${strokeWidth}/>`
    );
  }
  const radius = node.cornerRadius > 0 ? ` rx="${num(node.cornerRadius)}" ry="${num(node.cornerRadius)}"` : "";
  return `<rect width="${num(node.size.width)}" height="${num(node.size.height)}" fill="${fill}"${radius}${stroke}${strokeWidth}/>`;
}

function renderImage(
  node: Extract<SceneNode, { type: "image" }>,
  options: RenderSceneToSvgOptions,
): string {
  const data = options.imageData?.[node.assetId];
  if (!data) {
    // Rejected rather than drawn as a placeholder. An export with a silent hole
    // in it looks finished, and gets sent.
    throw new SceneRenderError(
      `Image node ${node.id} references asset ${node.assetId}, whose bytes were not supplied.`,
    );
  }
  if (!MEDIA_TYPE.test(data.mediaType)) {
    throw new SceneRenderError(`Asset ${node.assetId} has unsupported media type ${data.mediaType}.`);
  }
  if (!BASE64.test(data.base64)) {
    throw new SceneRenderError(`Asset ${node.assetId} was not valid base64.`);
  }

  const preserve =
    node.fit === "fill"
      ? "none"
      : node.fit === "cover"
        ? "xMidYMid slice"
        : "xMidYMid meet";

  const image =
    `<image href="data:${data.mediaType};base64,${data.base64}" ` +
    `width="${num(node.size.width)}" height="${num(node.size.height)}" ` +
    `preserveAspectRatio="${preserve}"/>`;

  if (node.cornerRadius <= 0) return image;
  const clipId = `clip-${escapeXml(node.id)}`;
  return (
    `<clipPath id="${clipId}"><rect width="${num(node.size.width)}" height="${num(node.size.height)}" ` +
    `rx="${num(node.cornerRadius)}" ry="${num(node.cornerRadius)}"/></clipPath>` +
    `<g clip-path="url(#${clipId})">${image}</g>`
  );
}

function renderText(node: TextNode): string {
  const lines = wrapText(node);
  const fill = colour(node.color, `Text ${node.id} colour`);
  const lineHeight = node.fontSize * node.lineHeight;
  const anchor = node.alignment === "center" ? "middle" : node.alignment === "right" ? "end" : "start";
  const x = node.alignment === "center" ? node.size.width / 2 : node.alignment === "right" ? node.size.width : 0;

  // The first baseline sits a line below the top edge, matching how the editor
  // lays text out from the top of its box rather than from its baseline.
  const spans = lines
    .map(
      (line, index) =>
        `<tspan x="${num(x)}" y="${num(node.fontSize + index * lineHeight)}">${escapeXml(line)}</tspan>`,
    )
    .join("");

  return (
    `<text font-family="${escapeXml(fontFamily(node.fontFamily))}" font-size="${num(node.fontSize)}" ` +
    `font-weight="${num(node.fontWeight)}" fill="${fill}" text-anchor="${anchor}" ` +
    `xml:space="preserve">${spans}</text>`
  );
}

function renderNode(node: SceneNode, scene: Scene, options: RenderSceneToSvgOptions): string {
  if (!node.visible) return "";

  const effects = resolveEffects(node, options.effects ?? []);
  const opacity = node.transform.opacity * effects.opacity;
  if (opacity <= 0) return "";

  let body: string;
  switch (node.type) {
    case "shape":
      body = renderShape(node);
      break;
    case "image":
      body = renderImage(node, options);
      break;
    case "text":
      body = renderText(node);
      break;
    case "group":
      // Children are ordinary scene nodes drawn in their own right; the group
      // contributes its transform and effects through this wrapper.
      body = node.childIds
        .map((childId) => scene.nodes.find((candidate) => candidate.id === childId))
        .filter((child): child is SceneNode => Boolean(child))
        .map((child) => renderNode(child, scene, options))
        .join("");
      break;
    default:
      return "";
  }

  const attributes = [
    `transform="${transformAttribute(node)}"`,
    opacity < 1 ? `opacity="${num(opacity)}"` : "",
    effects.filterRef ? `filter="url(#${effects.filterRef})"` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `${effects.filterMarkup}<g ${attributes}>${body}</g>`;
}

/**
 * Nodes owned by a group are drawn inside it, so drawing them again at the top
 * level would paint them twice — once with the group's transform and once
 * without.
 */
function topLevelNodes(scene: Scene): SceneNode[] {
  const grouped = new Set<string>();
  for (const node of scene.nodes) {
    if (node.type === "group") for (const childId of node.childIds) grouped.add(childId);
  }
  return scene.nodes
    .filter((node) => !grouped.has(node.id))
    .slice()
    .sort((left, right) =>
      // Ties fall back to id so the output is byte-stable: two nodes at the
      // same depth must not swap places between runs.
      left.zIndex === right.zIndex ? left.id.localeCompare(right.id) : left.zIndex - right.zIndex,
    );
}

export function renderSceneToSvg(scene: Scene, options: RenderSceneToSvgOptions = {}): string {
  if (scene.size.width <= 0 || scene.size.height <= 0) {
    throw new SceneRenderError("Scene size must be positive in both dimensions.");
  }

  const background = colour(scene.background, "Scene background");
  const body = topLevelNodes(scene)
    .map((node) => renderNode(node, scene, options))
    .join("");

  // Everything is clipped to the scene bounds. A node hanging over the edge is
  // a legitimate design choice inside the editor, but an export is a fixed
  // rectangle and content outside it is not part of the deliverable.
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${num(scene.size.width)}" height="${num(scene.size.height)}" ` +
    `viewBox="0 0 ${num(scene.size.width)} ${num(scene.size.height)}">` +
    `<title>${escapeXml(scene.name)}</title>` +
    `<defs><clipPath id="scene-bounds"><rect width="${num(scene.size.width)}" height="${num(scene.size.height)}"/></clipPath></defs>` +
    `<rect width="${num(scene.size.width)}" height="${num(scene.size.height)}" fill="${background}"/>` +
    `<g clip-path="url(#scene-bounds)">${body}</g>` +
    `</svg>`;

  return options.standalone ? `<?xml version="1.0" encoding="UTF-8"?>\n${svg}` : svg;
}
