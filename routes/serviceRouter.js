import express from "express";
import {
  getAllServices,
  getServiceByUUID,
} from "../controllers/serviceController.js";

const router = express.Router();

router.get("/", getAllServices);
router.get("/:uuid", getServiceByUUID);

export default router;