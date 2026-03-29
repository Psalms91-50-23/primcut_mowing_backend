import express from "express";
import {
  viewPublicJob,
  create,
  revokeAll,
  validateJobAccessToken,
} from "../controllers/jobAccessTokenController.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/validate-token/uuid/:uuid", validateJobAccessToken);
router.post("/", requireAuth, create);
router.delete("/revoke/:job_uuid", requireAuth, revokeAll);
router.get("/uuid/:uuid", viewPublicJob);

export default router;