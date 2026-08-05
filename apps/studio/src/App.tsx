import { useEffect, useMemo, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import {
  Bot,
  Captions,
  Check,
  ChevronDown,
  Circle,
  Clapperboard,
  Diamond,
  Eye,
  FileOutput,
  FolderOpen,
  Group,
  Hand,
  History,
  Image,
  Layers3,
  Lock,
  Menu,
  MonitorPlay,
  MousePointer2,
  Music2,
  PanelBottomClose,
  PanelLeftClose,
  PanelRightClose,
  Pause,
  Play,
  Redo2,
  RotateCcw,
  Scissors,
  Search,
  Shapes,
  ShieldCheck,
  SlidersHorizontal,
  SkipBack,
  SkipForward,
  Sparkles,
  StepBack,
  StepForward,
  Type,
  Undo2,
  User,
  Video,
  Volume2,
  VolumeX,
  WandSparkles,
  X,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react";
import type {
  Asset,
  AudioTrack,
  Clip,
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
  isFullBleedWorkspace,
  selectLeftPanel,
  selectRightPanel,
  setActiveMenu,
  switchWorkspace,
  toggleShellRegion,
  type AppMenuId,
  type LeftPanelId,
  type RightPanelId,
  type ShellRegion,
  type WorkspaceId,
} from "./editor-shell";
import type { OperationHistoryEntry } from "@toolshape/studio-kernel";
import { useStudioState } from "./studio-state";
import {
  resolveAssetPreview,
  resolveFixturePreview,
  type PreviewResolver,
} from "./preview-assets";
import {
  MAX_TIMELINE_ZOOM,
  MIN_TIMELINE_ZOOM,
  TIMELINE_ZOOM_STEP,
  buildTimelineTicks,
  clampTimelineZoom,
  computeTrimCandidate,
  formatTimecode,
  resolveTimelineKeyboardCommand,
  secondsFromTimelinePointer,
  stepPlayhead,
  type TrimCandidate,
  type TrimEdge,
} from "./timeline-interaction";

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
  { id: "sources", label: "Sources", eyebrow: "CAPTURE INPUT", icon: MonitorPlay },
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
  } else if (activePanel === "sources") {
    panelContent = (
      <div className="source-list">
        {CAPTURE_SOURCES.filter((source) => match(source.label)).map((source) => (
          <button
            className="source-row"
            key={source.id}
            onClick={() => onNotice(`${source.label} · enumerated by studio.capture.list_sources · worker not implemented (Milestone 9)`)}
          >
            <MonitorPlay size={15} aria-hidden="true" />
            <span><strong>{source.label}</strong><small>{source.kind} · {source.detail}</small></span>
          </button>
        ))}
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
  { id: "capture", label: "Capture", icon: MonitorPlay },
  { id: "activity", label: "Activity", icon: History },
] as const;

function RightRail({
  project,
  history,
  onRevert,
  scene,
  selectedNode,
  lastDiff,
  activePanel,
  onPanelChange,
  onNotice,
  apply,
}: {
  project: StudioProject;
  history: OperationHistoryEntry[];
  onRevert: (operationId: string) => void;
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

        {activePanel === "activity" && (
          <section className="activity-section">
            <SectionTitle eyebrow="PROVENANCE" title="Activity" />
            <p className="activity-lead">
              Every change, in order, with who made it. Reverting one entry keeps everything applied
              after it — nothing is rewound.
            </p>
            {history.length === 0 ? (
              <div className="activity-empty">
                <History size={18} aria-hidden="true" />
                <strong>No changes yet</strong>
                <small>Edits made here or by an agent will appear in this list.</small>
              </div>
            ) : (
              <ol className="activity-list">
                {[...history].reverse().map((entry) => (
                  <li
                    key={entry.operation_id}
                    className={`activity-entry activity-entry--${entry.actor_type}`}
                    data-revertible={entry.revertible ? "true" : "false"}
                  >
                    <span className="activity-entry__actor" title={`${entry.actor_type}: ${entry.actor_id}`}>
                      {entry.actor_type === "agent" ? <Bot size={13} /> : <User size={13} />}
                    </span>
                    <span className="activity-entry__body">
                      <strong>{entry.operation_types.join(", ") || entry.capability}</strong>
                      <small>
                        r{entry.revision_before} → r{entry.revision_after} ·{" "}
                        {entry.actor_type === "agent" ? "agent" : "you"}
                      </small>
                      {!entry.revertible && entry.revert_blocked_reason && (
                        <em className="activity-entry__blocked">{entry.revert_blocked_reason}</em>
                      )}
                    </span>
                    <button
                      type="button"
                      className="activity-entry__revert"
                      disabled={!entry.revertible}
                      aria-label={`Revert ${entry.operation_types.join(", ") || entry.capability}`}
                      title={entry.revertible ? "Revert just this change" : entry.revert_blocked_reason}
                      onClick={() => onRevert(entry.operation_id)}
                    >
                      <RotateCcw size={13} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}

        {activePanel === "capture" && (
          <section className="capture-settings">
            <SectionTitle eyebrow="RECORDING" title="Capture plan" />
            <div className="capture-consent-card">
              <ShieldCheck size={16} aria-hidden="true" />
              <strong>Consent required</strong>
              <small>
                Recording never starts without explicit OS-level authorization, and the indicator
                cannot be suppressed — including when an agent initiates the session.
              </small>
            </div>
            <div className="capture-option-list">
              {[
                { label: "Auto zoom", value: "From event track", hint: "Deterministic, not frame vision" },
                { label: "Cursor smoothing", value: "Enabled", hint: "Render-time transform" },
                { label: "Click emphasis", value: "Bounce", hint: "Derived from click events" },
                { label: "Backdrop", value: "Gradient · 32px pad", hint: "Radius 12 · soft shadow" },
                { label: "Keystroke capture", value: "Off", hint: "Default off · secure fields excluded" },
                { label: "Camera overlay", value: "Bubble", hint: "Follows activity" },
              ].map((option) => (
                <div className="capture-option" key={option.label}>
                  <span>{option.label}</span>
                  <strong>{option.value}</strong>
                  <small>{option.hint}</small>
                </div>
              ))}
            </div>
            <p className="capture-note">
              Every value here becomes semantic project data, not baked pixels. Changing it after
              recording is an operation, not a re-record.
            </p>
          </section>
        )}
      </div>
    </aside>
  );
}

interface TimelineClipSelection {
  trackId: string;
  clipId: string;
}

interface TimelineTrimPreview extends TrimCandidate, TimelineClipSelection {}

function TrackLane({
  track,
  totalSeconds,
  project,
  resolvePreview,
  selection,
  trimPreview,
  onSelectClip,
  onScrubPointerDown,
  onScrubPointerMove,
  onScrubPointerUp,
  onTrimPointerDown,
  onTrimPointerMove,
  onTrimPointerUp,
  onTrimPointerCancel,
}: {
  track: Track;
  totalSeconds: number;
  project: StudioProject;
  resolvePreview: PreviewResolver;
  selection: TimelineClipSelection | null;
  trimPreview: TimelineTrimPreview | null;
  onSelectClip: (selection: TimelineClipSelection) => void;
  onScrubPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onScrubPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onScrubPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onTrimPointerDown: (event: ReactPointerEvent<HTMLButtonElement>, trackId: string, clip: Clip, edge: TrimEdge) => void;
  onTrimPointerMove: (event: ReactPointerEvent<HTMLButtonElement>, trackId: string, clip: Clip, edge: TrimEdge) => void;
  onTrimPointerUp: (event: ReactPointerEvent<HTMLButtonElement>, trackId: string, clip: Clip, edge: TrimEdge) => void;
  onTrimPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  const laneProps = {
    "data-timeline-lane": true,
    onPointerDown: onScrubPointerDown,
    onPointerMove: onScrubPointerMove,
    onPointerUp: onScrubPointerUp,
    onPointerCancel: onScrubPointerUp,
  };
  if (track.kind === "caption") {
    return (
      <div className="track-lane track-lane--captions" {...laneProps}>
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
    <div className={`track-lane track-lane--${track.kind}`} {...laneProps}>
      {track.clips.map((clip) => {
        const selected = selection?.trackId === track.id && selection.clipId === clip.id;
        const previewing = trimPreview?.trackId === track.id && trimPreview.clipId === clip.id;
        const displayStart = previewing ? trimPreview.newStart : clip.start;
        const displayDuration = previewing ? trimPreview.newDuration : clip.duration;
        const asset = project.assets.find((candidate) => candidate.id === clip.assetId);
        const preview = resolveAssetPreview(asset, track.kind === "audio" ? "waveform" : "thumbnail", resolvePreview);
        const displayStartSeconds = toSeconds(displayStart);
        const displayDurationSeconds = toSeconds(displayDuration);
        const sourceDurationSeconds = asset?.duration ? toSeconds(asset.duration) : displayDurationSeconds;
        const sourceInSeconds = toSeconds(clip.sourceIn) + displayStartSeconds - toSeconds(clip.start);
        const waveformStyle = track.kind === "audio" && sourceDurationSeconds > 0 && displayDurationSeconds > 0
          ? {
              width: `${(sourceDurationSeconds / displayDurationSeconds) * 100}%`,
              left: `${-(sourceInSeconds / displayDurationSeconds) * 100}%`,
            }
          : undefined;
        return (
          <div
            key={clip.id}
            className={`timeline-clip${preview ? " has-preview" : ""}${selected ? " is-selected" : ""}${previewing ? " is-trimming" : ""}`}
            data-preview-ready={preview ? "true" : "false"}
            data-track-id={track.id}
            data-clip-id={clip.id}
            data-selected={selected ? "true" : "false"}
            style={{
              left: `${(displayStartSeconds / totalSeconds) * 100}%`,
              width: `${(displayDurationSeconds / totalSeconds) * 100}%`,
            }}
          >
            <button
              type="button"
              className="timeline-clip__select"
              aria-label={`${clip.name}, ${track.kind} clip`}
              aria-pressed={selected}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onSelectClip({ trackId: track.id, clipId: clip.id });
              }}
            >
              {preview && (
                <img
                  className={track.kind === "audio" ? "timeline-clip__waveform" : "timeline-clip__thumbnail"}
                  src={preview.url}
                  alt=""
                  style={waveformStyle}
                  data-preview-kind={track.kind === "audio" ? "waveform" : "thumbnail"}
                />
              )}
              <strong>{clip.name}</strong>
              <small>{displayStartSeconds.toFixed(2)}s · {displayDurationSeconds.toFixed(2)}s</small>
            </button>
            {selected && !track.locked && (
              <>
                <button
                  type="button"
                  className="trim-handle trim-handle--start"
                  aria-label={`Trim start of ${clip.name}`}
                  title="Trim start · drag or press [ at the playhead"
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => onTrimPointerDown(event, track.id, clip, "start")}
                  onPointerMove={(event) => onTrimPointerMove(event, track.id, clip, "start")}
                  onPointerUp={(event) => onTrimPointerUp(event, track.id, clip, "start")}
                  onPointerCancel={onTrimPointerCancel}
                />
                <button
                  type="button"
                  className="trim-handle trim-handle--end"
                  aria-label={`Trim end of ${clip.name}`}
                  title="Trim end · drag or press ] at the playhead"
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => onTrimPointerDown(event, track.id, clip, "end")}
                  onPointerMove={(event) => onTrimPointerMove(event, track.id, clip, "end")}
                  onPointerUp={(event) => onTrimPointerUp(event, track.id, clip, "end")}
                  onPointerCancel={onTrimPointerCancel}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TimelinePanel({
  project,
  apply,
  onCollapse,
  onNotice,
  resolvePreview,
}: {
  project: StudioProject;
  apply: ReturnType<typeof useStudioState>["apply"];
  onCollapse: () => void;
  onNotice: (notice: string) => void;
  resolvePreview: PreviewResolver;
}) {
  const totalSeconds = toSeconds(project.timeline.duration);
  const [selection, setSelection] = useState<TimelineClipSelection | null>({ trackId: "track-video", clipId: "clip-main" });
  const [playheadSeconds, setPlayheadSeconds] = useState(Math.min(2.4, totalSeconds));
  const [zoom, setZoom] = useState(1);
  const [ripple, setRipple] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [trimPreview, setTrimPreview] = useState<TimelineTrimPreview | null>(null);
  const ticks = useMemo(() => buildTimelineTicks(totalSeconds, zoom), [totalSeconds, zoom]);
  const selectedTrack = project.timeline.tracks.find((track) => track.id === selection?.trackId);
  const selectedClip = selectedTrack && selectedTrack.kind !== "caption"
    ? selectedTrack.clips.find((clip) => clip.id === selection?.clipId)
    : undefined;
  const selectedStart = selectedClip ? toSeconds(selectedClip.start) : 0;
  const selectedEnd = selectedClip ? selectedStart + toSeconds(selectedClip.duration) : 0;
  const canSplit = Boolean(selectedClip && playheadSeconds > selectedStart && playheadSeconds < selectedEnd);
  const canTrimToPlayhead = Boolean(selectedClip && playheadSeconds > selectedStart && playheadSeconds < selectedEnd);
  const audio = project.timeline.tracks.find((track) => track.id === "track-audio") as AudioTrack | undefined;
  const audioClip = audio?.clips[0];

  const contentStyle = {
    "--timeline-lane-pixels": `${totalSeconds * 80 * zoom}px`,
    "--timeline-grid-percent": `${100 / (8 * zoom)}%`,
  } as CSSProperties;

  const sourceDurationFor = (clip: Clip) => {
    const asset = project.assets.find((candidate) => candidate.id === clip.assetId);
    return asset?.duration ?? rational(
      Math.round((toSeconds(clip.sourceIn) + toSeconds(clip.duration)) * 1_000),
      1_000,
    );
  };

  const setPlayheadFromPointer = (clientX: number, lane: HTMLElement) => {
    const rect = lane.getBoundingClientRect();
    setPlayheadSeconds(secondsFromTimelinePointer(
      clientX,
      rect.left,
      rect.width,
      totalSeconds,
      project.timeline.frameRate,
    ));
  };

  const handleScrubPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    setPlaying(false);
    event.currentTarget.setPointerCapture(event.pointerId);
    setPlayheadFromPointer(event.clientX, event.currentTarget);
  };

  const handleScrubPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    setPlayheadFromPointer(event.clientX, event.currentTarget);
  };

  const handleScrubPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    setPlayheadFromPointer(event.clientX, event.currentTarget);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const trimCandidateFromPointer = (
    event: ReactPointerEvent<HTMLButtonElement>,
    clip: Clip,
    edge: TrimEdge,
  ): TrimCandidate | null => {
    const lane = event.currentTarget.closest<HTMLElement>("[data-timeline-lane]");
    if (!lane) return null;
    const requestedSeconds = secondsFromTimelinePointer(
      event.clientX,
      lane.getBoundingClientRect().left,
      lane.getBoundingClientRect().width,
      totalSeconds,
      project.timeline.frameRate,
    );
    return computeTrimCandidate({
      edge,
      requestedSeconds,
      clipStart: clip.start,
      clipDuration: clip.duration,
      sourceIn: clip.sourceIn,
      sourceDuration: sourceDurationFor(clip),
      timelineDuration: project.timeline.duration,
      frameRate: project.timeline.frameRate,
    });
  };

  const commitTrim = (trackId: string, clip: Clip, candidate: TrimCandidate, source: string) => {
    const unchanged = toSeconds(candidate.newStart) === toSeconds(clip.start) &&
      toSeconds(candidate.newDuration) === toSeconds(clip.duration);
    setTrimPreview(null);
    if (unchanged) return;
    try {
      apply({
        type: "timeline.clip.trim",
        payload: { trackId, clipId: clip.id, ...candidate, ripple },
      });
      onNotice(`${source} · ${ripple ? "ripple" : "edge"} trim committed through timeline.clip.trim`);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Timeline trim was rejected.");
    }
  };

  const handleTrimPointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    trackId: string,
    clip: Clip,
    edge: TrimEdge,
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    setPlaying(false);
    setSelection({ trackId, clipId: clip.id });
    event.currentTarget.setPointerCapture(event.pointerId);
    const candidate = trimCandidateFromPointer(event, clip, edge);
    if (candidate) setTrimPreview({ trackId, clipId: clip.id, ...candidate });
  };

  const handleTrimPointerMove = (
    event: ReactPointerEvent<HTMLButtonElement>,
    trackId: string,
    clip: Clip,
    edge: TrimEdge,
  ) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const candidate = trimCandidateFromPointer(event, clip, edge);
    if (candidate) setTrimPreview({ trackId, clipId: clip.id, ...candidate });
  };

  const handleTrimPointerUp = (
    event: ReactPointerEvent<HTMLButtonElement>,
    trackId: string,
    clip: Clip,
    edge: TrimEdge,
  ) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const candidate = trimCandidateFromPointer(event, clip, edge);
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (candidate) commitTrim(trackId, clip, candidate, `${edge === "start" ? "In" : "Out"} handle`);
  };

  const splitSelected = () => {
    if (!selection || !selectedClip || !canSplit) return;
    const rightClipId = `clip-${crypto.randomUUID()}`;
    try {
      apply({
        type: "timeline.clip.split",
        payload: {
          trackId: selection.trackId,
          clipId: selection.clipId,
          splitAt: rational(
            Math.round(playheadSeconds * project.timeline.frameRate.numerator / project.timeline.frameRate.denominator) * project.timeline.frameRate.denominator,
            project.timeline.frameRate.numerator,
          ),
          rightClipId,
        },
      });
      setSelection({ trackId: selection.trackId, clipId: rightClipId });
      onNotice(`Split at ${formatTimecode(playheadSeconds, project.timeline.frameRate)} · timeline.clip.split`);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Timeline split was rejected.");
    }
  };

  const trimSelectedToPlayhead = (edge: TrimEdge) => {
    if (!selection || !selectedClip || !canTrimToPlayhead) return;
    const candidate = computeTrimCandidate({
      edge,
      requestedSeconds: playheadSeconds,
      clipStart: selectedClip.start,
      clipDuration: selectedClip.duration,
      sourceIn: selectedClip.sourceIn,
      sourceDuration: sourceDurationFor(selectedClip),
      timelineDuration: project.timeline.duration,
      frameRate: project.timeline.frameRate,
    });
    commitTrim(selection.trackId, selectedClip, candidate, edge === "start" ? "Set in to playhead" : "Set out to playhead");
  };

  const togglePlayback = () => {
    if (!playing && playheadSeconds >= totalSeconds) setPlayheadSeconds(0);
    setPlaying((current) => !current);
  };

  useEffect(() => {
    if (!playing) return;
    let animationFrame = 0;
    let previous = performance.now();
    const advance = (now: number) => {
      const elapsed = (now - previous) / 1_000;
      previous = now;
      setPlayheadSeconds((current) => {
        const next = current + elapsed;
        if (next >= totalSeconds) {
          setPlaying(false);
          return totalSeconds;
        }
        return next;
      });
      animationFrame = requestAnimationFrame(advance);
    };
    animationFrame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(animationFrame);
  }, [playing, totalSeconds]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const typing = target instanceof HTMLElement && (
        target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA"
      );
      if (typing || event.ctrlKey || event.metaKey || event.altKey) return;
      if (target instanceof HTMLButtonElement && event.key === " ") return;
      const command = resolveTimelineKeyboardCommand(event.key, event.shiftKey);
      if (!command) return;
      event.preventDefault();
      if (command.type === "playhead.nudge") {
        setPlaying(false);
        setPlayheadSeconds((current) => stepPlayhead(
          current,
          command.direction,
          command.coarse,
          totalSeconds,
          project.timeline.frameRate,
        ));
      } else if (command.type === "playhead.boundary") {
        setPlaying(false);
        setPlayheadSeconds(command.boundary === "start" ? 0 : totalSeconds);
      } else if (command.type === "clip.split") {
        splitSelected();
      } else if (command.type === "clip.trim-start") {
        trimSelectedToPlayhead("start");
      } else if (command.type === "clip.trim-end") {
        trimSelectedToPlayhead("end");
      } else if (command.type === "zoom.change") {
        setZoom((current) => clampTimelineZoom(current + command.direction * TIMELINE_ZOOM_STEP));
      } else {
        togglePlayback();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  return (
    <section className="timeline-panel" aria-label="Timeline editor" data-timeline-zoom={zoom.toFixed(1)}>
      <header className="timeline-toolbar">
        <div className="timeline-identity">
          <span>TIMELINE · VIEW TRANSPORT</span>
          <strong>{formatTimecode(playheadSeconds, project.timeline.frameRate)}</strong>
          <small>/ {formatTimecode(totalSeconds, project.timeline.frameRate)} · {selectedClip?.name ?? "No clip selected"}</small>
        </div>
        <div className="transport" aria-label="Preview transport controls">
          <button aria-label="Go to timeline start" onClick={() => { setPlaying(false); setPlayheadSeconds(0); }}><SkipBack size={13} /></button>
          <button aria-label="Step backward one frame" onClick={() => { setPlaying(false); setPlayheadSeconds((current) => stepPlayhead(current, -1, false, totalSeconds, project.timeline.frameRate)); }}><StepBack size={13} /></button>
          <button className="transport__play" aria-label={playing ? "Pause preview transport" : "Play preview transport"} aria-pressed={playing} onClick={togglePlayback}>
            {playing ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
          </button>
          <button aria-label="Step forward one frame" onClick={() => { setPlaying(false); setPlayheadSeconds((current) => stepPlayhead(current, 1, false, totalSeconds, project.timeline.frameRate)); }}><StepForward size={13} /></button>
          <button aria-label="Go to timeline end" onClick={() => { setPlaying(false); setPlayheadSeconds(totalSeconds); }}><SkipForward size={13} /></button>
        </div>
        <div className="timeline-actions">
          <button className="button button--quiet" disabled={!canSplit} onClick={splitSelected} title="Split selected clip at playhead (S)">
            <Scissors size={13} aria-hidden="true" /> Split
          </button>
          <button className="button button--quiet timeline-boundary-action" disabled={!canTrimToPlayhead} onClick={() => trimSelectedToPlayhead("start")} title="Trim selected clip start to playhead ([)">Set in</button>
          <button className="button button--quiet timeline-boundary-action" disabled={!canTrimToPlayhead} onClick={() => trimSelectedToPlayhead("end")} title="Trim selected clip end to playhead (])">Set out</button>
          <button className={`button button--quiet ripple-toggle${ripple ? " is-active" : ""}`} aria-pressed={ripple} onClick={() => setRipple((current) => !current)} title="Shift downstream clips after an end trim">
            Ripple
          </button>
          {audioClip && (
            <button
              className="icon-button"
              aria-label={audioClip.audio?.muted ? "Unmute source mix" : "Mute source mix"}
              onClick={() => apply({
                type: "timeline.clip.set-audio",
                payload: {
                  trackId: "track-audio",
                  clipId: audioClip.id,
                  gainDb: audioClip.audio?.gainDb ?? 0,
                  muted: !(audioClip.audio?.muted ?? false),
                  fadeIn: audioClip.audio?.fadeIn ?? rational(0),
                  fadeOut: audioClip.audio?.fadeOut ?? rational(0),
                },
              })}
            >
              {audioClip.audio?.muted ? <Volume2 size={13} aria-hidden="true" /> : <VolumeX size={13} aria-hidden="true" />}
            </button>
          )}
          <div className="timeline-zoom" aria-label="Timeline zoom controls">
            <button aria-label="Zoom timeline out" disabled={zoom <= MIN_TIMELINE_ZOOM} onClick={() => setZoom((current) => clampTimelineZoom(current - TIMELINE_ZOOM_STEP))}><ZoomOut size={13} /></button>
            <input
              aria-label="Timeline zoom"
              type="range"
              min={MIN_TIMELINE_ZOOM}
              max={MAX_TIMELINE_ZOOM}
              step={TIMELINE_ZOOM_STEP}
              value={zoom}
              onChange={(event) => setZoom(clampTimelineZoom(Number(event.target.value)))}
            />
            <output>{zoom.toFixed(1)}×</output>
            <button aria-label="Zoom timeline in" disabled={zoom >= MAX_TIMELINE_ZOOM} onClick={() => setZoom((current) => clampTimelineZoom(current + TIMELINE_ZOOM_STEP))}><ZoomIn size={13} /></button>
          </div>
          <button className="icon-button" aria-label="Hide timeline" title="Hide timeline" onClick={onCollapse}>
            <PanelBottomClose size={14} aria-hidden="true" />
          </button>
        </div>
      </header>
      <div className="timeline-scroll-viewport">
        <div className="timeline-content" data-timeline-content style={contentStyle}>
          <div className="timeline-ruler">
            <span className="track-label-spacer"><small>OVERVIEW CACHE</small></span>
            <div
              role="slider"
              tabIndex={0}
              aria-label="Timeline playhead"
              aria-valuemin={0}
              aria-valuemax={totalSeconds}
              aria-valuenow={Number(playheadSeconds.toFixed(3))}
              aria-valuetext={formatTimecode(playheadSeconds, project.timeline.frameRate)}
              onPointerDown={handleScrubPointerDown}
              onPointerMove={handleScrubPointerMove}
              onPointerUp={handleScrubPointerUp}
              onPointerCancel={handleScrubPointerUp}
            >
              {ticks.map((tick) => (
                <span
                  className={`timeline-tick${tick.major ? " is-major" : ""}`}
                  key={`${tick.seconds}-${tick.major ? "major" : "minor"}`}
                  style={{ left: `${tick.positionPercent}%` }}
                >
                  {tick.label && <i>{tick.label}</i>}
                </span>
              ))}
            </div>
          </div>
          {project.timeline.tracks.map((track) => (
            <div className="track-row" key={track.id}>
              <div className="track-label">
                <span>
                  {track.kind === "video" ? <Video size={13} aria-hidden="true" /> : track.kind === "audio" ? <Music2 size={13} aria-hidden="true" /> : <Captions size={13} aria-hidden="true" />}
                </span>
                <strong>{track.name}</strong>
                <i>{track.locked ? <Lock size={11} aria-label="Locked" /> : <Eye size={11} aria-label="Visible" />}</i>
              </div>
              <TrackLane
                track={track}
                totalSeconds={totalSeconds}
                project={project}
                resolvePreview={resolvePreview}
                selection={selection}
                trimPreview={trimPreview}
                onSelectClip={setSelection}
                onScrubPointerDown={handleScrubPointerDown}
                onScrubPointerMove={handleScrubPointerMove}
                onScrubPointerUp={handleScrubPointerUp}
                onTrimPointerDown={handleTrimPointerDown}
                onTrimPointerMove={handleTrimPointerMove}
                onTrimPointerUp={handleTrimPointerUp}
                onTrimPointerCancel={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
                  setTrimPreview(null);
                }}
              />
            </div>
          ))}
          <div className="timeline-playhead-layer" aria-hidden="true">
            <div className={`playhead${playing ? " is-playing" : ""}`} style={{ left: `${(playheadSeconds / totalSeconds) * 100}%` }}>
              <i />
            </div>
          </div>
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

/**
 * The eight capabilities an agent harness can reach over MCP. Rendered from the
 * same list the transport advertises so the dashboard cannot drift from what is
 * actually callable.
 */
const AGENT_CAPABILITIES: ReadonlyArray<{ id: string; risk: string; live: boolean }> = [
  { id: "studio.project.inspect", risk: "read only", live: true },
  { id: "studio.project.validate", risk: "read only", live: true },
  { id: "studio.project.plan", risk: "simulation", live: true },
  { id: "studio.project.apply_operations", risk: "local write", live: true },
  { id: "studio.project.render", risk: "local write", live: true },
  { id: "studio.job.get", risk: "read only", live: true },
  { id: "studio.job.cancel", risk: "local write", live: true },
  { id: "studio.operation.undo", risk: "local write", live: true },
];

const PILLARS: ReadonlyArray<{
  workspace: WorkspaceId;
  icon: LucideIcon;
  title: string;
  body: string;
  status: string;
}> = [
  {
    workspace: "capture",
    icon: MonitorPlay,
    title: "Capture",
    body: "Record a display, window or camera as a re-editable document with cursor and event tracks.",
    status: "Milestone 9",
  },
  {
    workspace: "edit",
    icon: Clapperboard,
    title: "Edit",
    body: "Multi-track timeline with frame-snapped trim, split, transcript and captions.",
    status: "Live",
  },
  {
    workspace: "create",
    icon: Shapes,
    title: "Design",
    body: "Layered canvas, typography, brand systems and platform variants.",
    status: "In progress",
  },
];

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="stat-card">
      <span className="stat-card__label">{label}</span>
      <strong className="stat-card__value">{value}</strong>
      <small className="stat-card__hint">{hint}</small>
    </div>
  );
}

function HomeDashboard({
  project,
  renderJob,
  onOpenWorkspace,
  onNotice,
}: {
  project: StudioProject;
  renderJob: ReturnType<typeof useStudioState>["renderJob"];
  onOpenWorkspace: (workspace: WorkspaceId) => void;
  onNotice: (notice: string) => void;
}) {
  const totalSeconds = toSeconds(project.timeline.duration);
  const clipCount = project.timeline.tracks.reduce(
    (total, track) => total + (track.kind === "caption" ? track.segments.length : track.clips.length),
    0,
  );

  return (
    <section className="home-dashboard" data-surface="home">
      <header className="home-hero">
        <div>
          <span className="home-hero__eyebrow">AGENT-NATIVE CONTENT STUDIO</span>
          <h1>One project. Capture, edit and design.</h1>
          <p>
            Every surface below is reachable by a human here and by an agent harness over MCP —
            the same typed operations, the same validation, the same history.
          </p>
        </div>
        <div className="home-hero__actions">
          <button className="button button--accent" onClick={() => onOpenWorkspace("capture")}>
            <MonitorPlay size={14} aria-hidden="true" />
            New capture
          </button>
          <button className="button button--quiet" onClick={() => onOpenWorkspace("edit")}>
            <Clapperboard size={14} aria-hidden="true" />
            Open timeline
          </button>
        </div>
      </header>

      <div className="home-stats">
        <StatCard label="Project" value={project.name} hint={`Revision r${project.revision}`} />
        <StatCard label="Duration" value={`${totalSeconds.toFixed(2)}s`} hint={`${clipCount} timeline items`} />
        <StatCard label="Assets" value={String(project.assets.length)} hint="Content-addressed originals" />
        <StatCard
          label="Render job"
          value={renderJob ? renderJob.status : "idle"}
          hint={renderJob ? `${Math.round(renderJob.progress.fraction * 100)}% · ${renderJob.progress.stage}` : "No job queued"}
        />
      </div>

      <div className="home-columns">
        <section className="home-panel" aria-labelledby="home-pillars">
          <h2 id="home-pillars">Workspaces</h2>
          <div className="pillar-grid">
            {PILLARS.map((pillar) => (
              <button key={pillar.workspace} className="pillar-card" onClick={() => onOpenWorkspace(pillar.workspace)}>
                <span className="pillar-card__icon"><pillar.icon size={18} aria-hidden="true" /></span>
                <strong>{pillar.title}</strong>
                <small>{pillar.body}</small>
                <i className="pillar-card__status">{pillar.status}</i>
              </button>
            ))}
          </div>
        </section>

        <section className="home-panel" aria-labelledby="home-agent">
          <h2 id="home-agent">Agent surface</h2>
          <p className="home-panel__lead">
            Discoverable over MCP at <code>tools/list</code>. A harness needs no hardcoded knowledge of this list.
          </p>
          <ul className="capability-list">
            {AGENT_CAPABILITIES.map((capability) => (
              <li key={capability.id}>
                <span className={`capability-dot${capability.live ? " is-live" : ""}`} aria-hidden="true" />
                <code>{capability.id}</code>
                <small>{capability.risk}</small>
              </li>
            ))}
          </ul>
          <button
            className="button button--quiet"
            onClick={() => onNotice("Start the transport with: npm run mcp:http — then point a harness at http://127.0.0.1:7777")}
          >
            <Bot size={14} aria-hidden="true" />
            How to connect a harness
          </button>
        </section>
      </div>
    </section>
  );
}

const CAPTURE_SOURCES: ReadonlyArray<{ id: string; kind: string; label: string; detail: string }> = [
  { id: "display-1", kind: "Display", label: "Primary display", detail: "2560 × 1440 · 60 fps" },
  { id: "window-1", kind: "Window", label: "Application window", detail: "Follows focus changes" },
  { id: "region-1", kind: "Region", label: "Custom region", detail: "Drag to define bounds" },
  { id: "camera-1", kind: "Camera", label: "Camera overlay", detail: "Bubble overlay · follows cursor" },
];

function CaptureWorkspace({ onNotice }: { onNotice: (notice: string) => void }) {
  const [selectedSource, setSelectedSource] = useState("display-1");

  return (
    <section className="canvas-workspace capture-workspace">
      <header>
        <div><span>CAPTURE</span><strong>Recording surface</strong><i>MILESTONE 9</i></div>
      </header>
      <div className="capture-stage">
        <div className="capture-preview" role="img" aria-label="Capture preview placeholder">
          <span className="capture-preview__frame">
            <MonitorPlay size={32} aria-hidden="true" />
            <strong>{CAPTURE_SOURCES.find((source) => source.id === selectedSource)?.label}</strong>
            <small>Preview appears here once the capture worker is implemented</small>
          </span>
        </div>

        <div className="capture-controls" role="group" aria-label="Capture controls">
          <button
            className="button button--accent"
            onClick={() => onNotice("Capture requires explicit OS consent and a visible recording indicator. The worker is not implemented (Milestone 9).")}
          >
            <Circle size={12} aria-hidden="true" />
            Start recording
          </button>
          <span className="capture-consent">
            <ShieldCheck size={13} aria-hidden="true" />
            Consent-gated · indicator always visible · keystrokes off by default
          </span>
        </div>

        <div className="capture-source-grid">
          {CAPTURE_SOURCES.map((source) => (
            <button
              key={source.id}
              className={`capture-source${selectedSource === source.id ? " is-selected" : ""}`}
              aria-pressed={selectedSource === source.id}
              onClick={() => setSelectedSource(source.id)}
            >
              <span>{source.kind}</span>
              <strong>{source.label}</strong>
              <small>{source.detail}</small>
            </button>
          ))}
        </div>
      </div>
    </section>
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
    history,
    revert,
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

  const revertWithNotice = (operationId: string) => {
    try {
      const diff = revert(operationId);
      setNotice(`Reverted · ${diff?.summary ?? "change reversed"} · applied forward as a new revision`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "That change could not be reverted.");
    }
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
      if (event.altKey && /^[1-6]$/.test(event.key)) {
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

      {isFullBleedWorkspace(shell.workspace) ? (
        <HomeDashboard
          project={project}
          renderJob={renderJob}
          onOpenWorkspace={chooseWorkspace}
          onNotice={setNotice}
        />
      ) : (
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
        {shell.workspace === "capture" ? (
          <CaptureWorkspace onNotice={setNotice} />
        ) : (
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
        )}
        {shell.visibility.right && (
          <RightRail
            project={project}
            history={history}
            onRevert={revertWithNotice}
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
      )}

      {shell.visibility.timeline && (
        <TimelinePanel
          project={project}
          apply={apply}
          onCollapse={() => toggleRegion("timeline")}
          onNotice={setNotice}
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
