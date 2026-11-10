import { Router, type IRouter } from "express";
import { GetZonesResponse } from "@workspace/api-zod";
import { getPublicZones } from "../../server/store";

const router: IRouter = Router();
router.get("/zones", async (_req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  res.json(GetZonesResponse.parse(await getPublicZones()));
});
export default router;
