import type { Quality } from "./quality";

type V = { id: string; body: string; kind: string; count_type: string | null; actual_count: number | null; counter_policy: string; revision_round: number; scores: { quality?: Quality } | null; created_at: string };

/** ASCII-only, no path or header characters: safe inside Content-Disposition. */
export function safeFilename(name: string, ext: string): string {
  const base = name.normalize("NFKD").replace(/[^\x20-\x7e]/g, "").replace(/[^A-Za-z0-9 _-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "script";
  return `${base}.${ext}`;
}

export function buildExport(projectName: string, v: V, format: "txt" | "md" | "json"): { body: string; type: string; filename: string } {
  const q = v.scores?.quality;
  if (format === "txt") return { body: v.body + "\n", type: "text/plain; charset=utf-8", filename: safeFilename(projectName, "txt") };
  if (format === "json") {
    return { body: JSON.stringify({ project: projectName, versionId: v.id, kind: v.kind, createdAt: v.created_at, length: { type: v.count_type, count: v.actual_count, policy: v.counter_policy }, revisionRound: v.revision_round, quality: q ?? null, script: v.body }, null, 2), type: "application/json; charset=utf-8", filename: safeFilename(projectName, "json") };
  }
  const lines = [`# ${projectName.replace(/[\r\n]+/g, " ")}`, "", `*${v.kind}${v.revision_round ? ` (revision ${v.revision_round})` : ""} · ${v.actual_count ?? "?"} ${v.count_type ?? "words"} · ${v.counter_policy}*`, "", "## Script", "", v.body, ""];
  if (q) {
    lines.push("## Quality", "", `**${q.total}/100** (pass target ${q.target})`, "", ...q.dimensions.map((d) => `- **${d.label}** ${d.score}/10 — ${d.reason}`), "", `_${q.disclaimer}_`, "");
  }
  return { body: lines.join("\n"), type: "text/markdown; charset=utf-8", filename: safeFilename(projectName, "md") };
}
