"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CONFIDENCE_LABELS, RELATIONSHIP_LABELS } from "@/lib/constants";
import type { Confidence, RelationshipType } from "@/db/schema";

type Node = {
  id: string;
  fullName: string;
  sensitivity: string;
  reliability: number;
};
type Link = {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  confidence: Confidence;
};

export default function NetworkGraph({ nodes, links }: { nodes: Node[]; links: Link[] }) {
  const router = useRouter();
  const [onlyConfirmed, setOnlyConfirmed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const layout = useMemo(() => {
    const size = 900;
    const radius = size / 2 - 90;
    const map = new Map<string, { x: number; y: number }>();
    nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / Math.max(nodes.length, 1) - Math.PI / 2;
      map.set(node.id, {
        x: size / 2 + radius * Math.cos(angle),
        y: size / 2 + radius * Math.sin(angle),
      });
    });
    return { size, map };
  }, [nodes]);

  const visibleLinks = onlyConfirmed
    ? links.filter((l) => l.confidence === "confirmed")
    : links;

  if (nodes.length === 0) {
    return (
      <div className="alert alert-light border">
        لا توجد ملفات لعرض الشبكة. أضف ملفات ثم اربطها بعلاقات.
      </div>
    );
  }

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-body-tertiary d-flex flex-wrap gap-3 justify-content-between align-items-center">
        <span className="fw-semibold">
          <i className="bi bi-diagram-3 me-2" />
          الرسم البياني: {nodes.length} عقدة — {visibleLinks.length} علاقة
        </span>
        <div className="form-check form-switch">
          <input
            className="form-check-input"
            type="checkbox"
            id="only-confirmed"
            checked={onlyConfirmed}
            onChange={(e) => setOnlyConfirmed(e.target.checked)}
          />
          <label className="form-check-label small" htmlFor="only-confirmed">
            إظهار العلاقات المؤكّدة فقط
          </label>
        </div>
      </div>
      <div className="card-body">
        <svg
          viewBox={`0 0 ${layout.size} ${layout.size}`}
          style={{ width: "100%", height: "auto" }}
          role="img"
          aria-label="شبكة العلاقات"
        >
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <path d="M0,0 L0,6 L7,3 z" fill="var(--bs-secondary-color)" />
            </marker>
          </defs>

          {visibleLinks.map((link) => {
            const a = layout.map.get(link.source);
            const b = layout.map.get(link.target);
            if (!a || !b) return null;
            const dim = selected && selected !== link.source && selected !== link.target;
            return (
              <g key={link.id} opacity={dim ? 0.2 : 1}>
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  className={`graph-edge ${link.confidence}`}
                  markerEnd="url(#arrow)"
                />
                <title>
                  {`${RELATIONSHIP_LABELS[link.type]} — ${CONFIDENCE_LABELS[link.confidence]}`}
                </title>
              </g>
            );
          })}

          {nodes.map((node) => {
            const pos = layout.map.get(node.id);
            if (!pos) return null;
            const degree = links.filter(
              (l) => l.source === node.id || l.target === node.id,
            ).length;
            const r = 14 + Math.min(degree * 2, 12);
            const dim = selected && selected !== node.id;
            return (
              <g
                key={node.id}
                className={`graph-node ${node.sensitivity === "top_secret" ? "top_secret" : ""}`}
                opacity={dim ? 0.35 : 1}
                onClick={() => router.push(`/persons/${node.id}`)}
                onMouseEnter={() => setSelected(node.id)}
                onMouseLeave={() => setSelected(null)}
              >
                <circle cx={pos.x} cy={pos.y} r={r} />
                <text x={pos.x} y={pos.y + r + 14}>
                  {node.fullName.length > 18 ? `${node.fullName.slice(0, 17)}…` : node.fullName}
                </text>
                <title>{`${node.fullName} — ${degree} علاقة — موثوقية ${node.reliability}/5`}</title>
              </g>
            );
          })}
        </svg>

        <div className="d-flex flex-wrap gap-3 small text-body-secondary mt-2">
          <span>
            <span className="d-inline-block me-1" style={{ width: 24, borderTop: "3px solid" }} />
            خط متصل = علاقة مؤكّدة
          </span>
          <span>
            <span
              className="d-inline-block me-1"
              style={{ width: 24, borderTop: "3px dashed" }}
            />
            خط متقطّع = علاقة مشتبه بها
          </span>
          <span>
            <span
              className="d-inline-block me-1 rounded-circle"
              style={{ width: 12, height: 12, background: "#b22234" }}
            />
            عقدة «سري للغاية»
          </span>
          <span>حجم العقدة يعكس عدد العلاقات.</span>
        </div>
      </div>
    </div>
  );
}
