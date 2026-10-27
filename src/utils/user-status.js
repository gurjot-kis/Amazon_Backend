export const ACCOUNT_DEACTIVATED_MESSAGE = "Your account has been deactivated.";
export const ACCOUNT_DELETED_MESSAGE = "Your account has been deleted.";

export const mapUserStatus = (status) => (status === 0 ? 0 : 1);

export const parseUserStatus = (value, { defaultValue = 1 } = {}) => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  const n = parseInt(String(value).trim(), 10);
  if (n === 0 || n === 1) {
    return n;
  }
  throw new Error("status must be 0 or 1");
};

/** Block login for inactive customer accounts (role User, status 0). */
export const assertUserCanLogin = (user) => {
  if (!user) return;
  if (user.isDeleted === true) {
    throw new Error(ACCOUNT_DELETED_MESSAGE);
  }
  if (user.role === "User" && user.status === 0) {
    throw new Error(ACCOUNT_DEACTIVATED_MESSAGE);
  }
};
