export const normalizeFeaturedImagesInput = (value) => {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value))
    return value.filter((v) => typeof v === "string" && v.trim() !== "");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value); // formdata sends arrays as JSON string sometimes
      return Array.isArray(parsed)
        ? parsed.filter((v) => typeof v === "string" && v.trim() !== "")
        : undefined;
    } catch {
      return value.trim() !== "" ? [value.trim()] : undefined;
    }
  }
  return undefined;
};

export const applyProductUploads = (body, files) => {
  const next = { ...(body || {}) };
  const mainImageFile = files?.mainImage?.[0];
  const featuredImageFiles = files?.featuredImages || [];

  if (mainImageFile) {
    next.mainImage = `/uploads/products/${mainImageFile.filename}`;
  }

  const uploadedFeatured = featuredImageFiles.map(
    (f) => `/uploads/products/${f.filename}`,
  );
  const existingFeatured = normalizeFeaturedImagesInput(next.featuredImages);

  if (uploadedFeatured.length > 0) {
    next.featuredImages = [...(existingFeatured || []), ...uploadedFeatured];
  } else if (next.featuredImages !== undefined) {
    const normalized = normalizeFeaturedImagesInput(next.featuredImages);
    if (normalized === undefined) {
      delete next.featuredImages;
    } else {
      next.featuredImages = normalized;
    }
  }

  return next;
};

export const applyProductUploadsForUpdate = (body, files, existingProduct) => {
  const next = { ...(body || {}) };
  const mainImageFile = files?.mainImage?.[0];
  const featuredImageFiles = files?.featuredImages || [];

  // only set if new file uploaded — otherwise leave undefined, service will fallback
  if (mainImageFile) {
    next.mainImage = `/uploads/products/${mainImageFile.filename}`;
  }
  // ❌ removed delete next.mainImage — was causing mainImage to be lost

  const uploadedFeatured = featuredImageFiles.map(
    (f) => `/uploads/products/${f.filename}`,
  );
  const existingKept = normalizeFeaturedImagesInput(next.featuredImages) || [];

  if (uploadedFeatured.length > 0 || next.featuredImages !== undefined) {
    next.featuredImages = [...new Set([...existingKept, ...uploadedFeatured])];
  } else {
    next.featuredImages = existingProduct.featuredImages;
  }

  return next;
};
