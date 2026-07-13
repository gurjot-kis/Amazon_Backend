import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_ROOT = path.join(__dirname, "../uploads");

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files (jpeg, png, webp, gif) are allowed"), false);
  }
};

const createStorage = (subfolder) =>
  multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, path.join(UPLOADS_ROOT, subfolder));
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = crypto.randomUUID();
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${uniqueSuffix}${ext}`);
    },
  });

export const uploadProductImages = multer({
  storage: createStorage("products"),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per file
}).fields([
  { name: "mainImage", maxCount: 1 },
  { name: "featuredImages", maxCount: 10 },
]);

export const uploadCategoryImage = multer({
  storage: createStorage("categories"),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per file
}).single("category_image");

export const uploadSubCategoryImage = multer({
  storage: createStorage("sub-categories"),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per file
}).single("sub_category_image");

export const uploadAdminProfilePicture = multer({
  storage: createStorage("admin"),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per file
}).single("profile_picture");

export const uploadBannerImage = multer({
  storage: createStorage("banners"),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per file
}).single("banner_image");


export const uploadWarehouseImage = multer({
  storage: createStorage("warehouses"),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per file
}).single("warehouse_image");

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const chatStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = path.join(UPLOADS_ROOT, "chat/files");
    
    if (file.mimetype.startsWith("image/")) {
      folder = path.join(UPLOADS_ROOT, "chat/images");
    } else if (file.mimetype.startsWith("video/")) {
      folder = path.join(UPLOADS_ROOT, "chat/videos");
    }
    
    ensureDir(folder);
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

export const uploadMedia = multer({ storage: chatStorage });
