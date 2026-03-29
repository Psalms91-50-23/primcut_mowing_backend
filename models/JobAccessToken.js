import supabase from "../config/db.js";
import crypto from "crypto";

export default class JobAccessToken {

    static generatePlainAccessToken() {
        return crypto.randomBytes(32).toString("hex");
        }

    static hashAccessToken(token) {
         if (!token) throw new Error("Access token is required");
        return crypto.createHash("sha256").update(String(token)).digest("hex");
    }

    static async create({ job_uuid, token_hash, expires_at, uuid }) {
        const { data, error } = await supabase
        .from("job_access_tokens")
        .insert([{ job_uuid, token_hash, expires_at, uuid }])
        .select("*")
        .single();

        if (error) throw new Error(`Error creating access token: ${error.message}`);
        return data;
    }

    static async findByTokenHash(tokenHash) {
        const { data, error } = await supabase
        .from("job_access_tokens")
        .select("*")
        .eq("token_hash", tokenHash)
        .maybeSingle();

        if (error) {
        throw new Error(`Error finding token: ${error.message}`);
        }

        return data;
    }

    static async markViewed(token_uuid) {
        const { data, error } = await supabase
        .rpc("increment_job_access_view", { token_uuid });

        if (error) throw new Error(`Error updating view count: ${error.message}`);
        return data;
    }

    static async incrementViewCount(token_uuid) {
        try {
        const { data: existingRow, error: fetchError } = await supabase
            .from("job_access_tokens")
            .select("*")
            .eq("uuid", token_uuid)
            .maybeSingle();

        if (fetchError || !existingRow) {
            console.error("Failed to fetch token:", fetchError);
            return null;
        }

        const nowIso = new Date().toISOString();

        const { data, error: updateError } = await supabase
            .from("job_access_tokens")
            .update({
            view_count: (existingRow.view_count || 0) + 1,
            last_viewed_at: nowIso,
            first_viewed_at: existingRow.first_viewed_at || nowIso,
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

    static async revokeAllForJob(job_uuid) {
        const { error } = await supabase
        .from("job_access_tokens")
        .delete()
        .eq("job_uuid", job_uuid);

        if (error) throw new Error(`Error revoking tokens: ${error.message}`);
    }

    static async findByUUID(uuid) {
        const { data, error } = await supabase
        .from("job_access_tokens")
        .select("*")
        .eq("uuid", uuid)
        .limit(1)
        .maybeSingle();

        if (error) throw new Error(`Error finding token UUID: ${error.message}`);
        return data;
    }

    static async findOne(job_uuid, token_hash) {
        const { data, error } = await supabase
        .from("job_access_tokens")
        .select("*")
        .eq("job_uuid", job_uuid)
        .eq("token_hash", token_hash)
        .limit(1)
        .maybeSingle();

        if (error) throw new Error(`Error finding token UUID: ${error.message}`);
        return data;
    }

    static async revokeToken(tokenHash) {
        const { error } = await supabase
        .from("job_access_tokens")
        .delete()
        .eq("token_hash", tokenHash);

        if (error) throw new Error(error.message);
    }

    static async findValidToken({ job_uuid, token_hash }) {
        const nowIso = new Date().toISOString();

        const { data, error } = await supabase
        .from("job_access_tokens")
        .select("*")
        .eq("job_uuid", job_uuid)
        .eq("token_hash", token_hash)
        .gt("expires_at", nowIso)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

        if (error) throw new Error(`Error finding valid token: ${error.message}`);
        return data;
    }
}