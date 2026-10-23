import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import { assertUserCanLogin, mapUserStatus } from "../utils/user-status.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "365d";

const ALLOWED_PROVIDERS = ["google", "facebook", "apple"];

const signAuthToken = (user) =>
  jwt.sign(
    {
      _id: user._id.toString(),
      user_id: user.user_id,
      email: user.email,
      role: user.role || "User",
    },
    JWT_SECRET,
    { algorithm: "HS256", expiresIn: JWT_EXPIRES_IN },
  );

const buildAuthResponse = (user, token) => ({
  _id: user._id.toString(),
  user_id: user.user_id,
  name: user.name,
  email: user.email,
  role: user.role || "User",
  status: mapUserStatus(user.status),
  authProvider: user.authProvider,
  token,
});

export const SocialAuthService = {
  socialAuth: async ({ email, name, socialId, provider }) => {
    const normalizedProvider = String(provider || "")
      .trim()
      .toLowerCase();

    if (!socialId || !String(socialId).trim()) {
      throw new Error("socialId is required");
    }

    if (!ALLOWED_PROVIDERS.includes(normalizedProvider)) {
      throw new Error("provider must be 'google', 'facebook', or 'apple'");
    }

    const normalizedSocialId = String(socialId).trim();

    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();

    const normalizedName = String(name || "").trim() || "User";

    // Map each provider to its corresponding database field.
    const socialFieldMap = {
      google: "googleId",
      facebook: "facebookId",
      apple: "appleId",
    };

    const socialField = socialFieldMap[normalizedProvider];

    // 1. Find user by provider-specific social ID.
    let user = await User.findOne({
      [socialField]: normalizedSocialId,
    }).exec();

    // 2. If not found, find an existing account by email.
    if (!user && normalizedEmail) {
      user = await User.findOne({
        email: normalizedEmail,
      }).exec();

      if (user) {
        user[socialField] = normalizedSocialId;
        user.authProvider = normalizedProvider;

        await user.save();
      }
    }

    // 3. Create a new user if no existing account is found.
    if (!user) {
      user = await User.create({
        email: normalizedEmail,
        name: normalizedName,
        role: "User",
        status: 1,
        [socialField]: normalizedSocialId,
        authProvider: normalizedProvider,
        passwordHash: "",
      });
    }

    // 4. Validate user status before allowing login.
    assertUserCanLogin(user);

    // 5. Generate JWT and return authentication response.
    const token = signAuthToken(user);

    return buildAuthResponse(user, token);
  },
};

export default SocialAuthService;
