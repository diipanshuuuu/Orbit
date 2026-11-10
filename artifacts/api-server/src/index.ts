import app from "./app";
import { logger } from "./lib/logger";
import { seedIfEmpty } from "../server/seed";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// In development the public origin is known at startup. Production initializes
// on its first request so the logged URL uses its actual browser-facing origin.
if (process.env.NODE_ENV !== "production" && process.env.REPLIT_DEV_DOMAIN) {
  await seedIfEmpty(`https://${process.env.REPLIT_DEV_DOMAIN}`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
