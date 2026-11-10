import { Router, type IRouter } from "express";
import { SubmitFeedbackBody, SubmitFeedbackResponse } from "@workspace/api-zod";
import { saveFeedback } from "../../server/feedback-store";

const router: IRouter = Router();
router.post("/feedback", async (req, res): Promise<void> => {
  const parsed = SubmitFeedbackBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid feedback." });
    return;
  }
  const saved = await saveFeedback(parsed.data);
  if (saved === null) {
    res.status(404).json({ error: "Zone not found." });
    return;
  }
  if (saved === "unit-not-found") {
    res.status(400).json({ error: "Unit does not belong to this zone." });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.status(201).json(SubmitFeedbackResponse.parse(saved));
});
export default router;
