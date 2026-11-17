import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/user.model.js";
import { sendEmail } from "../utils/email.js";
import { sendTwilioSms } from "../utils/twilio-sms.js";
import { assertUserCanLogin, mapUserStatus } from "../utils/user-status.js";
import EmailVerification from "../models/email-verification.model.js";

const OTP_TTL_MS = 10 * 60 * 1000; // OTP valid for 10 min
const VERIFIED_TTL_MS = 30 * 60 * 1000; // after verifying, user has 30 min to finish signup
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

const signAuthToken = (user) => {
  const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
  const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "365d";
  // Payload matches the keys you showed: `user_id`, `email`.
  return jwt.sign(
    {
      _id: user._id.toString(),
      user_id: user.user_id,
      email: user.email,
      role: user.role || "User",
    },
    JWT_SECRET,
    { algorithm: "HS256", expiresIn: JWT_EXPIRES_IN },
  );
};

const digitsOnly = (v) => String(v || "").replace(/\D/g, "");

const findUserByPhone = async (rawPhone) => {
  const d = digitsOnly(rawPhone);
  if (!d) return null;
  const last10 = d.length >= 10 ? d.slice(-10) : d;
  return User.findOne({
    $or: [
      { phone: String(rawPhone).trim() },
      { phone: d },
      { phone: last10 },
      { phone: `+91${last10}` },
      { phone: `91${last10}` },
    ],
  }).exec();
};

const phoneToE164 = (rawPhone, rawCountryCode) => {
  const d = digitsOnly(rawPhone);
  const cc = String(
    rawCountryCode || process.env.TWILIO_DEFAULT_COUNTRY_CODE || "91",
  ).replace(/\D/g, "");

  if (!d) return "";
  if (
    String(rawPhone || "")
      .trim()
      .startsWith("+")
  ) {
    return `+${d}`;
  }
  if (d.length === 10) return `+${cc}${d}`;
  return `+${d}`;
};

const buildAuthResponseData = (user, token) => {
  return {
    _id: user._id.toString(),
    user_id: user.user_id,
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    countryCode: user.countryCode || "+91",
    role: user.role || "User",
    status: mapUserStatus(user.status),
    profilePicture: user.profilePicture || "",
    token,
    store_id: user?.active_store_id ? String(user.active_store_id) : "",
  };
};

const sendLoginTwilioOtpToUser = async (user, phone, countryCode) => {
  assertUserCanLogin(user);

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

  user.loginTwilioOtp = otp;
  user.loginTwilioOtpExpiry = otpExpiry;
  await user.save();

  const to = phoneToE164(phone, countryCode || user.countryCode);
  try {
    const result = await sendTwilioSms(
      to,
      `Your login OTP is ${otp}. It is valid for 10 minutes. Do not share this code.`,
    );

    if (!result.sent) {
      user.loginTwilioOtp = null;
      user.loginTwilioOtpExpiry = null;
      await user.save();
      throw new Error("SMS could not be sent. Check Twilio configuration.");
    }
  } catch (e) {
    user.loginTwilioOtp = null;
    user.loginTwilioOtpExpiry = null;
    await user.save();
    if (e?.message === "SMS could not be sent. Check Twilio configuration.")
      throw e;
    throw new Error(e?.message || "Failed to send SMS");
  }

  return { phone: to };
};

const findOrCreateUserByPhone = async (rawPhone, rawCountryCode) => {
  let user = await findUserByPhone(rawPhone);
  if (user) {
    if (rawCountryCode && !user.countryCode) {
      user.countryCode = String(rawCountryCode).trim();
      await user.save();
    }
    return { user, is_new_user: false };
  }

  const cleanCountryCode = rawCountryCode
    ? String(rawCountryCode).trim()
    : "+91";
  const e164 = phoneToE164(rawPhone, cleanCountryCode);
  const digits = digitsOnly(rawPhone);
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
  let email = `phone_${last10 || digits}@otp.local`;

  const emailTaken = await User.findOne({ email }).exec();
  if (emailTaken) {
    email = `phone_${last10 || digits}_${crypto.randomBytes(4).toString("hex")}@otp.local`;
  }

  user = await User.create({
    name: "User",
    email,
    phone: e164,
    countryCode: cleanCountryCode,
    role: "User",
    passwordHash: "",
  });

  return { user, is_new_user: true };
};

const verifyLoginTwilioOtp = async (user, otp) => {
  if (!user.loginTwilioOtp || !user.loginTwilioOtpExpiry) {
    throw new Error("OTP not requested or already used");
  }
  if (new Date() > user.loginTwilioOtpExpiry) {
    throw new Error("OTP has expired");
  }
  if (user.loginTwilioOtp !== String(otp).trim()) {
    throw new Error("Invalid OTP");
  }

  assertUserCanLogin(user);

  user.loginTwilioOtp = null;
  user.loginTwilioOtpExpiry = null;
  await user.save();

  const token = signAuthToken(user);
  return buildAuthResponseData(user, token);
};

const hashOtp = (email, otp) =>
  crypto
    .createHmac("sha256", process.env.JWT_SECRET || "dev-secret")
    .update(`${email}:${otp}`)
    .digest("hex");

const generateOtp = () => String(crypto.randomInt(100000, 1000000));

export const AuthService = {
  signup: async ({
    email,
    password,
    fullName,
    phone,
    countryCode,
    address,
  }) => {
    if (!email || !password || !fullName) {
      throw new Error("Email, password, and fullName are required");
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedFullName = String(fullName).trim();

    const existingUser = await User.findOne({ email: normalizedEmail }).exec();
    if (existingUser) {
      throw new Error("User already exists");
    }

    const verification = await EmailVerification.findOne({
      email: normalizedEmail,
      verified: true,
    }).exec();
    if (!verification) throw new Error("Email not verified");

    const passwordHash = await bcrypt.hash(String(password), 10);

    const user = await User.create({
      email: normalizedEmail,
      name: normalizedFullName,
      phone: phone ? String(phone) : "",
      countryCode: countryCode ? String(countryCode).trim() : "+91",
      address: address ? String(address) : "",
      role: "User",
      passwordHash,
    });

    await EmailVerification.deleteOne({ _id: verification._id });

    const token = signAuthToken(user);
    return buildAuthResponseData(user, token);
  },

  sendSignupOtp: async ({ email }) => {
    if (!email) throw new Error("Email is required");
    const normalizedEmail = String(email).trim().toLocaleLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail }).exec();
    if (existingUser) throw new Error("User already exists");

    const existing = await EmailVerification.findOne({
      email: normalizedEmail,
    }).exec();
    if (
      existing?.lastSentAt &&
      Date.now() - existing.lastSentAt.getTime() < RESEND_COOLDOWN_MS
    ) {
      throw new Error("Please wait before requesting another otp");
    }

    const otp = generateOtp();
    const now = Date.now();

    await EmailVerification.findOneAndUpdate(
      { email: normalizedEmail },
      {
        email: normalizedEmail,
        otpHash: hashOtp(normalizedEmail, otp),
        otpExpiry: new Date(now + OTP_TTL_MS),
        attempts: 0,
        verified: false,
        lastSentAt: new Date(now),
        expiresAt: new Date(now + OTP_TTL_MS),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    try {
      await sendEmail({
        to: normalizedEmail,
        subject: "Verify your email",
        text: `Your verification OTP is: ${otp}\n\nValid for 10 minutes. Do not share it with anyone.`,
        html: `<p>Your verification OTP is:</p><h2>${otp}</h2><p>Valid for <strong>10 minutes</strong>. Do not share it with anyone.</p>`,
      });
    } catch (e) {
      await EmailVerification.deleteOne({ email: normalizedEmail });
      throw new Error("Failed to send verification email");
    }

    return { email: normalizedEmail };
  },

  verifySignupOtp: async ({ email, otp }) => {
    if (!email || !otp) throw new Error("Email and OTP are required");
    const normalizedEmail = String(email).trim().toLocaleLowerCase();

    const record = await EmailVerification.findOne({
      email: normalizedEmail,
    }).exec();
    if (!record || !record.otpHash)
      throw new Error("OTP not requested or already used");
    if (new Date() > record.otpExpiry) throw new Error("OTP has expired");
    if (record.attempts >= MAX_ATTEMPTS) {
      throw new Error("Too many attempts. Please request a new OTP");
    }

    const expected = Buffer.from(record.otpHash, "hex");
    const actual = Buffer.from(
      hashOtp(normalizedEmail, String(otp).trim()),
      "hex",
    );
    const ok =
      expected.length === actual.length &&
      crypto.timingSafeEqual(expected, actual);

    if (!ok) {
      record.attempts += 1;
      await record.save();
      throw new Error("Invalid OTP");
    }

    record.verified = true;
    record.otpHash = null;
    record.otpExpiry = null;
    record.expiresAt = new Date(Date.now() + VERIFIED_TTL_MS);
    await record.save();

    return { email: normalizedEmail, verified: true };
  },

  changePassword: async ({ user_id, newPassword, confirmnewPassword }) => {
    if (!user_id) {
      throw new Error("user_id is required");
    }
    if (!newPassword || !confirmnewPassword) {
      throw new Error("newPassword and confirmnewPassword are required");
    }
    if (String(newPassword).trim() !== String(confirmnewPassword).trim()) {
      throw new Error("Passwords do not match");
    }
    if (String(newPassword).trim().length < 6) {
      throw new Error("New password must be at least 6 characters");
    }

    const user = await User.findOne({ user_id: String(user_id).trim() }).exec();
    if (!user) {
      throw new Error("User not found");
    }

    user.passwordHash = await bcrypt.hash(String(newPassword).trim(), 10);
    await user.save();

    return {
      user_id: user.user_id,
      email: user.email,
    };
  },

  forgotPassword: async ({ email }) => {
    if (!email) throw new Error("Email is required");

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).exec();
    if (!user) throw new Error("No account found with this email");

    // Generate a 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.resetOtp = otp;
    user.resetOtpExpiry = otpExpiry;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    await sendEmail({
      to: normalizedEmail,
      subject: "Your Password Reset OTP",
      text: `Your OTP for password reset is: ${otp}\n\nThis OTP is valid for 10 minutes. Do not share it with anyone.`,
      html: `<p>Your OTP for password reset is:</p><h2>${otp}</h2><p>This OTP is valid for <strong>10 minutes</strong>. Do not share it with anyone.</p>`,
    });

    return { email: normalizedEmail };
  },

  verifyOtp: async ({ email, otp }) => {
    if (!email || !otp) throw new Error("Email and OTP are required");

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).exec();
    if (!user) throw new Error("No account found with this email");

    if (!user.resetOtp || !user.resetOtpExpiry) {
      throw new Error("OTP not requested or already used");
    }
    if (new Date() > user.resetOtpExpiry) {
      throw new Error("OTP has expired");
    }
    if (user.resetOtp !== String(otp).trim()) {
      throw new Error("Invalid OTP");
    }

    // OTP is valid — issue a short-lived reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    user.resetOtp = null;
    user.resetOtpExpiry = null;
    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save();

    return { resetToken };
  },

  resetPassword: async ({ resetToken, newPassword, confirmPassword }) => {
    if (!resetToken) throw new Error("Reset token is required");
    if (!newPassword || !confirmPassword) {
      throw new Error("newPassword and confirmPassword are required");
    }
    if (String(newPassword).trim() !== String(confirmPassword).trim()) {
      throw new Error("Passwords do not match");
    }
    if (String(newPassword).trim().length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

    const user = await User.findOne({
      resetToken: String(resetToken).trim(),
    }).exec();
    if (!user) throw new Error("Invalid or expired reset token");
    if (!user.resetTokenExpiry || new Date() > user.resetTokenExpiry) {
      throw new Error("Invalid or expired reset token");
    }

    user.passwordHash = await bcrypt.hash(String(newPassword).trim(), 10);
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    return { email: user.email };
  },

  login: async ({ email, password }) => {
    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).exec();

    if (!user) {
      throw new Error("Invalid credentials");
    }

    const isMatch = await bcrypt.compare(String(password), user.passwordHash);
    if (!isMatch) {
      throw new Error("Invalid credentials");
    }

    assertUserCanLogin(user);

    const token = signAuthToken(user);
    return buildAuthResponseData(user, token);
  },

  loginTwilio: async ({ phone, password }) => {
    if (!phone || !password) {
      throw new Error("phone and password are required");
    }

    const user = await findUserByPhone(phone);
    if (!user || !user.passwordHash) {
      throw new Error("Invalid credentials");
    }

    const isMatch = await bcrypt.compare(String(password), user.passwordHash);
    if (!isMatch) {
      throw new Error("Invalid credentials");
    }

    assertUserCanLogin(user);

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    user.loginTwilioOtp = otp;
    user.loginTwilioOtpExpiry = otpExpiry;
    await user.save();

    const to = phoneToE164(phone);
    try {
      const result = await sendTwilioSms(
        to,
        `Your login OTP is ${otp}. It is valid for 10 minutes. Do not share this code.`,
      );

      if (!result.sent) {
        user.loginTwilioOtp = null;
        user.loginTwilioOtpExpiry = null;
        await user.save();
        throw new Error("SMS could not be sent. Check Twilio configuration.");
      }
    } catch (e) {
      user.loginTwilioOtp = null;
      user.loginTwilioOtpExpiry = null;
      await user.save();
      if (e?.message === "SMS could not be sent. Check Twilio configuration.")
        throw e;
      throw new Error(e?.message || "Failed to send SMS");
    }

    return { phone: phoneToE164(phone) };
  },

  loginTwilioVerify: async ({ phone, password, otp }) => {
    if (!phone || !password || !otp) {
      throw new Error("phone, password, and otp are required");
    }

    const user = await findUserByPhone(phone);
    if (!user || !user.passwordHash) {
      throw new Error("Invalid credentials");
    }

    const isMatch = await bcrypt.compare(String(password), user.passwordHash);
    if (!isMatch) {
      throw new Error("Invalid credentials");
    }

    if (!user.loginTwilioOtp || !user.loginTwilioOtpExpiry) {
      throw new Error("OTP not requested or already used");
    }
    if (new Date() > user.loginTwilioOtpExpiry) {
      throw new Error("OTP has expired");
    }
    if (user.loginTwilioOtp !== String(otp).trim()) {
      throw new Error("Invalid OTP");
    }

    assertUserCanLogin(user);

    user.loginTwilioOtp = null;
    user.loginTwilioOtpExpiry = null;
    await user.save();

    const token = signAuthToken(user);
    return buildAuthResponseData(user, token);
  },

  loginTwilioOtp: async ({ phone, countryCode }) => {
    if (!phone || !String(phone).trim()) {
      throw new Error("phone is required");
    }

    const { user, is_new_user } = await findOrCreateUserByPhone(
      phone,
      countryCode,
    );

    if (!is_new_user && countryCode) {
      const providedCc = String(countryCode).trim();
      const userCc = String(user.countryCode || "").trim();

      if (userCc && userCc !== providedCc) {
        throw new Error("Incorrect country code for this phone number");
      }
    }

    const result = await sendLoginTwilioOtpToUser(user, phone, countryCode);

    return {
      ...result,
      is_new_user,
    };
  },

  loginTwilioOtpVerify: async ({ phone, countryCode, otp }) => {
    if (!phone || !otp) {
      throw new Error("phone and otp are required");
    }

    const user = await findUserByPhone(phone);
    if (!user) {
      throw new Error("Invalid credentials");
    }

    if (countryCode) {
      const providedCc = String(countryCode).trim();
      const userCc = String(user.countryCode || "").trim();

      if (userCc && userCc !== providedCc) {
        throw new Error("Incorrect country code for this phone number");
      }
    }

    return verifyLoginTwilioOtp(user, otp);
  },
};

export default AuthService;
