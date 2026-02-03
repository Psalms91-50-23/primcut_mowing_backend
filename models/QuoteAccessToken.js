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
            .limit(1)
            .single();

        if (error) {
            throw new Error(`Error finding token: ${error.message}`);
        }

        return data;
    }

    static async markViewed(id) {
        const { data, error } = await supabase
            .rpc("increment_quote_access_view", { id });

        if (error) throw new Error(`Error updating view count: ${error.message}`);
        return data;
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

}

export default QuoteAccessToken;