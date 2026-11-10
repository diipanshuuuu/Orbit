import { Router, type IRouter } from "express";
import { IngestFrameBody, IngestFrameResponse } from "@workspace/api-zod";
import { ingest } from "../../server/store";

const router: IRouter = Router();
router.post("/ingest", async (req, res): Promise<void> => {
  const parsed = IngestFrameBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Expected token, base64 JPEG image and changed boolean." });
    return;
  }
  const { image } = parsed.data;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(image) || image.length % 4 !== 0) {
    res.status(400).json({ error: "Invalid base64 JPEG." });
    return;
  }
  const bytes = Buffer.from(image, "base64");
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) {
    res.status(400).json({ error: "Image must be a JPEG." });
    return;
  }
  const result = await ingest(parsed.data);
  if (!result) {
    res.status(401).json({ error: "Invalid camera token." });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.json(IngestFrameResponse.parse(result));
});
export default router;
