import { Router, type IRouter } from "express";
import { LogUsageEventResponse } from "@workspace/api-zod";
import { usageEventInput } from "../../server/usage-validation";
import { saveUsageEvent } from "../../server/usage-store";

const router: IRouter = Router();
router.post("/events", async (req, res): Promise<void> => {
  const parsed = usageEventInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid usage event." });
    return;
  }
  const saved = await saveUsageEvent(parsed.data);
  res.setHeader("Cache-Control", "no-store");
  res.status(201).json(LogUsageEventResponse.parse(saved));
});
export default router;
