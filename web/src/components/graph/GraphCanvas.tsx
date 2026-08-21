import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
} from "d3-force";
import type { GraphEdge, GraphNode } from "../../api/client";
import { NODE_COLOR, NODE_RADIUS } from "./nodeStyle";

/**
 * Force-directed graph canvas.
 *
 * Rendered as hand-written SVG rather than through a charting library so the
 * palette, type scale and edge treatment match the rest of the console. d3 is
 * used only for the layout simulation.
 *
 * Interaction follows what people already expect from a graph browser:
 * drag to reposition (a dragged node stays pinned, because the reason you moved
 * it is that you wanted it there), double-click to expand, single click to
 * inspect, scroll to zoom, drag the background to pan.
 */

export interface SimNode extends GraphNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  expanded?: boolean;
}

interface SimEdge {
  source: SimNode | string;
  target: SimNode | string;
  type: string;
  /** Index among edges sharing the same pair, so parallel relationships bow
   *  apart instead of stacking into one illegible line. */
  curve: number;
}

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onExpand: (id: string) => void;
  expandedIds: Set<string>;
  busyId: string | null;
}

export default function GraphCanvas({
  nodes,
  edges,
  selectedId,
  onSelect,
  onExpand,
  expandedIds,
  busyId,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const simRef = useRef<Simulation<SimNode, undefined> | null>(null);
  const nodesRef = useRef<Map<string, SimNode>>(new Map());
  const edgesRef = useRef<SimEdge[]>([]);
  const [, setFrame] = useState(0);
  const frameQueued = useRef(false);

  /**
   * Repaint at most once per animation frame.
   *
   * The simulation ticks around 60 times a second and each tick used to trigger
   * a React render directly, which queues renders faster than they complete and
   * locks the tab. Coalescing into a single rAF keeps the frame rate bounded by
   * the display rather than by d3.
   */
  const requestRepaint = useCallback(() => {
    if (frameQueued.current) return;
    frameQueued.current = true;
    requestAnimationFrame(() => {
      frameQueued.current = false;
      setFrame((f) => f + 1);
    });
  }, []);

  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const panRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const dragRef = useRef<{ id: string } | null>(null);
  const [size, setSize] = useState({ w: 900, h: 600 });

  /* Keep the viewport in sync with the container. */
  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.max(320, width), h: Math.max(240, height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* Merge incoming data into the live simulation, preserving positions of nodes
     that are already on screen - an expand should grow the picture, never
     reshuffle what the user is looking at. */
  useEffect(() => {
    const map = nodesRef.current;
    const incoming = new Set(nodes.map((n) => n.id));

    nodes.forEach((n, i) => {
      const existing = map.get(n.id);
      if (existing) {
        Object.assign(existing, n);
      } else {
        // New nodes enter on a ring whose radius grows with how many are
        // arriving. Seeding a class of fifty onto a fixed small circle leaves
        // them overlapping, and with no links between them there is nothing
        // pulling them apart afterwards.
        const incomingCount = Math.max(1, nodes.length);
        const radius = 80 + incomingCount * 7;
        const angle = (i / incomingCount) * Math.PI * 2;
        map.set(n.id, {
          ...n,
          x: size.w / 2 + Math.cos(angle) * radius,
          y: size.h / 2 + Math.sin(angle) * radius,
        });
      }
    });
    [...map.keys()].forEach((id) => {
      if (!incoming.has(id)) map.delete(id);
    });

    const pairCount = new Map<string, number>();
    edgesRef.current = edges
      .filter((e) => map.has(e.source) && map.has(e.target))
      .map((e) => {
        const pair = [e.source, e.target].sort().join("|");
        const seen = pairCount.get(pair) ?? 0;
        pairCount.set(pair, seen + 1);
        return {
          source: map.get(e.source)!,
          target: map.get(e.target)!,
          type: e.type,
          curve: seen,
        };
      });

    const list = [...map.values()];
    let sim = simRef.current;
    if (!sim) {
      sim = forceSimulation<SimNode>(list)
        .force("charge", forceManyBody<SimNode>().strength(-780).distanceMax(760))
        // Collision radius accounts for the caption beneath each node, not just
        // the circle. Spacing on the circle alone leaves the labels overlapping,
        // which is what actually makes a graph unreadable.
        .force(
          "collide",
          forceCollide<SimNode>()
            .radius((d) => (NODE_RADIUS[d.type] ?? 18) + 30)
            .iterations(3),
        )
        .force("x", forceX<SimNode>(size.w / 2).strength(0.02))
        .force("y", forceY<SimNode>(size.h / 2).strength(0.03))
        .on("tick", requestRepaint);
      simRef.current = sim;
    } else {
      sim.nodes(list);
    }

    // Centring is eased off as the canvas fills: it is useful for keeping a
    // handful of nodes in view and counterproductive once fifty are competing
    // for the middle.
    const crowding = Math.min(1, list.length / 40);
    sim
      .force(
        "center",
        forceCenter(size.w / 2, size.h / 2).strength(0.06 * (1 - crowding * 0.9)),
      )
      .force(
        "link",
        forceLink<SimNode, SimEdge>(edgesRef.current)
          .id((d) => d.id)
          // Containment is tight (a method belongs inside its class); everything
          // else needs room for a relationship label on the line.
          .distance((l) => (l.type === "CONTAINS" ? 86 : 175))
          .strength(0.35),
      );
    // A bigger batch needs longer to unpack itself.
    sim.alpha(list.length > 25 ? 1 : 0.7).restart();
  }, [nodes, edges, size.w, size.h, requestRepaint]);

  useEffect(
    () => () => {
      simRef.current?.stop();
    },
    [],
  );

  /* --- interaction ------------------------------------------------------- */
  const toWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - view.x) / view.k,
        y: (clientY - rect.top - view.y) / view.k,
      };
    },
    [view],
  );

  useEffect(() => {
    const release = () => {
      dragRef.current = null;
      panRef.current = null;
    };
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, []);

  const onNodePointerDown = (e: React.PointerEvent, node: SimNode) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { id: node.id };
    node.fx = node.x;
    node.fy = node.y;
    // A one-shot alpha rather than alphaTarget. alphaTarget is sticky: if a
    // pointerup is ever missed the simulation keeps ticking forever and the tab
    // locks up. A decaying alpha always settles on its own.
    simRef.current?.alpha(0.3).restart();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragRef.current) {
      const node = nodesRef.current.get(dragRef.current.id);
      if (node) {
        const { x, y } = toWorld(e.clientX, e.clientY);
        node.fx = x;
        node.fy = y;
        // Nudge the layout so neighbours follow the dragged node, but with a
        // decaying alpha so releasing anywhere still comes to rest.
        simRef.current?.alpha(0.2).restart();
        requestRepaint();
      }
      return;
    }
    if (panRef.current) {
      // Read the pan origin NOW, not inside the updater. React may run a state
      // updater later, or re-run it during render, and by then a pointerup
      // handler can have cleared the ref - dereferencing it there crashes the
      // whole canvas.
      const { x: originX, y: originY, vx, vy } = panRef.current;
      const nextX = vx + (e.clientX - originX);
      const nextY = vy + (e.clientY - originY);
      setView((v) => ({ ...v, x: nextX, y: nextY }));
    }
  };

  const endInteraction = () => {
    // A dragged node stays pinned. Releasing it back into the simulation would
    // undo the placement the user just chose.
    dragRef.current = null;
    panRef.current = null;
  };

  const onBackgroundPointerDown = (e: React.PointerEvent) => {
    panRef.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    onSelect(null);
  };

  const onWheel = (e: React.WheelEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scale = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setView((v) => {
      const k = Math.min(3, Math.max(0.25, v.k * scale));
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      return { k, x: px - ((px - v.x) * k) / v.k, y: py - ((py - v.y) * k) / v.k };
    });
  };

  const releaseAll = () => {
    nodesRef.current.forEach((n) => {
      n.fx = null;
      n.fy = null;
    });
    simRef.current?.alpha(0.6).restart();
  };

  const fit = () => setView({ x: 0, y: 0, k: 1 });

  const list = [...nodesRef.current.values()];
  const liveEdges = edgesRef.current;

  const neighbours = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const set = new Set<string>();
    liveEdges.forEach((e) => {
      const s = (e.source as SimNode).id;
      const t = (e.target as SimNode).id;
      if (s === selectedId) set.add(t);
      if (t === selectedId) set.add(s);
    });
    return set;
    // Recomputed on every tick is wasteful, so it keys on the selection and the
    // edge count rather than the mutating array itself.
  }, [selectedId, liveEdges.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink-975">
      {/* Faint grid, so panning and zooming are legible as movement. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(60,102,206,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(60,102,206,0.09) 1px, transparent 1px)",
          backgroundSize: `${28 * view.k}px ${28 * view.k}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
        }}
      />

      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        onPointerDown={onBackgroundPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endInteraction}
        onPointerLeave={endInteraction}
        onWheel={onWheel}
        className="relative touch-none select-none"
        style={{ cursor: panRef.current ? "grabbing" : "grab" }}
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(71,84,103,0.55)" />
          </marker>
          <marker
            id="arrow-active"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-cgz-cyan)" />
          </marker>
        </defs>

        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          {/* Edges */}
          <g>
            {liveEdges.map((e, i) => {
              const s = e.source as SimNode;
              const t = e.target as SimNode;
              if (s.x == null || t.x == null) return null;
              const active =
                selectedId != null && (s.id === selectedId || t.id === selectedId);

              const dx = (t.x ?? 0) - (s.x ?? 0);
              const dy = (t.y ?? 0) - (s.y ?? 0);
              const dist = Math.hypot(dx, dy) || 1;
              const bow = e.curve * 26;
              const mx = ((s.x ?? 0) + (t.x ?? 0)) / 2 - (dy / dist) * bow;
              const my = ((s.y ?? 0) + (t.y ?? 0)) / 2 + (dx / dist) * bow;

              // Stop the line at the node's edge so the arrowhead is visible.
              const tr = (NODE_RADIUS[t.type] ?? 18) + 7;
              const ex = (t.x ?? 0) - (dx / dist) * tr;
              const ey = (t.y ?? 0) - (dy / dist) * tr;

              const path = `M ${s.x} ${s.y} Q ${mx} ${my} ${ex} ${ey}`;

              // Midpoint of the quadratic curve at t = 0.5, so the label sits
              // on the line rather than beside the straight chord.
              const labelX = 0.25 * (s.x ?? 0) + 0.5 * mx + 0.25 * ex;
              const labelY = 0.25 * (s.y ?? 0) + 0.5 * my + 0.25 * ey;
              const rawAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
              const labelAngle = rawAngle > 90 || rawAngle < -90 ? rawAngle + 180 : rawAngle;

              return (
                <g key={`${s.id}-${e.type}-${t.id}-${i}`} opacity={selectedId && !active ? 0.22 : 1}>
                  <path
                    id={`edge-${i}`}
                    d={path}
                    fill="none"
                    stroke={active ? "var(--color-accent)" : "rgba(71,84,103,0.30)"}
                    strokeWidth={active ? 1.6 : 1.1}
                    markerEnd={active ? "url(#arrow-active)" : "url(#arrow)"}
                  />
                  {view.k > 0.55 && (
                    // Placed and rotated manually rather than with textPath.
                    // A textPath follows the path's direction, so any edge
                    // running right-to-left renders its label mirrored and
                    // unreadable. Flipping the rotation past vertical keeps
                    // every label upright regardless of edge direction.
                    <g
                      transform={`translate(${labelX},${labelY}) rotate(${labelAngle})`}
                      className="pointer-events-none"
                    >
                      <text
                        textAnchor="middle"
                        dy={-3}
                        fill={active ? "var(--color-accent)" : "rgba(71,84,103,0.72)"}
                        fontSize={8.5}
                        fontFamily="var(--font-mono)"
                        letterSpacing="0.04em"
                        stroke="var(--color-ink-975)"
                        strokeWidth={2.6}
                        paintOrder="stroke"
                      >
                        {e.type}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          {/* Nodes */}
          <g>
            {list.map((n) => {
              if (n.x == null || n.y == null) return null;
              const r = NODE_RADIUS[n.type] ?? 18;
              const color = NODE_COLOR[n.type] ?? "var(--color-state-idle)";
              const isSelected = n.id === selectedId;
              const dim = selectedId != null && !isSelected && !neighbours.has(n.id);
              const pinned = n.fx != null;

              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x},${n.y})`}
                  opacity={dim ? 0.3 : 1}
                  style={{ cursor: "pointer" }}
                  onPointerDown={(e) => onNodePointerDown(e, n)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (e.detail > 1) return; // second click of a double-click
                    onSelect(n.id);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onExpand(n.id);
                  }}
                >
                  {isSelected && (
                    <circle r={r + 6} fill="none" stroke="var(--color-cgz-cyan)" strokeWidth={1.5} />
                  )}
                  {busyId === n.id && (
                    <circle
                      r={r + 10}
                      fill="none"
                      stroke="var(--color-cgz-cyan)"
                      strokeWidth={1}
                      strokeDasharray="4 6"
                      opacity={0.8}
                    >
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from="0"
                        to="360"
                        dur="1.4s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}
                  <circle r={r} fill={color} fillOpacity={0.22} stroke={color} strokeWidth={1.6} />
                  {expandedIds.has(n.id) ? null : (
                    // A small tick marks nodes whose neighbours are not on
                    // screen yet, so "what can I still open" is visible.
                    <circle r={2} cx={r - 3} cy={-r + 3} fill={color} />
                  )}
                  {pinned && (
                    <circle r={2.5} cx={-r + 3} cy={-r + 3} fill="rgba(255,255,255,0.35)" />
                  )}
                  <text
                    textAnchor="middle"
                    dy={r + 12}
                    fontSize={10}
                    fill={isSelected ? "#0b1a63" : "rgba(52,64,84,0.88)"}
                    fontFamily="var(--font-mono)"
                    className="pointer-events-none"
                  >
                    {n.caption.length > 22 ? `${n.caption.slice(0, 21)}…` : n.caption}
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {/* Viewport controls */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
        <button
          onClick={releaseAll}
          className="rounded-[3px] border hairline bg-ink-900/90 px-2 py-1 font-mono text-[10px] text-gray-400 hover:text-gray-100"
          title="Release every pinned node back into the layout"
        >
          unpin all
        </button>
        <button
          onClick={fit}
          className="rounded-[3px] border hairline bg-ink-900/90 px-2 py-1 font-mono text-[10px] text-gray-400 hover:text-gray-100"
        >
          reset view
        </button>
        <span className="tnum rounded-[3px] border hairline bg-ink-900/90 px-2 py-1 font-mono text-[10px] text-gray-500">
          {Math.round(view.k * 100)}%
        </span>
      </div>

      <p className="pointer-events-none absolute bottom-3 left-3 font-mono text-[10px] text-gray-600">
        drag to move · double-click to expand · scroll to zoom
      </p>
    </div>
  );
}
