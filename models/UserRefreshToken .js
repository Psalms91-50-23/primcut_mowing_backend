import supabase from '../config/db.js';

class UserRefreshToken {

    // Create a new refresh token
    static async create({ user_uuid, token_hash, expires_at, uuid }) {
        const { data, error } = await supabase
            .from("user_refresh_tokens")
            .insert([{ user_uuid, token_hash, expires_at, uuid }])
            .select("*")
            .maybeSingle();

        if (error) throw new Error(`Error creating refresh token: ${error.message}`);
        return data;
    }

    // Find by token hash
    static async findByTokenHash(tokenHash) {
        const { data, error } = await supabase
            .from("user_refresh_tokens")
            .select("*")
            .eq("token_hash", tokenHash)
            .maybeSingle();

        if (error) throw new Error(`Error finding refresh token: ${error.message}`);
        return data;
    }

    // Revoke a single refresh token
    static async revokeToken(tokenHash) {
        const { error } = await supabase
            .from("user_refresh_tokens")
            .delete()
            .eq("token_hash", tokenHash);

        if (error) throw new Error(error.message);
    }

    // Revoke all refresh tokens for a user (e.g., logout everywhere)
    static async revokeAllForUser(user_uuid) {
        const { error } = await supabase
            .from("user_refresh_tokens")
            .delete()
            .eq("user_uuid", user_uuid);

        if (error) throw new Error(`Error revoking all refresh tokens: ${error.message}`);
    }

    // Find by UUID
    static async findByUUID(uuid) {
        const { data, error } = await supabase
            .from("user_refresh_tokens")
            .select("*")
            .eq("uuid", uuid)
            .limit(1)
            .maybeSingle();

        if (error) throw new Error(`Error finding refresh token UUID: ${error.message}`);
        return data;
    }
}

export default UserRefreshToken;