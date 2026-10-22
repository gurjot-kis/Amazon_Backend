import User from "../models/user.model.js";
import { sendEmail } from "../utils/email.js";

const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

const formatOrderStatusEmail = ({ customerName, order, status }) => {
  const name = customerName || "Customer";
  const orderId = String(order._id);
  const totalItems = Number(order.totalItems || 0);
  const grandTotal = Number(order.grandTotal || 0);
  const paymentMethod = order.paymentMethod || "COD";
  const paymentReceived =
    Number(order.paymentReceived || 0) === 1 ? "Yes" : "No";

  const subject = `Order ${orderId} is now ${status}`;
  const text = [
    `Hello ${name},`,
    "",
    `Your order status has been updated to: ${status}`,
    `Order ID: ${orderId}`,
    `Items: ${totalItems}`,
    `Grand Total: ${grandTotal}`,
    `Payment Method: ${paymentMethod}`,
    `Payment Received: ${paymentReceived}`,
    "",
    "Thank you for shopping with us.",
  ].join("\n");

  const html = `
    <p>Hello ${escapeHtml(name)},</p>
    <p>Your order status has been updated.</p>
    <p><strong>Status:</strong> ${escapeHtml(status)}</p>
    <p><strong>Order ID:</strong> ${escapeHtml(orderId)}</p>
    <p><strong>Items:</strong> ${totalItems}</p>
    <p><strong>Grand Total:</strong> ${grandTotal}</p>
    <p><strong>Payment Method:</strong> ${escapeHtml(paymentMethod)}</p>
    <p><strong>Payment Received:</strong> ${paymentReceived}</p>
    <p>Thank you for shopping with us.</p>
  `;

  return { subject, text, html };
};

export const notifyStatusChange = async (order, status) => {
  try {
    const customer = await User.findById(order.user_id)
      .select("name email")
      .lean()
      .exec();
    if (!customer?.email) return;
    const { subject, text, html } = formatOrderStatusEmail({
      customerName: customer.name,
      order,
      status,
    });
    await sendEmail({ to: customer.email, subject, text, html });
  } catch (err) {
    console.error("[order] status email failed:", err?.message);
  }
};
