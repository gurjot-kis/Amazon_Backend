import express from "express";
import RazorpayWebhookController from "../controllers/webhook/razorpay-webhook.controller.js";

const router = express.Router();

router.post(
  "/razorpay",
  express.raw({ type: "application/json" }),
  RazorpayWebhookController.handle,
);

export default router;
