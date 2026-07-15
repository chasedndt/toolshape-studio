import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type {
  AudioTrack,
  Scene,
  SceneNode,
  StudioProject,
  TextNode,
  Track,
} from "@toolshape/studio-domain";
import { rational, toSeconds, validateStudioProject } from "@toolshape/studio-engine";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";
import { useStudioState } from "./studio-state";

const ICONS: Record<SceneNode["type"], string> = {
  text: "T",
  image: "◫",
  shape: "◇",
  group: "⌘",
};

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

function SectionTitle({ eyebrow, title, action }: { eyebrow: string; title: string; action?: string }) {
  return (
    <div className="section-title">
      <div>
        <span>{eyebrow}</span>
        <strong>{title}</strong>
      </div>
      {action && <button className="icon-button" aria-label={action}>+</button>}
    </div>
  );
}

function LeftRail({
  project,
  selectedNodeId,
  onSelect,
}: {
  project: StudioProject;
  selectedNodeId: string;
  onSelect: (id: string) => void;
}) {
  const scene = project.scenes[0];
  return (
    <aside className="left-rail panel-boundary" aria-label="Assets and layers">
      <section>
        <SectionTitle eyebrow="SOURCE GRAPH" title="Assets" action="Import asset" />
        <div className="asset-grid">
          {project.assets.slice(0, 2).map((asset, index) => (
            <button className="asset-card" key={asset.id} aria-label={`Select ${asset.name}`}>
              <span className={`asset-card__preview asset-card__preview--${index}`}>
                {asset.kind === "video" && <i>00:08</i>}
              </span>
              <strong>{asset.name}</strong>
              <small>{asset.kind.toUpperCase()} · IMMUTABLE</small>
            </button>
          ))}
        </div>
      </section>
      <section className="layers-section">
        <SectionTitle eyebrow="SCENE / 01" title="Layers" />
        <div className="layer-list">
          {[...scene.nodes]
            .sort((left, right) => right.zIndex - left.zIndex)
            .map((node) => (
              <button
                key={node.id}
                className={`layer-row${selectedNodeId === node.id ? " is-active" : ""}`}
                onClick={() => onSelect(node.id)}
              >
                <span className={`layer-icon layer-icon--${node.type}`}>{ICONS[node.type]}</span>
                <span>
                  <strong>{node.name}</strong>
                  <small>{node.type} · r{node.revision}</small>
                </span>
                <i>{node.visible ? "●" : "○"}</i>
              </button>
            ))}
        </div>
      </section>
      <div className="source-proof">
        <span className="source-proof__mark">✓</span>
        <span><strong>Source graph intact</strong><small>3 hashed originals</small></span>
      </div>
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

function RightRail({
  project,
  scene,
  selectedNode,
  lastDiff,
  apply,
}: {
  project: StudioProject;
  scene: Scene;
  selectedNode: SceneNode;
  lastDiff: ReturnType<typeof useStudioState>["lastDiff"];
  apply: ReturnType<typeof useStudioState>["apply"];
}) {
  const validationIssues = useMemo(() => validateStudioProject(project), [project]);
  return (
    <aside className="right-rail panel-boundary" aria-label="Review and inspector">
      <section className="agent-card">
        <div className="agent-card__header">
          <div className="agent-orb"><span /></div>
          <div><span>TOOLSHAPE AGENT</span><strong>Plan is inspectable</strong></div>
          <i>READY</i>
        </div>
        <p>{lastDiff?.summary ?? "A semantic edit plan is staged. Every change remains revision-bound and reversible."}</p>
        <div className="diff-strip">
          <span>SEMANTIC DIFF</span>
          <strong>{lastDiff ? `${lastDiff.changedPaths.length} paths` : "No mutation yet"}</strong>
          <small>r{lastDiff?.beforeRevision ?? project.revision} → r{lastDiff?.afterRevision ?? project.revision}</small>
        </div>
        <div className="agent-actions">
          <button
            className="button button--accent"
            onClick={() =>
              apply(
                {
                  type: "style.profile.apply",
                  payload: { styleProfileRef: { id: "style-night-citrus", version: 1, name: "Night Citrus" } },
                },
                "agent",
              )
            }
          >
            Apply candidate
          </button>
          <button className="button button--quiet">Review paths</button>
        </div>
      </section>

      <section className="inspector-section">
        <SectionTitle eyebrow="DIRECT EDIT" title="Inspector" />
        <div className="selection-chip">
          <span className={`layer-icon layer-icon--${selectedNode.type}`}>{ICONS[selectedNode.type]}</span>
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
        <div className="field-grid">
          <label className="field"><span>X</span><output>{Math.round(selectedNode.transform.x)}</output></label>
          <label className="field"><span>Y</span><output>{Math.round(selectedNode.transform.y)}</output></label>
          <label className="field"><span>ROT</span><output>{selectedNode.transform.rotationDeg}°</output></label>
          <label className="field"><span>OPACITY</span><output>{Math.round(selectedNode.transform.opacity * 100)}%</output></label>
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

      <section className="quality-card">
        <span>QUALITY GATE</span>
        <strong>{validationIssues.filter((issue) => issue.severity === "error").length === 0 ? "Canonical state valid" : "Action required"}</strong>
        <small>{validationIssues.length} validator notice{validationIssues.length === 1 ? "" : "s"}</small>
        <div className="quality-line"><i style={{ width: "100%" }} /></div>
      </section>
    </aside>
  );
}

function TrackLane({ track, totalSeconds }: { track: Track; totalSeconds: number }) {
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
      {track.clips.map((clip) => (
        <span
          key={clip.id}
          className="timeline-clip"
          style={{
            left: `${(toSeconds(clip.start) / totalSeconds) * 100}%`,
            width: `${(toSeconds(clip.duration) / totalSeconds) * 100}%`,
          }}
        >
          <strong>{clip.name}</strong>
          {track.kind === "audio" && (
            <i className="waveform" aria-hidden="true">
              {Array.from({ length: 36 }, (_, index) => (
                <b key={index} style={{ height: `${25 + ((index * 17) % 65)}%` }} />
              ))}
            </i>
          )}
        </span>
      ))}
    </div>
  );
}

function TimelinePanel({
  project,
  apply,
}: {
  project: StudioProject;
  apply: ReturnType<typeof useStudioState>["apply"];
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
        <div><span>TIMELINE</span><strong>00:00:02:12</strong><small>/ 00:00:08:00</small></div>
        <div className="transport" aria-label="Playback controls">
          <button aria-label="Go to start">|◀</button><button aria-label="Step backward">‹</button>
          <button className="transport__play" aria-label="Play">▶</button>
          <button aria-label="Step forward">›</button><button aria-label="Go to end">▶|</button>
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
            {audioClip.audio?.muted ? "Unmute" : "Mute"}
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
              <span>{track.kind === "video" ? "◫" : track.kind === "audio" ? "∿" : "CC"}</span>
              <strong>{track.name}</strong>
              <i>{track.locked ? "⌑" : "●"}</i>
            </div>
            <TrackLane track={track} totalSeconds={totalSeconds} />
          </div>
        ))}
        <div className="playhead" style={{ left: `calc(188px + ${(2.4 / totalSeconds) * 100}% - ${(2.4 / totalSeconds) * 188}px)` }}>
          <i />
        </div>
      </div>
    </section>
  );
}

export function App() {
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
  const [selectedNodeId, setSelectedNodeId] = useState("node-title");
  const [notice, setNotice] = useState<string | null>(null);
  const exportMode = new URLSearchParams(window.location.search).get("export") === "cover";
  const scene = project.scenes.find((candidate) => candidate.id === project.activeSceneId)!;
  const selectedNode = scene.nodes.find((node) => node.id === selectedNodeId) ?? scene.nodes[0];

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

  if (exportMode) {
    return (
      <main className="export-surface">
        <SceneCanvas project={project} selectedNodeId={null} scale={0.5} exportMode />
      </main>
    );
  }

  return (
    <main className="studio-shell">
      <header className="topbar">
        <div className="brand-lockup"><span className="brand-mark">T</span><strong>TOOLSHAPE</strong><i>STUDIO</i></div>
        <div className="project-crumb"><span>PROJECT</span><strong>{project.name}</strong><i>r{project.revision}</i></div>
        <div className="topbar-status"><span className="status-dot" /><strong>Editable draft</strong><small>Local fixture</small></div>
        <div className="topbar-actions">
          <button className="button button--quiet" onClick={undo} disabled={!canUndo}>↶ Undo</button>
          <button className="button button--quiet" onClick={redo} disabled={!canRedo}>↷ Redo</button>
          <button className="button button--quiet">Share review</button>
          <button
            className="button button--accent"
            onClick={() => {
              const job = queueRender();
              setNotice(`Render queued · ${job.job_id.slice(0, 8)} · ${job.status}`);
            }}
          >
            {renderJob ? "Job queued" : "Render proof"}
          </button>
        </div>
      </header>

      <div className="workspace-grid">
        <LeftRail project={project} selectedNodeId={selectedNode.id} onSelect={setSelectedNodeId} />
        <section className="canvas-workspace" onClick={() => setSelectedNodeId("node-title")}>
          <header>
            <div><span>ARTBOARD 01</span><strong>Social portrait</strong></div>
            <div className="canvas-tools"><button aria-label="Selection tool" className="is-active">↖</button><button aria-label="Hand tool">✋</button><button aria-label="Comment tool">◌</button></div>
            <div><small>29%</small><button className="icon-button" aria-label="Fit canvas">⌗</button></div>
          </header>
          <div className="canvas-stage">
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
        <RightRail
          project={project}
          scene={scene}
          selectedNode={selectedNode}
          lastDiff={lastDiff}
          apply={apply}
        />
      </div>

      <TimelinePanel project={project} apply={apply} />
      {notice && <button className="notice" onClick={() => setNotice(null)}>{notice}<span>Dismiss</span></button>}
    </main>
  );
}
