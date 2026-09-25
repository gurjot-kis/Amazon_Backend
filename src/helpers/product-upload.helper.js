
export const normalizeFeaturedImagesInput = (value) => {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value))
    return value.filter((v) => typeof v === "string" && v.trim() !== "");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((v) => typeof v === "string" && v.trim() !== "")
        : undefined;
    } catch {
      return value.trim() !== "" ? [value.trim()] : undefined;
    }
  }
  return undefined;
};

// Normalize variant input if sent stringified via FormData
const parseVariants = (variants) => {
  if (!variants) return [];
  if (Array.isArray(variants)) return variants;
  if (typeof variants === "string") {
    try {
      return JSON.parse(variants);
    } catch {
      return [];
    }
  }
  return [];
};

export const applyProductUploads = (body, files) => {
  const next = { ...(body || {}) };

  // Handle both array format from multer.any() and object format from multer.fields()
  const fileList = Array.isArray(files)
    ? files
    : [
        ...(files?.mainImage || []),
        ...(files?.featuredImages || []),
        ...Object.keys(files || {})
          .filter((k) => k.startsWith("variant_"))
          .flatMap((k) => files[k]),
      ];

  // 1. Resolve mainImage
  const mainImageFile = fileList.find((f) => f.fieldname === "mainImage");
  if (mainImageFile) {
    next.mainImage = `/uploads/products/${mainImageFile.filename}`;
  }

  // 2. Resolve featuredImages
  const featuredImageFiles = fileList.filter(
    (f) => f.fieldname === "featuredImages",
  );
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

  // 3. Resolve Variant Images: variant_0_images, variant_1_images, etc.
  const rawVariants = parseVariants(next.variants);
  if (rawVariants.length > 0) {
    next.variants = rawVariants.map((variant, index) => {
      const variantFiles = fileList.filter(
        (f) => f.fieldname === `variant_${index}_images`,
      );
      const uploadedVariantImages = variantFiles.map(
        (f) => `/uploads/products/${f.filename}`,
      );

      // Preserve any existing string images (if any) and append new uploaded ones
      const existingImages = Array.isArray(variant.images)
        ? variant.images.filter(
            (img) => typeof img === "string" && img.trim() !== "",
          )
        : [];

      return {
        ...variant,
        images: [...existingImages, ...uploadedVariantImages],
      };
    });
  }

  return next;
};

export const applyProductUploadsForUpdate = (body, files, existingProduct) => {
  const next = { ...(body || {}) };

  const fileList = Array.isArray(files)
    ? files
    : [
        ...(files?.mainImage || []),
        ...(files?.featuredImages || []),
        ...Object.keys(files || {})
          .filter((k) => k.startsWith("variant_"))
          .flatMap((k) => files[k]),
      ];

  const mainImageFile = fileList.find((f) => f.fieldname === "mainImage");
  if (mainImageFile) {
    next.mainImage = `/uploads/products/${mainImageFile.filename}`;
  }

  const featuredImageFiles = fileList.filter(
    (f) => f.fieldname === "featuredImages",
  );
  const uploadedFeatured = featuredImageFiles.map(
    (f) => `/uploads/products/${f.filename}`,
  );
  const existingKept = normalizeFeaturedImagesInput(next.featuredImages) || [];

  if (uploadedFeatured.length > 0 || next.featuredImages !== undefined) {
    next.featuredImages = [...new Set([...existingKept, ...uploadedFeatured])];
  } else {
    next.featuredImages = existingProduct.featuredImages;
  }

  // Handle variants in update
  const rawVariants = parseVariants(next.variants);
  if (rawVariants.length > 0) {
    next.variants = rawVariants.map((variant, index) => {
      const variantFiles = fileList.filter(
        (f) => f.fieldname === `variant_${index}_images`,
      );
      const uploadedVariantImages = variantFiles.map(
        (f) => `/uploads/products/${f.filename}`,
      );

      const existingImages = Array.isArray(variant.images)
        ? variant.images.filter(
            (img) => typeof img === "string" && img.trim() !== "",
          )
        : [];

      return {
        ...variant,
        images: [...existingImages, ...uploadedVariantImages],
      };
    });
  }

  return next;
};
