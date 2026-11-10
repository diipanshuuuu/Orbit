import { createHash, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

export function validAdminPasscode(header: string | undefined, configured: string | undefined): boolean {
  if (!configured || !header?.startsWith("Bearer ")) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(header.slice(7)), digest(configured));
}

export const requireAdmin: RequestHandler = (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (!process.env.ADMIN_PASSCODE) {
    res.status(503).json({ error: "Admin is not configured. Set ADMIN_PASSCODE in Secrets." });
    return;
  }
  if (!validAdminPasscode(req.get("authorization"), process.env.ADMIN_PASSCODE)) {
    res.status(401).json({ error: "Incorrect admin passcode." });
    return;
  }
  next();
};
