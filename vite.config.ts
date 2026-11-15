import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";
// @ts-expect-error type error without @types/node package
import process from "node:process";
import { createPreviewMailbox } from "./src/ui/previewMailbox.ts";
const host = process.env.TAURI_DEV_HOST;

function previewSync(): Plugin {
  const mailbox = createPreviewMailbox();
  return {
    name: "pomodoro-preview-sync",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        if (url.pathname !== "/__pomodoro/state" && url.pathname !== "/__pomodoro/action") {
          next();
          return;
        }
        const finish = (status: number, body?: string) => {
          res.statusCode = status;
          if (body === undefined) {
            res.end();
            return;
          }
          res.setHeader("content-type", "application/json");
          res.end(body);
        };
        if (req.method === "GET" && url.pathname === "/__pomodoro/state") {
          finish(200, mailbox.readState() ?? "null");
          return;
        }
        if (req.method === "GET") {
          const since = Number(url.searchParams.get("since") ?? "0");
          finish(200, JSON.stringify(mailbox.readActions(Number.isFinite(since) ? since : 0)));
          return;
        }
        if (req.method !== "POST") {
          next();
          return;
        }
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer | string) => {
          chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
        });
        req.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          if (url.pathname === "/__pomodoro/state") mailbox.putState(body);
          else mailbox.putAction(body);
          finish(204);
        });
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react(), previewSync()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "domain",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
        },
      },
    ],
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
