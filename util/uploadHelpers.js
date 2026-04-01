import path from "path";
import { supabase } from "../config/db.js";

export const parseJSONField = (value, fallback = null) => {
  if (value == null || value === "") return fallback;

  if (typeof value === "object") return value;

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  return fallback;
};

export const sanitizeFileName = (name = "image") => {
  return String(name)
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .toLowerCase();
};

export const getExtensionFromMime = (mimetype = "") => {
  const map = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "image/heif": ".heif",
  };

  return map[mimetype] || "";
};

export const uploadImageToBucket = async ({
  bucket,
  folder,
  file,
  index = 0,
}) => {
  if (!bucket) throw new Error("Bucket is required");
  if (!folder) throw new Error("Folder is required");
  if (!file?.buffer) throw new Error("File buffer is required");

  const extFromOriginal = path.extname(file.originalname || "");
  const ext = extFromOriginal || getExtensionFromMime(file.mimetype) || ".jpg";
  const baseName = path.basename(file.originalname || `image-${index + 1}`, ext);
  const safeBaseName = sanitizeFileName(baseName) || `image-${index + 1}`;
  const fileName = `${Date.now()}-${index + 1}-${safeBaseName}${ext}`;
  const filePath = `${folder}/${fileName}`;

  const { error } = await supabase().storage.from(bucket).upload(filePath, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
  });

  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  const { data: publicUrlData } = supabase().storage.from(bucket).getPublicUrl(filePath);

  return {
    path: filePath,
    url: publicUrlData?.publicUrl || null,
    file_name: fileName,
    mime_type: file.mimetype,
    size: file.size,
    uploaded_at: new Date().toISOString(),
  };
};

export const removeUploadedFiles = async ({ bucket, files = [] }) => {
  if (!bucket) return;

  const paths = files.map((file) => file?.path).filter(Boolean);
  if (!paths.length) return;

  const { error } = await supabase().storage.from(bucket).remove(paths);

  if (error) {
    console.error("Failed to cleanup uploaded files:", error.message);
  }
};