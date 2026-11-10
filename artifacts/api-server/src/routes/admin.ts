import { Router, type IRouter } from "express";
import { GetAdminDashboardResponse, GetAdminTractionResponse, CreateAdminZoneResponse, UpdateAdminZoneResponse, CreateAdminCameraResponse, GetAdminCameraFrameResponse } from "@workspace/api-zod";
import { z } from "zod";
import { requireAdmin } from "../../server/admin-auth";
import { adminZoneInput } from "../../server/admin-validation";
import { adminDashboard, createCamera, latestAdminFrame, saveAdminZone } from "../../server/admin-store";
import { getAdminTraction } from "../../server/usage-store";

const router: IRouter = Router();
router.use("/admin", requireAdmin);
const idSchema = z.coerce.number().int().positive();
router.get("/admin", async (_req, res): Promise<void> => {
  res.json(GetAdminDashboardResponse.parse(await adminDashboard()));
});
router.get("/admin/traction", async (_req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  res.json(GetAdminTractionResponse.parse(await getAdminTraction()));
});
router.post("/admin/zones", async (req, res): Promise<void> => {
  const parsed = adminZoneInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid zone." }); return; }
  res.status(201).json(CreateAdminZoneResponse.parse(await saveAdminZone(parsed.data)));
});
router.put("/admin/zones/:id", async (req, res): Promise<void> => {
  const id = idSchema.safeParse(req.params.id);
  const parsed = adminZoneInput.safeParse(req.body);
  if (!id.success || !parsed.success) { res.status(400).json({ error: !parsed.success ? parsed.error.issues[0]?.message : "Invalid zone ID." }); return; }
  const saved = await saveAdminZone(parsed.data, id.data);
  if (!saved) { res.status(404).json({ error: "Zone not found." }); return; }
  res.json(UpdateAdminZoneResponse.parse(saved));
});
router.post("/admin/zones/:id/cameras", async (req, res): Promise<void> => {
  const id = idSchema.safeParse(req.params.id);
  if (!id.success) { res.status(400).json({ error: "Invalid zone ID." }); return; }
  const camera = await createCamera(id.data);
  if (!camera) { res.status(404).json({ error: "Zone not found." }); return; }
  res.status(201).json(CreateAdminCameraResponse.parse(camera));
});
router.get("/admin/cameras/:id/frame", async (req, res): Promise<void> => {
  const id = idSchema.safeParse(req.params.id);
  if (!id.success) { res.status(400).json({ error: "Invalid camera ID." }); return; }
  const frame = await latestAdminFrame(id.data);
  if (!frame) { res.status(404).json({ error: "Camera not found." }); return; }
  res.json(GetAdminCameraFrameResponse.parse(frame));
});
export default router;
