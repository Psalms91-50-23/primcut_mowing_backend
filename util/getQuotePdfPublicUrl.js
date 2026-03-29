import supabase from '../config/db.js';

export const getQuotePdfPublicUrl = async (quotePdfUrl) => {
  if (!quotePdfUrl || typeof quotePdfUrl !== "string") return null;

  if (
    quotePdfUrl.startsWith("http://") ||
    quotePdfUrl.startsWith("https://")
  ) {
    return quotePdfUrl;
  }

  const { data } = supabase.storage
    .from("quotes-pdf")
    .getPublicUrl(quotePdfUrl);

  return data?.publicUrl || null;
};