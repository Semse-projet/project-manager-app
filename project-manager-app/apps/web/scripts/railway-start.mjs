import http from "node:http";
import { spawn } from "node:child_process";

const targetPort = Number(process.env.SEMSE_WEB_TARGET_PORT ?? 3000);
const railwayPort = Number(process.env.PORT ?? targetPort);
const host = process.env.HOSTNAME ?? "0.0.0.0";

const childEnv = {
  ...process.env,
  HOSTNAME: host,
  PORT: String(targetPort),
};

const nextServer = spawn(process.execPath, ["apps/web/server.js"], {
  env: childEnv,
  stdio: "inherit",
});

nextServer.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

function stop(signal) {
  nextServer.kill(signal);
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

if (railwayPort !== targetPort) {
  const proxy = http.createServer((req, res) => {
    const proxyReq = http.request(
      {
        hostname: "127.0.0.1",
        port: targetPort,
        path: req.url,
        method: req.method,
        headers: req.headers,
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );

    proxyReq.on("error", () => {
      res.writeHead(503, { "content-type": "application/json" });
      res.end(JSON.stringify({ data: { status: "starting", service: "semse-web" } }));
    });

    req.pipe(proxyReq);
  });

  proxy.listen(railwayPort, host, () => {
    console.log(`railway health proxy listening on ${railwayPort}, forwarding to ${targetPort}`);
  });
}
