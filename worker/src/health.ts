import http from "node:http";

export type Checks = Record<string, () => Promise<boolean> | boolean>;

/** Liveness (/healthz) says the process is up. Readiness (/readyz) says dependencies work. Neither exposes secrets or job data. */
export function createHealthServer(checks: Checks, port: number, host = "127.0.0.1") {
  const server = http.createServer(async (req, res) => {
    const send = (code: number, body: unknown) => { res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(body)); };
    if (req.method !== "GET") return send(405, { error: "method not allowed" });
    if (req.url === "/healthz") return send(200, { status: "ok" });
    if (req.url === "/readyz") {
      const results: Record<string, boolean> = {};
      await Promise.all(Object.entries(checks).map(async ([name, fn]) => {
        try { results[name] = !!(await Promise.race([fn(), new Promise<boolean>((r) => setTimeout(() => r(false), 2000))])); } catch { results[name] = false; }
      }));
      const ready = Object.values(results).every(Boolean);
      return send(ready ? 200 : 503, { status: ready ? "ready" : "not_ready", checks: results });
    }
    return send(404, { error: "not found" });
  });
  return {
    listen: () => new Promise<number>((resolve) => server.listen(port, host, () => resolve((server.address() as { port: number }).port))),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
