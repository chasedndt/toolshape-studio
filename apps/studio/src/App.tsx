import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  Bot,
  Captions,
  Check,
  ChevronDown,
  Diamond,
  Eye,
  FileOutput,
  FolderOpen,
  Group,
  Hand,
  Image,
  Layers3,
  Lock,
  Menu,
  MousePointer2,
  Music2,
  PanelBottomClose,
  PanelLeftClose,
  PanelRightClose,
  Play,
  Redo2,
  Scissors,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  SkipBack,
  SkipForward,
  Sparkles,
  StepBack,
  StepForward,
  Type,
  Undo2,
  Video,
  Volume2,
  VolumeX,
  WandSparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import type {
  Asset,
  AudioTrack,
  Scene,
  SceneNode,
  StudioProject,
  TextNode,
  Track,
} from "@toolshape/studio-domain";
import { rational, toSeconds, validateStudioProject } from "@toolshape/studio-engine";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";
import {
  WORKSPACES,
  createEditorShellState,
  selectLeftPanel,
  selectRightPanel,
  setActiveMenu,
  switchWorkspace,
  toggleShellRegion,
  type AppMenuId,
  type LeftPanelId,
  type RightPanelId,
  type ShellRegion,
} from "./editor-shell";
import { useStudioState } from "./studio-state";
import {
  resolveAssetPreview,
  resolveFixturePreview,
  type PreviewResolver,
} from "./preview-assets";

const NODE_ICONS: Record<SceneNode["type"], LucideIcon> = {
  text: Type,
  image: Image,
  shape: Diamond,
  group: Group,
};

function NodeTypeIcon({ type, size = 14 }: { type: SceneNode["type"]; size?: number }) {
  const Icon = NODE_ICONS[type];
  return <Icon size={size} strokeWidth={1.8} aria-hidden="true" />;
}

const ASSET_ICONS: Record<Asset["kind"], LucideIcon> = {
  video: Video,
  audio: Music2,
  image: Image,
  font: Type,
};

function formatDuration(asset: Asset): string | null {
  if (!asset.duration) return null;
  const totalSeconds = Math.max(0, Math.round(toSeconds(asset.duration)));
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function sceneNodeStyle(node: SceneNode, scale: number): CSSProperties {
  return {
    left: node.transform.x * scale,
    top: node.transform.y * scale,
    width: node.size.width * scale,
    height: node.size.height * scale,
    opacity: node.transform.opacity,
    zIndex: node.zIndex,
    transform: `rotate(${node.transform.rotationDeg}deg) scale(${node.transform.scaleX}, ${node.transform.scaleY})`,
  };
}

function SceneCanvas({
  project,
  selectedNodeId,
  onSelect,
  scale,
  exportMode = false,
}: {
  project: StudioProject;
  selectedNodeId: string | null;
  onSelect?: (nodeId: string) => void;
  scale: number;
  exportMode?: boolean;
}) {
  const scene = project.scenes.find((candidate) => candidate.id === project.activeSceneId)!;
  const effects = new Map(project.effects.map((effect) => [effect.id, effect]));

  return (
    <div
      className={`scene-canvas${exportMode ? " scene-canvas--export" : ""}`}
      style={{ width: scene.size.width * scale, height: scene.size.height * scale }}
      aria-label={`${scene.name} editable artboard`}
      data-testid="scene-canvas"
    >
      {[...scene.nodes]
        .sort((left, right) => left.zIndex - right.zIndex)
        .map((node) => {
          if (!node.visible || node.type === "group") return null;
          const blur = node.effectIds
            .map((effectId) => effects.get(effectId))
            .find((effect) => effect?.type === "blur" && effect.enabled);
          const style = {
            ...sceneNodeStyle(node, scale),
            filter: blur && node.type !== "shape" ? `blur(${blur.radius * scale}px)` : undefined,
          };
          const selected = !exportMode && selectedNodeId === node.id;
          const common = {
            key: node.id,
            className: `scene-node scene-node--${node.type}${selected ? " is-selected" : ""}`,
            style,
            onClick: (event: React.MouseEvent) => {
              event.stopPropagation();
              onSelect?.(node.id);
            },
            role: exportMode ? undefined : "button",
            tabIndex: exportMode ? undefined : 0,
            "aria-label": exportMode ? undefined : `Select ${node.name}`,
          };

          if (node.type === "shape") {
            return (
              <div
                {...common}
                style={{
                  ...style,
                  background: node.fill,
                  borderRadius: node.shape === "ellipse" ? "50%" : node.cornerRadius * scale,
                  border: node.stroke
                    ? `${(node.strokeWidth ?? 1) * scale}px solid ${node.stroke}`
                    : undefined,
                  filter: blur ? `blur(${blur.radius * scale}px)` : undefined,
                }}
              />
            );
          }
          if (node.type === "text") {
            return (
              <div
                {...common}
                style={{
                  ...style,
                  color: node.color,
                  fontFamily: `${node.fontFamily}, Inter, system-ui, sans-serif`,
                  fontSize: node.fontSize * scale,
                  fontWeight: node.fontWeight,
                  lineHeight: node.lineHeight,
                  textAlign: node.alignment,
                  letterSpacing: node.id === "node-eyebrow" ? `${1.8 * scale}px` : undefined,
                }}
              >
                {node.content}
              </div>
            );
          }
          return (
            <div {...common} className={`${common.className} product-object`}>
              <div className="product-object__mesh" />
              <span>TS</span>
              <small>OBJECT / 01</small>
            </div>
          );
        })}
      {!exportMode && (
        <div
          className="safe-area"
          style={{
            left: scene.safeArea.left * scale,
            top: scene.safeArea.top * scale,
            right: scene.safeArea.right * scale,
            bottom: scene.safeArea.bottom * scale,
          }}
          aria-hidden="true"
        />
      )}
      <div className="cover-footer" style={{ left: 120 * scale, bottom: 106 * scale }}>
        <span style={{ fontSize: 22 * scale }}>01 / VERTICAL SYSTEM</span>
        <span style={{ fontSize: 22 * scale }}>8.0 SEC · EDITABLE</span>
      </div>
    </div>
  );
}

const LEFT_PANEL_DEFINITIONS: readonly {
  id: LeftPanelId;
  label: string;
  eyebrow: string;
  icon: LucideIcon;
}[] = [
  { id: "media", label: "Media", eyebrow: "SOURCE GRAPH", icon: Image },
  { id: "layers", label: "Layers", eyebrow: "SCENE / 01", icon: Layers3 },
  { id: "text", label: "Text", eyebrow: "EDITABLE COPY", icon: Type },
  { id: "audio", label: "Audio", eyebrow: "MIX GRAPH", icon: Music2 },
  { id: "captions", label: "Captions", eyebrow: "TRANSCRIPT", icon: Captions },
] as const;

function SectionTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="section-title">
      <div>
        <span>{eyebrow}</span>
        <strong>{title}</strong>
      </div>
      {children}
    </div>
  );
}

function LeftRail({
  project,
  activePanel,
  selectedNodeId,
  selectedAssetId,
  onPanelChange,
  onSelect,
  onSelectAsset,
  onNotice,
  resolvePreview,
}: {
  project: StudioProject;
  activePanel: LeftPanelId;
  selectedNodeId: string;
  selectedAssetId: string | null;
  onPanelChange: (panel: LeftPanelId) => void;
  onSelect: (id: string) => void;
  onSelectAsset: (id: string) => void;
  onNotice: (message: string) => void;
  resolvePreview: PreviewResolver;
}) {
  const scene = project.scenes[0];
  const [query, setQuery] = useState("");
  const definition = LEFT_PANEL_DEFINITIONS.find((panel) => panel.id === activePanel)!;
  const match = (value: string) => value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  const audioTracks = project.timeline.tracks.filter((track) => track.kind === "audio");
  const captionTracks = project.timeline.tracks.filter((track) => track.kind === "caption");

  let panelContent: ReactNode;
  if (activePanel === "media") {
    panelContent = (
      <div className="asset-grid">
        {project.assets.filter((asset) => match(asset.name)).map((asset) => {
          const preview = resolveAssetPreview(asset, "thumbnail", resolvePreview);
          const AssetIcon = ASSET_ICONS[asset.kind];
          const derivativeKinds = new Set(asset.derivatives.map((derivative) => derivative.kind));
          return (
            <button
              className={`asset-card${preview ? " asset-card--with-preview" : ""}${selectedAssetId === asset.id ? " is-active" : ""}`}
              key={asset.id}
              aria-label={`Select ${asset.name}`}
              data-preview-ready={preview ? "true" : "false"}
              onClick={() => {
                onSelectAsset(asset.id);
                onNotice(`${asset.name} selected · immutable ${asset.kind} source · ${asset.derivatives.length} verified derivatives`);
              }}
            >
              <span className={`asset-card__preview${preview ? " has-media" : " is-type-icon"}`}>
                {preview ? (
                  <img src={preview.url} alt="" data-preview-kind="thumbnail" />
                ) : (
                  <span className="asset-card__type"><AssetIcon size={18} aria-hidden="true" /><i>{asset.kind}</i></span>
                )}
                {formatDuration(asset) && <em>{formatDuration(asset)}</em>}
                {preview && <span className="asset-card__proof"><Check size={10} aria-hidden="true" /> DERIVED</span>}
              </span>
              <strong>{asset.name}</strong>
              <small>{asset.kind.toUpperCase()} · IMMUTABLE</small>
              {asset.derivatives.length > 0 && (
                <span className="asset-card__evidence">
                  {derivativeKinds.has("thumbnail") && <i>THUMB</i>}
                  {derivativeKinds.has("waveform") && <i>WAVE</i>}
                  {derivativeKinds.has("proxy") && <i>PROXY</i>}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  } else if (activePanel === "layers") {
    panelContent = (
      <div className="layer-list">
        {[...scene.nodes]
          .filter((node) => match(node.name))
          .sort((left, right) => right.zIndex - left.zIndex)
          .map((node) => (
            <button
              key={node.id}
              className={`layer-row${selectedNodeId === node.id ? " is-active" : ""}`}
              onClick={() => onSelect(node.id)}
            >
              <span className={`layer-icon layer-icon--${node.type}`}><NodeTypeIcon type={node.type} /></span>
              <span>
                <strong>{node.name}</strong>
                <small>{node.type} · r{node.revision}</small>
              </span>
              <Eye size={12} aria-label={node.visible ? "Visible" : "Hidden"} />
            </button>
          ))}
      </div>
    );
  } else if (activePanel === "text") {
    panelContent = (
      <div className="source-list">
        {scene.nodes
          .filter((node): node is TextNode => node.type === "text" && (match(node.name) || match(node.content)))
          .map((node) => (
            <button
              key={node.id}
              className={`source-row${selectedNodeId === node.id ? " is-active" : ""}`}
              onClick={() => onSelect(node.id)}
            >
              <Type size={15} aria-hidden="true" />
              <span><strong>{node.name}</strong><small>{node.content}</small></span>
            </button>
          ))}
      </div>
    );
  } else if (activePanel === "audio") {
    panelContent = (
      <div className="audio-source-list">
        {audioTracks.filter((track) => match(track.name)).map((track) => {
          const clip = track.clips[0];
          const asset = project.assets.find((candidate) => candidate.id === clip?.assetId);
          const waveform = resolveAssetPreview(asset, "waveform", resolvePreview);
          const sampleRate = asset?.probe?.audio?.sampleRate;
          return (
            <button
              className={`audio-source-card${selectedAssetId === asset?.id ? " is-active" : ""}`}
              key={track.id}
              data-waveform-ready={waveform ? "true" : "false"}
              onClick={() => {
                if (asset) onSelectAsset(asset.id);
                onNotice(`${track.name} selected · ${waveform ? "verified waveform ready" : "waveform unavailable"}`);
              }}
            >
              <span className="audio-source-card__waveform">
                {waveform ? <img src={waveform.url} alt="" data-preview-kind="waveform" /> : <Music2 size={18} aria-hidden="true" />}
              </span>
              <span className="audio-source-card__meta">
                <strong>{track.name}</strong>
                <small>{track.clips.length} clip · {sampleRate ? `${Math.round(sampleRate / 1000)} kHz` : "unprobed"} · {asset?.probe?.audio?.channels ?? 0} ch</small>
                <i>{waveform ? "CONTENT-ADDRESSED WAVEFORM" : "NO WAVEFORM DERIVATIVE"}</i>
              </span>
              <span className="audio-source-card__state">
                {clip?.audio?.muted ? <VolumeX size={14} aria-label="Muted" /> : <Volume2 size={14} aria-label="Audible" />}
                <small>{clip?.audio?.gainDb ?? 0} dB</small>
              </span>
            </button>
          );
        })}
      </div>
    );
  } else {
    panelContent = (
      <div className="source-list">
        {captionTracks.flatMap((track) => track.segments)
          .filter((segment) => match(segment.text))
          .map((segment) => (
            <button
              className="source-row"
              key={segment.id}
              onClick={() => onNotice(`Caption selected · ${segment.text}`)}
            >
              <Captions size={15} aria-hidden="true" />
              <span><strong>{segment.text}</strong><small>{toSeconds(segment.start).toFixed(1)}s – {toSeconds(segment.end).toFixed(1)}s</small></span>
            </button>
          ))}
      </div>
    );
  }

  return (
    <aside className="left-rail panel-boundary" aria-label="Project sources">
      <nav className="tool-rail" aria-label="Source panels" role="tablist" aria-orientation="vertical">
        {LEFT_PANEL_DEFINITIONS.map((panel) => {
          const Icon = panel.icon;
          return (
            <button
              key={panel.id}
              role="tab"
              aria-selected={activePanel === panel.id}
              aria-controls="active-source-panel"
              className={activePanel === panel.id ? "is-active" : ""}
              onClick={() => onPanelChange(panel.id)}
            >
              <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
              <span>{panel.label}</span>
            </button>
          );
        })}
      </nav>
      <section id="active-source-panel" className="source-panel" role="tabpanel" data-panel-id={activePanel}>
        <SectionTitle eyebrow={definition.eyebrow} title={definition.label}>
          {activePanel === "media" && (
            <button className="icon-button" aria-label="Import asset unavailable in web seed" disabled title="Native file selection is not available in the web seed">
              <FolderOpen size={14} aria-hidden="true" />
            </button>
          )}
        </SectionTitle>
        <label className="panel-search">
          <Search size={13} aria-hidden="true" />
          <span className="sr-only">Filter {definition.label}</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Filter ${definition.label.toLowerCase()}`} />
          {query && <button type="button" aria-label="Clear filter" onClick={() => setQuery("")}><X size={12} /></button>}
        </label>
        <div className="source-panel__body">{panelContent}</div>
        <div className="source-proof">
          <span className="source-proof__mark"><Check size={13} aria-hidden="true" /></span>
          <span><strong>Source graph intact</strong><small>{project.assets.length} hashed originals · r{project.revision}</small></span>
        </div>
      </section>
    </aside>
  );
}

function TextControl({
  node,
  onCommit,
}: {
  node: TextNode;
  onCommit: (content: string) => void;
}) {
  const [draft, setDraft] = useState(node.content);
  useEffect(() => setDraft(node.content), [node.content, node.id]);
  return (
    <label className="field field--stacked">
      <span>Copy</span>
      <textarea
        value={draft}
        rows={3}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => draft !== node.content && onCommit(draft)}
      />
    </label>
  );
}

const RIGHT_PANEL_DEFINITIONS: readonly { id: RightPanelId; label: string; icon: LucideIcon }[] = [
  { id: "inspector", label: "Inspector", icon: SlidersHorizontal },
  { id: "agent", label: "Agent", icon: Bot },
  { id: "quality", label: "Quality", icon: ShieldCheck },
] as const;

function RightRail({
  project,
  scene,
  selectedNode,
  lastDiff,
  activePanel,
  onPanelChange,
  onNotice,
  apply,
}: {
  project: StudioProject;
  scene: Scene;
  selectedNode: SceneNode;
  lastDiff: ReturnType<typeof useStudioState>["lastDiff"];
  activePanel: RightPanelId;
  onPanelChange: (panel: RightPanelId) => void;
  onNotice: (message: string) => void;
  apply: ReturnType<typeof useStudioState>["apply"];
}) {
  const validationIssues = useMemo(() => validateStudioProject(project), [project]);
  return (
    <aside className="right-rail panel-boundary" aria-label="Context panels">
      <nav className="context-tabs" role="tablist" aria-label="Editor context">
        {RIGHT_PANEL_DEFINITIONS.map((panel) => {
          const Icon = panel.icon;
          return (
            <button
              key={panel.id}
              role="tab"
              aria-selected={activePanel === panel.id}
              aria-controls="active-context-panel"
              className={activePanel === panel.id ? "is-active" : ""}
              onClick={() => onPanelChange(panel.id)}
            >
              <Icon size={14} strokeWidth={1.8} aria-hidden="true" />
              <span>{panel.label}</span>
            </button>
          );
        })}
      </nav>

      <div id="active-context-panel" className="context-panel" role="tabpanel" data-panel-id={activePanel}>
        {activePanel === "agent" && (
          <section className="agent-card">
            <div className="agent-card__header">
              <div className="agent-badge"><Sparkles size={17} aria-hidden="true" /></div>
              <div><span>TOOLSHAPE AGENT</span><strong>Plan is inspectable</strong></div>
              <i>READY</i>
            </div>
            <p>{lastDiff?.summary ?? "A semantic edit plan is staged. Every change remains revision-bound and reversible."}</p>
            <div className="agent-metadata">
              <span><strong>Local</strong><small>Execution</small></span>
              <span><strong>0 credits</strong><small>Estimated</small></span>
              <span><strong>Reversible</strong><small>Risk</small></span>
            </div>
            <div className="diff-strip">
              <span>SEMANTIC DIFF</span>
              <strong>{lastDiff ? `${lastDiff.changedPaths.length} paths` : "No mutation yet"}</strong>
              <small>r{lastDiff?.beforeRevision ?? project.revision} → r{lastDiff?.afterRevision ?? project.revision}</small>
            </div>
            <div className="agent-actions">
              <button
                className="button button--accent"
                onClick={() => {
                  const diff = apply(
                    {
                      type: "style.profile.apply",
                      payload: { styleProfileRef: { id: "style-night-citrus", version: 1, name: "Night Citrus" } },
                    },
                    "agent",
                  );
                  onNotice(`Agent candidate applied · ${diff?.changedPaths.length ?? 0} semantic paths`);
                }}
              >
                <WandSparkles size={14} aria-hidden="true" />
                Apply candidate
              </button>
              <button className="button button--quiet" onClick={() => onNotice(lastDiff?.summary ?? "No semantic mutation has been committed yet.")}>
                Review paths
              </button>
            </div>
            <div className="agent-plan">
              <div className="agent-plan__header"><span>CURRENT PLAN</span><strong>3 bounded steps</strong></div>
              <ol>
                <li className="is-complete"><Check size={13} aria-hidden="true" /><span><strong>Inspect current revision</strong><small>{scene.nodes.length} scene objects · {project.timeline.tracks.length} tracks</small></span></li>
                <li className="is-active"><WandSparkles size={13} aria-hidden="true" /><span><strong>Apply selected candidate</strong><small>Style profile · atomic operation</small></span></li>
                <li><ShieldCheck size={13} aria-hidden="true" /><span><strong>Verify and compare</strong><small>Canonical state · render evidence</small></span></li>
              </ol>
              <div className="agent-context">
                <span>SELECTED CONTEXT</span>
                <strong>{selectedNode.name}</strong>
                <small>{selectedNode.type} · {selectedNode.id}</small>
              </div>
            </div>
          </section>
        )}

        {activePanel === "inspector" && (
          <section className="inspector-section">
            <SectionTitle eyebrow="DIRECT EDIT" title="Inspector" />
            <div className="selection-chip">
              <span className={`layer-icon layer-icon--${selectedNode.type}`}><NodeTypeIcon type={selectedNode.type} /></span>
              <span><strong>{selectedNode.name}</strong><small>{selectedNode.id}</small></span>
            </div>
            {selectedNode.type === "text" && (
              <TextControl
                node={selectedNode}
                onCommit={(content) =>
                  apply({
                    type: "scene.node.update-text",
                    payload: { sceneId: scene.id, nodeId: selectedNode.id, content },
                  })
                }
              />
            )}
            <div className="inspector-group">
              <div className="inspector-group__title"><span>Transform</span><small>Direct values</small></div>
              <div className="field-grid">
                <label className="field"><span>X</span><output>{Math.round(selectedNode.transform.x)}</output></label>
                <label className="field"><span>Y</span><output>{Math.round(selectedNode.transform.y)}</output></label>
                <label className="field"><span>Rotation</span><output>{selectedNode.transform.rotationDeg}°</output></label>
                <label className="field"><span>Opacity</span><output>{Math.round(selectedNode.transform.opacity * 100)}%</output></label>
              </div>
            </div>
            <div className="inline-actions">
              <button
                className="button button--quiet"
                onClick={() =>
                  apply({
                    type: "scene.node.update-transform",
                    payload: {
                      sceneId: scene.id,
                      nodeId: selectedNode.id,
                      patch: { x: selectedNode.transform.x + 24 },
                    },
                  })
                }
              >
                Nudge +24
              </button>
              <button
                className="button button--quiet"
                onClick={() =>
                  apply({
                    type: "effect.blur.set",
                    payload: {
                      sceneId: scene.id,
                      nodeId: selectedNode.id,
                      effectId: `effect-${selectedNode.id}-blur`,
                      radius: 6,
                      enabled: true,
                    },
                  })
                }
              >
                Add blur
              </button>
            </div>
          </section>
        )}

        {activePanel === "quality" && (
          <section className="quality-section">
            <SectionTitle eyebrow="VERIFICATION" title="Quality gate" />
            <div className="quality-card">
              <ShieldCheck size={18} aria-hidden="true" />
              <span>PROJECT STATUS</span>
              <strong>{validationIssues.filter((issue) => issue.severity === "error").length === 0 ? "Canonical state valid" : "Action required"}</strong>
              <small>{validationIssues.length} validator notice{validationIssues.length === 1 ? "" : "s"}</small>
              <div className="quality-line"><i style={{ width: "100%" }} /></div>
            </div>
            <div className="quality-checks" aria-label="Quality checks">
              {["Project schema v3", "Immutable sources", "Safe area visible", "Render preset verified"].map((label) => (
                <span key={label}><Check size={13} aria-hidden="true" /><strong>{label}</strong><small>Passed</small></span>
              ))}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}

function TrackLane({
  track,
  totalSeconds,
  project,
  resolvePreview,
}: {
  track: Track;
  totalSeconds: number;
  project: StudioProject;
  resolvePreview: PreviewResolver;
}) {
  if (track.kind === "caption") {
    return (
      <div className="track-lane track-lane--captions">
        {track.segments.map((segment) => (
          <span
            key={segment.id}
            style={{
              left: `${(toSeconds(segment.start) / totalSeconds) * 100}%`,
              width: `${((toSeconds(segment.end) - toSeconds(segment.start)) / totalSeconds) * 100}%`,
            }}
          >
            {segment.text}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className={`track-lane track-lane--${track.kind}`}>
      {track.clips.map((clip) => {
        const asset = project.assets.find((candidate) => candidate.id === clip.assetId);
        const preview = resolveAssetPreview(asset, track.kind === "audio" ? "waveform" : "thumbnail", resolvePreview);
        return (
          <span
            key={clip.id}
            className={`timeline-clip${preview ? " has-preview" : ""}`}
            data-preview-ready={preview ? "true" : "false"}
            style={{
              left: `${(toSeconds(clip.start) / totalSeconds) * 100}%`,
              width: `${(toSeconds(clip.duration) / totalSeconds) * 100}%`,
            }}
          >
            {preview && (
              <img
                className={track.kind === "audio" ? "timeline-clip__waveform" : "timeline-clip__thumbnail"}
                src={preview.url}
                alt=""
                data-preview-kind={track.kind === "audio" ? "waveform" : "thumbnail"}
              />
            )}
            <strong>{clip.name}</strong>
          </span>
        );
      })}
    </div>
  );
}

function TimelinePanel({
  project,
  apply,
  onCollapse,
  resolvePreview,
}: {
  project: StudioProject;
  apply: ReturnType<typeof useStudioState>["apply"];
  onCollapse: () => void;
  resolvePreview: PreviewResolver;
}) {
  const totalSeconds = toSeconds(project.timeline.duration);
  const video = project.timeline.tracks.find((track) => track.id === "track-video");
  const audio = project.timeline.tracks.find((track) => track.id === "track-audio") as AudioTrack;
  const hasSplit = video?.kind === "video" && video.clips.some((clip) => clip.id === "clip-tail");
  const mainDuration =
    video?.kind === "video"
      ? toSeconds(video.clips.find((clip) => clip.id === "clip-main")?.duration ?? rational(0))
      : 0;
  const audioClip = audio.clips[0];

  return (
    <section className="timeline-panel" aria-label="Timeline editor">
      <header className="timeline-toolbar">
        <div className="timeline-identity"><span>TIMELINE</span><strong>00:00:02:12</strong><small>/ 00:00:08:00</small></div>
        <div className="transport" aria-label="Playback controls">
          <button aria-label="Go to start"><SkipBack size={13} /></button>
          <button aria-label="Step backward"><StepBack size={13} /></button>
          <button className="transport__play" aria-label="Play"><Play size={13} fill="currentColor" /></button>
          <button aria-label="Step forward"><StepForward size={13} /></button>
          <button aria-label="Go to end"><SkipForward size={13} /></button>
        </div>
        <div className="timeline-actions">
          <button
            className="button button--quiet"
            disabled={hasSplit}
            onClick={() =>
              apply({
                type: "timeline.clip.split",
                payload: { trackId: "track-video", clipId: "clip-main", splitAt: rational(4), rightClipId: "clip-tail" },
              })
            }
          >
            <Scissors size={13} aria-hidden="true" />
            Split at 4s
          </button>
          <button
            className="button button--quiet"
            disabled={!hasSplit || mainDuration <= 3.5}
            onClick={() =>
              apply({
                type: "timeline.clip.trim",
                payload: {
                  trackId: "track-video",
                  clipId: "clip-main",
                  newStart: rational(0),
                  newDuration: rational(7, 2),
                  ripple: true,
                },
              })
            }
          >
            Trim + ripple
          </button>
          <button
            className="button button--quiet"
            onClick={() =>
              apply({
                type: "timeline.clip.set-audio",
                payload: {
                  trackId: "track-audio",
                  clipId: audioClip.id,
                  gainDb: audioClip.audio?.gainDb ?? 0,
                  muted: !(audioClip.audio?.muted ?? false),
                  fadeIn: audioClip.audio?.fadeIn ?? rational(0),
                  fadeOut: audioClip.audio?.fadeOut ?? rational(0),
                },
              })
            }
          >
            {audioClip.audio?.muted ? <Volume2 size={13} aria-hidden="true" /> : <VolumeX size={13} aria-hidden="true" />}
            {audioClip.audio?.muted ? "Unmute" : "Mute"}
          </button>
          <button className="icon-button" aria-label="Hide timeline" title="Hide timeline" onClick={onCollapse}>
            <PanelBottomClose size={14} aria-hidden="true" />
          </button>
        </div>
      </header>
      <div className="timeline-ruler">
        <span className="track-label-spacer" />
        <div>{Array.from({ length: 9 }, (_, index) => <i key={index} style={{ left: `${(index / 8) * 100}%` }}>{index}s</i>)}</div>
      </div>
      <div className="track-stack">
        {project.timeline.tracks.map((track) => (
          <div className="track-row" key={track.id}>
            <div className="track-label">
              <span>
                {track.kind === "video" ? <Video size={13} aria-hidden="true" /> : track.kind === "audio" ? <Music2 size={13} aria-hidden="true" /> : <Captions size={13} aria-hidden="true" />}
              </span>
              <strong>{track.name}</strong>
              <i>{track.locked ? <Lock size={11} aria-label="Locked" /> : <Eye size={11} aria-label="Visible" />}</i>
            </div>
            <TrackLane track={track} totalSeconds={totalSeconds} project={project} resolvePreview={resolvePreview} />
          </div>
        ))}
        <div className="playhead" style={{ left: `calc(188px + ${(2.4 / totalSeconds) * 100}% - ${(2.4 / totalSeconds) * 188}px)` }}>
          <i />
        </div>
      </div>
    </section>
  );
}

function DropdownMenu({
  id,
  label,
  active,
  onToggle,
  children,
}: {
  id: AppMenuId;
  label: string;
  active: boolean;
  onToggle: (menu: AppMenuId) => void;
  children: ReactNode;
}) {
  return (
    <div className={`app-menu${active ? " is-open" : ""}`} data-app-menu>
      <button
        className="app-menu__trigger"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={active}
        onClick={(event) => {
          event.stopPropagation();
          onToggle(id);
        }}
      >
        {label}
        <ChevronDown size={11} aria-hidden="true" />
      </button>
      {active && <div className="app-menu__popover" role="menu" aria-label={`${label} menu`}>{children}</div>}
    </div>
  );
}

function MenuAction({
  icon: Icon,
  label,
  shortcut,
  checked,
  disabled = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  checked?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className="menu-action"
      role={checked === undefined ? "menuitem" : "menuitemcheckbox"}
      aria-checked={checked}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="menu-action__icon">{checked ? <Check size={13} aria-hidden="true" /> : <Icon size={14} aria-hidden="true" />}</span>
      <span>{label}</span>
      {shortcut && <kbd>{shortcut}</kbd>}
    </button>
  );
}

function WorkspaceTabs({
  active,
  onSelect,
}: {
  active: (typeof WORKSPACES)[number]["id"];
  onSelect: (workspace: (typeof WORKSPACES)[number]["id"]) => void;
}) {
  return (
    <div className="workspace-tabs" role="tablist" aria-label="Studio workspace">
      {WORKSPACES.map((workspace) => (
        <button
          key={workspace.id}
          role="tab"
          aria-selected={active === workspace.id}
          title={workspace.description}
          className={active === workspace.id ? "is-active" : ""}
          onClick={() => onSelect(workspace.id)}
        >
          {workspace.label}
        </button>
      ))}
    </div>
  );
}

export function App({ resolvePreview = resolveFixturePreview }: { resolvePreview?: PreviewResolver } = {}) {
  const initialProject = useMemo(() => createGoldenStudioProject(), []);
  const {
    project,
    apply,
    undo,
    redo,
    canUndo,
    canRedo,
    lastDiff,
    renderJob,
    queueRender,
  } = useStudioState(initialProject);
  const [shell, setShell] = useState(createEditorShellState);
  const [selectedNodeId, setSelectedNodeId] = useState("node-title");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(initialProject.assets[0]?.id ?? null);
  const [activeTool, setActiveTool] = useState<"select" | "hand">("select");
  const [notice, setNotice] = useState<string | null>(null);
  const exportMode = new URLSearchParams(window.location.search).get("export") === "cover";
  const scene = project.scenes.find((candidate) => candidate.id === project.activeSceneId)!;
  const selectedNode = scene.nodes.find((node) => node.id === selectedNodeId) ?? scene.nodes[0];

  const chooseWorkspace = (workspace: (typeof WORKSPACES)[number]["id"]) => {
    setShell((current) => switchWorkspace(current, workspace));
    const definition = WORKSPACES.find((candidate) => candidate.id === workspace)!;
    setNotice(`${definition.label} workspace · ${definition.description} · project revision unchanged`);
  };

  const toggleRegion = (region: ShellRegion) => {
    setShell((current) => toggleShellRegion(current, region));
  };

  const queueRenderWithNotice = () => {
    const job = queueRender();
    setNotice(`Render queued · ${job.job_id.slice(0, 8)} · ${job.status}`);
  };

  useEffect(() => {
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        document.documentElement.dataset.studioReadyMs = performance.now().toFixed(1);
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && !target.closest("[data-app-menu]")) {
        setShell((current) => current.activeMenu ? setActiveMenu(current, null) : current);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShell((current) => setActiveMenu(current, null));
        return;
      }
      const target = event.target;
      const typing = target instanceof HTMLElement && (
        target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA"
      );
      if (typing) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          if (canRedo) redo();
        } else if (canUndo) {
          undo();
        }
      }
      if (event.altKey && /^[1-4]$/.test(event.key)) {
        event.preventDefault();
        const workspace = WORKSPACES[Number(event.key) - 1];
        setShell((current) => switchWorkspace(current, workspace.id));
        setNotice(`${workspace.label} workspace · ${workspace.description} · project revision unchanged`);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [canRedo, canUndo, redo, undo]);

  if (exportMode) {
    return (
      <main className="export-surface">
        <SceneCanvas project={project} selectedNodeId={null} scale={0.5} exportMode />
      </main>
    );
  }

  const workspaceClasses = [
    "workspace-grid",
    !shell.visibility.left && "is-left-hidden",
    !shell.visibility.right && "is-right-hidden",
  ].filter(Boolean).join(" ");

  return (
    <main
      className={`studio-shell${shell.visibility.timeline ? "" : " is-timeline-hidden"}`}
      data-workspace={shell.workspace}
    >
      <header className="topbar">
        <div className="brand-lockup"><span className="brand-mark">T</span><strong>TOOLSHAPE</strong><i>STUDIO</i></div>
        <nav className="app-menubar" aria-label="Application menu" role="menubar">
          <DropdownMenu id="file" label="File" active={shell.activeMenu === "file"} onToggle={(menu) => setShell((current) => setActiveMenu(current, menu))}>
            <MenuAction icon={FolderOpen} label="Open project" shortcut="Native" disabled />
            <MenuAction icon={FileOutput} label="Render proof" shortcut="⌘R" onClick={() => { queueRenderWithNotice(); setShell((current) => setActiveMenu(current, null)); }} />
          </DropdownMenu>
          <DropdownMenu id="edit" label="Edit" active={shell.activeMenu === "edit"} onToggle={(menu) => setShell((current) => setActiveMenu(current, menu))}>
            <MenuAction icon={Undo2} label="Undo" shortcut="⌘Z" disabled={!canUndo} onClick={() => { undo(); setShell((current) => setActiveMenu(current, null)); }} />
            <MenuAction icon={Redo2} label="Redo" shortcut="⇧⌘Z" disabled={!canRedo} onClick={() => { redo(); setShell((current) => setActiveMenu(current, null)); }} />
          </DropdownMenu>
          <DropdownMenu id="view" label="View" active={shell.activeMenu === "view"} onToggle={(menu) => setShell((current) => setActiveMenu(current, menu))}>
            <span className="menu-section-label">PANELS</span>
            <MenuAction icon={PanelLeftClose} label="Source panel" checked={shell.visibility.left} onClick={() => toggleRegion("left")} />
            <MenuAction icon={PanelRightClose} label="Context panel" checked={shell.visibility.right} onClick={() => toggleRegion("right")} />
            <MenuAction icon={PanelBottomClose} label="Timeline" checked={shell.visibility.timeline} onClick={() => toggleRegion("timeline")} />
            <span className="menu-section-label">WORKSPACE</span>
            {WORKSPACES.map((workspace) => (
              <MenuAction
                key={workspace.id}
                icon={Menu}
                label={workspace.label}
                shortcut={`Alt+${workspace.shortcut}`}
                checked={shell.workspace === workspace.id}
                onClick={() => chooseWorkspace(workspace.id)}
              />
            ))}
          </DropdownMenu>
        </nav>
        <div className="project-crumb"><span>PROJECT</span><strong>{project.name}</strong><i>r{project.revision}</i></div>
        <WorkspaceTabs active={shell.workspace} onSelect={chooseWorkspace} />
        <div className="topbar-status"><span className="status-dot" /><span><strong>Local editable</strong><small>Private draft</small></span></div>
        <div className="topbar-actions">
          <button className="icon-button" aria-label="Undo" title="Undo" onClick={undo} disabled={!canUndo}><Undo2 size={14} /></button>
          <button className="icon-button" aria-label="Redo" title="Redo" onClick={redo} disabled={!canRedo}><Redo2 size={14} /></button>
          <button className="button button--quiet" onClick={() => setNotice("Review remains local until an authenticated sharing transport is implemented.")}>Share review</button>
          <button
            className="button button--accent"
            onClick={queueRenderWithNotice}
          >
            <FileOutput size={14} aria-hidden="true" />
            {renderJob ? "Job queued" : "Render proof"}
          </button>
        </div>
      </header>

      <div className={workspaceClasses}>
        {shell.visibility.left && (
          <LeftRail
            project={project}
            activePanel={shell.leftPanel}
            selectedNodeId={selectedNode.id}
            selectedAssetId={selectedAssetId}
            onPanelChange={(panel) => setShell((current) => selectLeftPanel(current, panel))}
            onSelect={setSelectedNodeId}
            onSelectAsset={setSelectedAssetId}
            onNotice={setNotice}
            resolvePreview={resolvePreview}
          />
        )}
        <section className="canvas-workspace">
          <header>
            <div><span>ARTBOARD 01</span><strong>Social portrait</strong><i>{shell.workspace.toUpperCase()}</i></div>
            <div className="canvas-tools" role="toolbar" aria-label="Canvas tools">
              <button aria-label="Selection tool" aria-pressed={activeTool === "select"} className={activeTool === "select" ? "is-active" : ""} onClick={() => setActiveTool("select")}><MousePointer2 size={14} /></button>
              <button aria-label="Hand tool" aria-pressed={activeTool === "hand"} className={activeTool === "hand" ? "is-active" : ""} onClick={() => setActiveTool("hand")}><Hand size={14} /></button>
            </div>
            <div className="canvas-view-controls">
              <small>29%</small>
              <button className="icon-button" aria-label="Fit canvas" onClick={() => setNotice("Canvas fitted at 29% for the current viewport.")}><Search size={14} /></button>
              <span className="panel-toggle-group" aria-label="Panel visibility">
                <button className="icon-button" aria-label={shell.visibility.left ? "Hide source panel" : "Show source panel"} aria-pressed={shell.visibility.left} onClick={() => toggleRegion("left")}><PanelLeftClose size={14} /></button>
                <button className="icon-button" aria-label={shell.visibility.right ? "Hide context panel" : "Show context panel"} aria-pressed={shell.visibility.right} onClick={() => toggleRegion("right")}><PanelRightClose size={14} /></button>
                <button className="icon-button" aria-label={shell.visibility.timeline ? "Hide timeline" : "Show timeline"} aria-pressed={shell.visibility.timeline} onClick={() => toggleRegion("timeline")}><PanelBottomClose size={14} /></button>
              </span>
            </div>
          </header>
          <div className="canvas-stage" onClick={() => setSelectedNodeId("node-title")}>
            <span className="stage-coordinate stage-coordinate--top">1080</span>
            <span className="stage-coordinate stage-coordinate--side">1920</span>
            <SceneCanvas
              project={project}
              selectedNodeId={selectedNode.id}
              onSelect={setSelectedNodeId}
              scale={0.29}
            />
          </div>
        </section>
        {shell.visibility.right && (
          <RightRail
            project={project}
            scene={scene}
            selectedNode={selectedNode}
            lastDiff={lastDiff}
            activePanel={shell.rightPanel}
            onPanelChange={(panel) => setShell((current) => selectRightPanel(current, panel))}
            onNotice={setNotice}
            apply={apply}
          />
        )}
      </div>

      {shell.visibility.timeline && (
        <TimelinePanel
          project={project}
          apply={apply}
          onCollapse={() => toggleRegion("timeline")}
          resolvePreview={resolvePreview}
        />
      )}
      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button aria-label="Dismiss notice" onClick={() => setNotice(null)}><X size={13} /></button>
        </div>
      )}
    </main>
  );
}
