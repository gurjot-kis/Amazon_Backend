import crypto from "crypto";
import Razorpay from "razorpay";
import { AppError } from "../utils/AppError.js";

let client = null;
const getClient = () => {
  if (client) return client;

  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    throw new AppError(500, "Online payments are not configured");
  }

  client = new Razorpay({ key_id, key_secret });
  return client;
};

//Helpers
const toMinorUnit = (amount) => Math.round(Number(amount) * 100);
const fromMinorUnit = (amount) => Number(amount) / 100;

const safeEqualHex = (a, b) => {
  const bufA = Buffer.from(String(a ?? ""), "utf8");
  const bufB = Buffer.from(String(b ?? ""), "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

const hmacSha256 = (secret, payload) =>
  crypto.createHmac("sha256", secret).update(payload).digest("hex");

const wrapGatewayError = (err, fallbackMessage) => {
  if (err instanceof AppError) return err;

  const status = Number(err?.statusCode);
  const description = err?.error?.description;
  console.error("[razorpay]", {
    status: err?.statusCode,
    code: err?.error?.code,
    description,
  });

  // 400-level from Razorpay usually means our request was bad (or the
  // resource doesn't exist). Everything else is treated as gateway trouble.
  if (status === 404)
    return new AppError(404, "Payment record not found at gateway");
  if (status >= 400 && status < 500) {
    return new AppError(502, description || fallbackMessage);
  }
  return new AppError(502, fallbackMessage);
};

const call = async (fallbackMessage, fn) => {
  try {
    return await fn(getClient());
  } catch (err) {
    throw wrapGatewayError(err, fallbackMessage);
  }
};

export const RazorpayService = {
  toMinorUnit,
  fromMinorUnit,

  getKeyId: () => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    if (!keyId) throw new AppError(500, "Online payments are not configured");
    return keyId;
  },

  createOrder: ({ amount, currency, receipt, notes = {} }) =>
    call("Unable to create payment order", (rzp) =>
      rzp.orders.create({
        amount: toMinorUnit(amount),
        currency,
        receipt: String(receipt).slice(0, 40),
        notes,
      }),
    ),

  fetchOrder: (razorpayOrderId) =>
    call("Unable to fetch payment order", (rzp) =>
      rzp.orders.fetch(razorpayOrderId),
    ),

  fetchOrderPayments: async (razorpayOrderId) => {
    const res = await call("Unable to fetch payment attempts", (rzp) =>
      rzp.orders.fetchPayments(razorpayOrderId),
    );
    return res?.items || [];
  },

  fetchPayment: (razorpayPaymentId) =>
    call("Unable to fetch payment", (rzp) =>
      rzp.payments.fetch(razorpayPaymentId),
    ),

  capturePayment: ({ paymentId, amount, currency }) =>
    call("Unable to capture payment", (rzp) =>
      rzp.payments.capture(paymentId, toMinorUnit(amount), currency),
    ),

  refundPayment: ({
    paymentId,
    amount,
    speed = "normal",
    notes = {},
    receipt,
  }) =>
    call("Unable to initiate refund", (rzp) => {
      const body = { speed, notes };
      if (amount != null) body.amount = toMinorUnit(amount);
      if (receipt) body.receipt = String(receipt).slice(0, 40);
      return rzp.payments.refund(paymentId, body);
    }),

  verifyCheckoutSignature: ({ orderId, paymentId, signature }) => {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) throw new AppError(500, "Online payments are not configured");
    if (!orderId || !paymentId || !signature) return false;

    const expected = hmacSha256(secret, `${orderId}|${paymentId}`);
    return safeEqualHex(expected, signature);
  },

  verifyWebhookSignature: ({ rawBody, signature }) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) throw new AppError(500, "Webhook secret is not configured");
    if (!rawBody || !signature) return false;

    const expected = hmacSha256(secret, rawBody);
    return safeEqualHex(expected, signature);
  },
};

export default RazorpayService;
