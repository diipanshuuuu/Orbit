import { Router, type IRouter } from "express";
import healthRouter from "./health";
import zonesRouter from "./zones";
import ingestRouter from "./ingest";
import adminRouter from "./admin";
import feedbackRouter from "./feedback";

const router: IRouter = Router();

router.use(healthRouter);
router.use(zonesRouter);
router.use(ingestRouter);
router.use(adminRouter);
router.use(feedbackRouter);

export default router;
