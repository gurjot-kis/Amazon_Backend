import express from "express";
import { BannerController } from "../../controllers/mobile/index.js";

const router = express.Router();

router.get("/home-banner", BannerController.getBannerImg);

export default router;
