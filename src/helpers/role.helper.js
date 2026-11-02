export const isSuperAdmin = (user) => user?.role === "SuperAdmin";

export const getVendorScope = (user) =>
  isSuperAdmin(user) ? null : user?._id;