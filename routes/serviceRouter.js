import express from "express";
import {
  getAllServices,
  getServiceByUUID,
  getAllServiceCategories
} from "../controllers/serviceController.js";

const router = express.Router();

router.get("/", getAllServices);
router.get("/categories", getAllServiceCategories);
router.get("/:uuid", getServiceByUUID);

export default router;