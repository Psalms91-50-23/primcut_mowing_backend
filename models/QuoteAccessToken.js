import supabase from '../config/db.js';

class QuoteAccessToken {

    static async create({ quote_uuid, token_hash, expires_at, uuid }) {
        const { data, error } = await supabase
            .from("quote_access_tokens")
            .insert([{ quote_uuid, token_hash, expires_at, uuid }])
            .select("*")
            .single();

        if (error) throw new Error(`Error creating access token: ${error.message}`);
        return data;
    }

    static async findByTokenHash(tokenHash) {
        const { data, error } = await supabase
            .from("quote_access_tokens")
            .select("*")
            .eq("token_hash", tokenHash)
            .maybeSingle(); // <- safer

        if (error) {
            throw new Error(`Error finding token: ${error.message}`);
        }

        return data;
    }

    static async markViewed(token_uuid) {
        const { data, error } = await supabase
            .rpc("increment_quote_access_view", { token_uuid });

        if (error) throw new Error(`Error updating view count: ${error.message}`);
        return data;
    }

    static async incrementViewCount(token_uuid) {
        try {
            // 1️⃣ Fetch the existing row
            const { data: existingRow, error: fetchError } = await supabase
                .from("quote_access_tokens")
                .select("*")
                .eq("uuid", token_uuid)
                .maybeSingle();

            if (fetchError || !existingRow) {
                console.error("Failed to fetch token:", fetchError);
                return null;
            }

            // 2️⃣ Update the row: increment view_count and update timestamps
            const { data, error: updateError } = await supabase
                .from("quote_access_tokens")
                .update({
                    view_count: (existingRow.view_count || 0) + 1,
                    last_viewed_at: new Date().toISOString(),
                    first_viewed_at: existingRow.first_viewed_at || new Date().toISOString()
                })
                .eq("uuid", token_uuid)
                .select("*")
                .maybeSingle();

            if (updateError) {
                console.error("Failed to increment view count:", updateError);
                return null;
            }

            return data;

        } catch (err) {
            console.error("Unexpected error in incrementViewCount:", err);
            return null;
        }
    }

    static async revokeAllForQuote(quote_uuid) {
        const { error } = await supabase
            .from("quote_access_tokens")
            .delete()
            .eq("quote_uuid", quote_uuid);

        if (error) throw new Error(`Error revoking tokens: ${error.message}`);
    }

    static async findByUUID(uuid) {
        const { data, error } = await supabase
            .from("quote_access_tokens")
            .select("*")
            .eq("uuid", uuid)
            .limit(1)
            .maybeSingle();

        if (error) throw new Error(`Error finding token UUID: ${error.message}`);
        return data;
    }

    static async findOne(quote_uuid, token_hash){
         const { data, error } = await supabase
            .from("quote_access_tokens")
            .select("*")
            .eq("quote_uuid", quote_uuid)
            .eq("token_hash", token_hash)
            .limit(1)
            .maybeSingle();

        if (error) throw new Error(`Error finding token UUID: ${error.message}`);
        return data;

    }

    static async revokeToken(tokenHash) {
        const { error } = await supabase
            .from("quote_access_tokens")
            .delete()
            .eq("token_hash", tokenHash);

        if (error) throw new Error(error.message);
    }

}

export default QuoteAccessToken;