import { supabase } from "../config/db.js";

const TERMS_BUCKET = "terms-and-conditions";

export const uploadTermsPDFBuffer = async ({
  buffer,
  filePath,
  contentType = "application/pdf",
}) => {
  const { error } = await supabase().storage
    .from(TERMS_BUCKET)
    .upload(filePath, buffer, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload terms PDF: ${error.message}`);
  }

  const { data: publicUrlData } = supabase().storage
    .from(TERMS_BUCKET)
    .getPublicUrl(filePath);

  return {
    storagePath: filePath,
    publicUrl: publicUrlData?.publicUrl || null,
  };
};

export const downloadTermsPDFBuffer = async (filePath) => {
  const { data, error } = await supabase().storage
    .from(TERMS_BUCKET)
    .download(filePath);

  if (error) {
    throw new Error(`Failed to download terms PDF: ${error.message}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

export const downloadStorageFileBuffer = async (bucket, filePath) => {
  if (!bucket) throw new Error("Bucket is required");
  if (!filePath) throw new Error("File path is required");

  const { data, error } = await supabase().storage
    .from(bucket)
    .download(filePath);

  if (error) {
    throw new Error(`Failed to download file from storage: ${error.message}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

export const deleteTermsPDF = async (filePath) => {
  if (!filePath) return;

  const { error } = await supabase().storage
    .from(TERMS_BUCKET)
    .remove([filePath]);

  if (error) {
    throw new Error(`Failed to delete terms PDF: ${error.message}`);
  }
};