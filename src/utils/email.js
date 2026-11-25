import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE =
  String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || "";

const isMailerConfigured = () =>
  Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS && SMTP_FROM);

let transporter = null;

const getTransporter = () => {
  if (!isMailerConfigured()) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }

  return transporter;
};

export const sendEmail = async ({ to, bcc, subject, text, html }) => {
  const t = getTransporter();
  if (!t || !to) {
    return {
      sent: false,
      reason: "mailer_not_configured_or_recipient_missing",
    };
  }

  await t.sendMail({
    from: SMTP_FROM,
    to,
    bcc,
    subject,
    text,
    html,
  });

  return { sent: true };
};

export default sendEmail;
