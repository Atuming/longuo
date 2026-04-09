import { useState, useRef, useEffect, useCallback, type CSSProperties } from 'react';
import type { Character } from '../../types/character';
import type { CharacterRelationship } from '../../types/relationship';
import type { TimelinePoint } from '../../types/timeline';

/* ── 关系类型颜色映射 ── */
const REL_COLORS: Record<string, string> = {
  family: '#38A169',
  friend: '#3182CE',
  enemy: '#E53E3E',
  lover: '#ED64A6',
  mentor: '#9F7AEA',
  superior: '#718096',
  ally: '#3182CE',
  custom: '#718096',
};

const REL_LABELS: Record<string, string> = {
  family: '亲属', friend: '朋友', enemy: '敌人', lover: '恋人',
  mentor: '师徒', superior: '上下级', ally: '盟友', custom: '自定义',
};

/* ── 节点颜色池 ── */
const NODE_COLORS = [
  '#3182CE', '#E53E3E', '#38A169', '#ED64A6', '#9F7AEA',
  '#DD6B20', '#319795', '#D69E2E', '#718096', '#805AD5',
];

interface GraphNode {
  id: string;
  name: string;
  initials: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  color: string;
  relationship: CharacterRelationship;
}

const s: Record<string, CSSProperties> = {
  wrapper: { position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#F7FAFC' },
  svg: { width: '100%', height: '100%', cursor: 'grab' },
};

export interface RelationshipGraphViewProps {
  characters: Character[];
  relationships: CharacterRelationship[];
  timelinePoints: TimelinePoint[];
  selectedTimelineId?: string | null;
  filterTypes?: Set<string>;
  onSelectCharacter?: (characterId: string) => void;
  onSelectRelationship?: (relationship: CharacterRelationship) => void;
  highlightCharacterId?: string | null;
}

export function RelationshipGraphView({
  characters, relationships, timelinePoints,
  selectedTimelineId, filterTypes,
  onSelectCharacter, onSelectRelationship,
  highlightCharacterId,
}: RelationshipGraphViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const animRef = useRef<number>(0);
  const nodesRef = useRef<GraphNode[]>([]);

  // Filter relationships by timeline and type
  const filteredRelationships = relationships.filter((rel) => {
    if (filterTypes && filterTypes.size > 0 && !filterTypes.has(rel.relationshipType)) return false;
    if (selectedTimelineId && timelinePoints.length > 0) {
      const tp = timelinePoints.find((t) => t.id === selectedTimelineId);
      if (tp) {
        const startTp = timelinePoints.find((t) => t.id === rel.startTimelinePointId);
        const endTp = rel.endTimelinePointId ? timelinePoints.find((t) => t.id === rel.endTimelinePointId) : null;
        if (startTp && startTp.sortOrder > tp.sortOrder) return false;
        if (endTp && endTp.sortOrder < tp.sortOrder) return false;
      }
    }
    return true;
  });

  // Build graph data
  useEffect(() => {
    const charIds = new Set<string>();
    for (const rel of filteredRelationships) {
      charIds.add(rel.sourceCharacterId);
      charIds.add(rel.targetCharacterId);
    }
    // Also include characters without relationships
    for (const ch of characters) { charIds.add(ch.id); }

    const width = svgRef.current?.clientWidth ?? 800;
    const height = svgRef.current?.clientHeight ?? 600;
    const cx = width / 2;
    const cy = height / 2;

    const newNodes: GraphNode[] = [];
    let idx = 0;
    for (const ch of characters) {
      if (!charIds.has(ch.id)) continue;
      const angle = (2 * Math.PI * idx) / Math.max(characters.length, 1);
      const radius = Math.min(width, height) * 0.3;
      newNodes.push({
        id: ch.id,
        name: ch.name,
        initials: ch.name.slice(0, 1),
        color: NODE_COLORS[idx % NODE_COLORS.length],
        x: cx + radius * Math.cos(angle) + (Math.random() - 0.5) * 20,
        y: cy + radius * Math.sin(angle) + (Math.random() - 0.5) * 20,
        vx: 0, vy: 0,
      });
      idx++;
    }

    const newEdges: GraphEdge[] = filteredRelationships.map((rel) => ({
      id: rel.id,
      source: rel.sourceCharacterId,
      target: rel.targetCharacterId,
      label: rel.customTypeName || REL_LABELS[rel.relationshipType] || rel.relationshipType,
      color: REL_COLORS[rel.relationshipType] || '#718096',
      relationship: rel,
    }));

    setNodes(newNodes);
    nodesRef.current = newNodes;
    setEdges(newEdges);
  }, [characters, filteredRelationships]);

  // Simple force-directed layout simulation
  useEffect(() => {
    let running = true;
    let iteration = 0;
    const maxIterations = 200;

    const simulate = () => {
      if (!running || iteration >= maxIterations) return;
      iteration++;

      const ns = nodesRef.current;
      if (ns.length === 0) return;

      const width = svgRef.current?.clientWidth ?? 800;
      const height = svgRef.current?.clientHeight ?? 600;
      const cx = width / 2;
      const cy = height / 2;

      // Reset forces
      for (const n of ns) { n.vx = 0; n.vy = 0; }

      // Repulsion between all nodes
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const dx = ns[j].x - ns[i].x;
          const dy = ns[j].y - ns[i].y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = 8000 / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          ns[i].vx -= fx; ns[i].vy -= fy;
          ns[j].vx += fx; ns[j].vy += fy;
        }
      }

      // Attraction along edges (spring force)
      const edgeMap = new Map<string, GraphNode>();
      for (const n of ns) edgeMap.set(n.id, n);
      for (const e of edges) {
        const s = edgeMap.get(e.source);
        const t = edgeMap.get(e.target);
        if (!s || !t) continue;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const idealDist = 180;
        const force = (dist - idealDist) * 0.05;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        s.vx += fx; s.vy += fy;
        t.vx -= fx; t.vy -= fy;
      }

      // Center gravity
      for (const n of ns) {
        n.vx += (cx - n.x) * 0.01;
        n.vy += (cy - n.y) * 0.01;
      }

      // Apply velocities with damping
      const damping = 0.8;
      for (const n of ns) {
        if (draggingNode === n.id) continue;
        n.x += n.vx * damping;
        n.y += n.vy * damping;
        n.x = Math.max(40, Math.min(width - 40, n.x));
        n.y = Math.max(40, Math.min(height - 40, n.y));
      }

      nodesRef.current = [...ns];
      setNodes([...ns]);

      if (iteration < maxIterations) {
        animRef.current = requestAnimationFrame(simulate);
      }
    };

    animRef.current = requestAnimationFrame(simulate);
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [edges, draggingNode]);

  // Zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform((t) => ({
      ...t,
      scale: Math.max(0.2, Math.min(3, t.scale * delta)),
    }));
  }, []);

  // Pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as SVGElement).tagName === 'svg' || (e.target as SVGElement).classList.contains('graph-bg')) {
      setIsPanning(true);
      panStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
    }
  }, [transform]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setTransform((t) => ({ ...t, x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y }));
    }
    if (draggingNode) {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = (e.clientX - rect.left - transform.x) / transform.scale;
      const y = (e.clientY - rect.top - transform.y) / transform.scale;
      nodesRef.current = nodesRef.current.map((n) => n.id === draggingNode ? { ...n, x, y } : n);
      setNodes([...nodesRef.current]);
    }
  }, [isPanning, draggingNode, transform]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggingNode(null);
  }, []);

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div style={s.wrapper}>
      <svg
        ref={svgRef}
        style={{ ...s.svg, cursor: isPanning ? 'grabbing' : 'grab' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <rect className="graph-bg" width="100%" height="100%" fill="transparent" />
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
          {/* Edges */}
          {edges.map((edge) => {
            const src = nodeMap.get(edge.source);
            const tgt = nodeMap.get(edge.target);
            if (!src || !tgt) return null;
            const dimmed = highlightCharacterId && highlightCharacterId !== edge.source && highlightCharacterId !== edge.target;
            const mx = (src.x + tgt.x) / 2;
            const my = (src.y + tgt.y) / 2;
            return (
              <g key={edge.id} opacity={dimmed ? 0.15 : 1} style={{ cursor: 'pointer' }}
                onClick={() => onSelectRelationship?.(edge.relationship)}>
                <line x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                  stroke={edge.color} strokeWidth={2} />
                <rect x={mx - 20} y={my - 10} width={40} height={20} rx={4}
                  fill="white" stroke={edge.color} strokeWidth={1} />
                <text x={mx} y={my + 4} textAnchor="middle" fontSize={10}
                  fill={edge.color} style={{ pointerEvents: 'none' }}>{edge.label}</text>
              </g>
            );
          })}
          {/* Nodes */}
          {nodes.map((node) => {
            const dimmed = highlightCharacterId && highlightCharacterId !== node.id
              && !edges.some((e) =>
                (e.source === highlightCharacterId && e.target === node.id) ||
                (e.target === highlightCharacterId && e.source === node.id)
              );
            return (
              <g key={node.id} opacity={dimmed ? 0.2 : 1} style={{ cursor: 'pointer' }}
                onMouseDown={(e) => { e.stopPropagation(); setDraggingNode(node.id); }}
                onClick={() => onSelectCharacter?.(node.id)}>
                <circle cx={node.x} cy={node.y} r={20} fill={node.color}
                  stroke={highlightCharacterId === node.id ? '#1A202C' : 'white'}
                  strokeWidth={highlightCharacterId === node.id ? 3 : 2} />
                <text x={node.x} y={node.y + 1} textAnchor="middle" dominantBaseline="middle"
                  fontSize={12} fill="white" fontWeight={600} style={{ pointerEvents: 'none' }}>
                  {node.initials}
                </text>
                <text x={node.x} y={node.y + 32} textAnchor="middle"
                  fontSize={11} fill="var(--color-text)" style={{ pointerEvents: 'none' }}>
                  {node.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
