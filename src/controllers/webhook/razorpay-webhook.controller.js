import RazorpayService from "../../services/razorpay.service.js";
import { PaymentService } from "../../services/payment.service.js";

export const RazorpayWebhookController = {
  handle: async (req, res) => {
    try {
      const rawBody = req.body;

      // If this is not a Buffer, express.json() ran before this route
      // and the signature can never match.
      if (!Buffer.isBuffer(rawBody)) {
        console.error("[razorpay-webhook] raw body missing: check route order");
        return res.status(400).json({ success: false });
      }

      const signature = req.get("X-Razorpay-Signature");
      const valid = RazorpayService.verifyWebhookSignature({
        rawBody,
        signature,
      });
      if (!valid) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid signature" });
      }

      const event = JSON.parse(rawBody.toString("utf8"));
      const eventId = req.get("X-Razorpay-Event-Id");
      console.log("[razorpay-webhook]", event.event, eventId);

      const rzpPayment = event.payload?.payment?.entity;
      let result = "ignored";

      if (rzpPayment) {
        if (event.event === "payment.captured") {
          result = await PaymentService.handleRazorpayCaptured({
            rzpPayment,
            eventId,
          });
        } else if (event.event === "payment.failed") {
          result = await PaymentService.handleRazorpayFailed({ rzpPayment });
        }
      }
      console.log("[razorpay-webhook] result:", result);

      return res.status(200).json({ received: true });
    } catch (err) {
      console.error("[razorpay-webhook]", err?.message);
      return res.status(500).json({ success: false });
    }
  },
};

export default RazorpayWebhookController;
