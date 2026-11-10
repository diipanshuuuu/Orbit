import express, { type Express, type ErrorRequestHandler } from "express";
import path from "node:path";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { seedIfEmpty } from "../server/seed";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0]?.replace(/\/cam\/[^/]+/, "/cam/[redacted]"),
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "3mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(async (req, _res, next) => {
  if (req.path === "/api/healthz") { next(); return; }
  // Accept only URL origins, never use a user-provided path in the seed link.
  const host = req.get("x-forwarded-host")?.split(",")[0]?.trim() || req.get("host");
  if (!host || !/^[a-zA-Z0-9.:[\]-]+$/.test(host)) { next(new Error("Invalid request host")); return; }
  const protocol = req.get("x-forwarded-proto") === "https" || req.secure ? "https" : "http";
  await seedIfEmpty(`${protocol}://${host}`);
  next();
});
app.use("/api", router);
app.use("/api", (_req, res) => { res.status(404).json({ error: "API route not found." }); });

// In production the same Express process serves the Vite build. No second server.
if (process.env.NODE_ENV === "production") {
  const publicDir = path.resolve(import.meta.dirname, "../public");
  app.use("/cam", (_req, res, next) => {
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use(express.static(publicDir, { index: false }));
  app.get("/{*splat}", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(publicDir, "index.html"));
  });
}
const handleError: ErrorRequestHandler = (error, req, res, _next) => {
  // Avoid logging request body or external API errors containing frame data.
  const status = error?.type === "entity.too.large" ? 413 : error?.type === "entity.parse.failed" ? 400 : 500;
  req.log.error({ status }, "Request failed");
  res.status(status).json({ error: status === 500 ? "Request could not be completed. Please retry." : "Invalid or oversized request." });
};
app.use(handleError);

export default app;
