import supabase from "../config/db.js";

export default class Quote {
    // Get all quotes
    static async findAll() {
        const { data, error } = await supabase
            .from("quotes")
            .select("*")
            .order("created_at", { ascending: true });

        if (error) throw new Error(`Error fetching quotes: ${error.message}`);
        return data;
    }

    // Get quote by ID
    static async findById(id) {
        const { data, error } = await supabase
            .from("quotes")
            .select("*")
            .eq("id", id)
            .single();

        if (error) throw new Error(`Quote not found with ID ${id}`);
        return data;
    }

    // Get quote by UUID
    static async findByUUID(uuid) {
        const { data, error } = await supabase
            .from("quotes")
            .select("*")
            .eq("uuid", uuid)
            .maybeSingle();

        if (error) {
            throw new Error(`Error fetching customer with ${uuid}: ${error.message}`);
        }
        return data;
    }

    // Create quote
    static async create(quote) {
        const { data, error } = await supabase
            .from("quotes")
            .insert([quote])
            .select('*')
            .single();

        if (error) throw new Error(`Error creating quote: ${error.message}`);
        return data;
    }

    // Update quote by UUID
    static async updateByUUID(uuid, updates) {
        const { data, error } = await supabase
            .from("quotes")
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq("uuid", uuid)
            .select()
            .single();

        if (error) throw new Error(`Error updating quote ${uuid}: ${error.message}`);
        return data;
    }

    // Update quote by ID
    static async updateById(id, updates) {
        const { data, error } = await supabase
            .from("quotes")
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq("id", id)
            .select()
            .single();

        if (error) throw new Error(`Error updating quote ${id}: ${error.message}`);
        return data;
    }

    // Soft delete (set deleted_at)
    static async softDelete(uuid) {
        const { data, error } = await supabase
            .from("quotes")
            .update({ deleted_at: new Date().toISOString() })
            .eq("uuid", uuid)
            .select()
            .single();

        if (error) throw new Error(`Error soft deleting quote: ${error.message}`);
        return data;
    }

    // Reinstate quote
    static async reinstate(uuid) {
        const { data, error } = await supabase
            .from("quotes")
            .update({ deleted_at: null })
            .eq("uuid", uuid)
            .select()
            .single();

        if (error) throw new Error(`Error reinstating quote: ${error.message}`);
        return data;
    }

    // Hard delete
    static async hardDelete(uuid) {
        const { error } = await supabase
            .from("quotes")
            .delete()
            .eq("uuid", uuid);

        if (error) throw new Error(`Error hard deleting quote: ${error.message}`);
        return true;
    }

    static async acceptQuote(uuid) {
        const { data, error } = await supabase
            .from("quotes")
            .update({ 
                status: 'accepted', 
                is_active: false,
                updated_at: new Date().toISOString() 
            })
            .eq("uuid", uuid)
            .eq('status', 'pending')
            .eq('is_expired', false)
            .eq('is_deleted', false)
            .select()
            .single();

        if (error) throw new Error(`Error accepting quote: ${error.message}`);
        return data;
    }

    static async rejectQuote(uuid) {
        const { data, error } = await supabase
            .from("quotes")
            .update({ status: 'rejected', updated_at: new Date().toISOString() })
            .eq("uuid", uuid)
            .select()
            .maybeSingle();

        if (error) throw new Error(`Error rejecting quote: ${error.message}`);
        return data;    
    }

}