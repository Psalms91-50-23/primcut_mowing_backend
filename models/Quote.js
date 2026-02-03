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
        if (!id) {
            throw new Error("Quote ID is required");
        }
        const { data, error } = await supabase
            .from("quotes")
            .select("*")
            .eq("id", id)
            .maybeSingle();

        if (error) throw new Error(`Quote not found with ID ${id}`);
        return data;
    }

    // Get quote by UUID
    static async findByUUID(uuid) {
        if (!uuid) {
            throw new Error("Quote UUID is required");
        }
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
        if (!quote) {
            throw new Error("Quote data is required");
        }
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
          // Required identifier
        if (!uuid) {
            throw new Error("Quote UUID is required");
        }

        // Required payload
        if (!updates || typeof updates !== "object") {
            throw new Error("Updates object is required");
        }

        // Prevent empty updates
        if (Object.keys(updates).length === 0) {
            throw new Error("Updates object cannot be empty");
  }
        const { data, error } = await supabase
            .from("quotes")
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq("uuid", uuid)
            .select("*")
            .single();

        if (error) throw new Error(`Error updating quote ${uuid}: ${error.message}`);
        return data;
    }

    // Update quote by ID
    static async updateById(id, updates) {
        if (!id) {
            throw new Error("Quote ID is required");
        }

        // Required payload
        if (!updates || typeof updates !== "object") {
            throw new Error("Updates object is required");
        }

        // Prevent empty updates
        if (Object.keys(updates).length === 0) {
            throw new Error("Updates object cannot be empty");
  }
        const { data, error } = await supabase
            .from("quotes")
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq("id", id)
            .select("*")
            .single();

        if (error) throw new Error(`Error updating quote ${id}: ${error.message}`);
        return data;
    }

    static async hardDelete(uuid) {
        if (!uuid) {
        throw new Error("Quote UUID is required");
        }

        // Fetch the quote first to verify existence
        const { data: quote, error: fetchError } = await supabase
            .from('quotes')
            .select('*')
            .eq('uuid', uuid)
            .maybeSingle(); // read only, existence check

        if (fetchError) {
            throw new Error(`Error fetching quote ${uuid}: ${fetchError.message}`);
        }

        if (!quote) {
            throw new Error(`Quote with UUID ${uuid} not found`);
        }

        // Perform the hard delete
        const { data, error } = await supabase
            .from('quotes')
            .delete()
            .eq('uuid', uuid)
            .select("*") 
            .single(); 

        if (error) {
            throw new Error(`Error deleting quote ${uuid}: ${error.message}`);
        }
            console.info(`Quote ${uuid} hard-deleted at ${new Date().toISOString()}`);
        return data; 
    }
    // Soft delete (set deleted_at)
    static async softDelete(uuid) {
        if (!uuid) {
            throw new Error("Quote UUID is required");
        }
        const now = new Date().toISOString();
        const { data, error } = await supabase
            .from("quotes")
            .update({ 
                deleted_at: now, 
                is_active: false, 
                is_deleted: true, 
                updated_at: now, 
                status: "rejected" })
            .eq("uuid", uuid)
            .select("*")
            .single();

        if (error) throw new Error(`Error soft deleting quote: ${error.message}`);
        return data;
    }

    // Reinstate quote
    static async reinstate(uuid) {
        if (!uuid) {
            throw new Error("Quote UUID is required");
        }
        const { data, error } = await supabase
            .from("quotes")
            .update({ deleted_at: null })
            .eq("uuid", uuid)
            .select("*")
            .single();

        if (error) throw new Error(`Error reinstating quote: ${error.message}`);
            return data;
        }

    static async acceptQuote(uuid) {
        if (!uuid) {
            throw new Error("Quote UUID is required");
        }
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
        .select("*")
        .single();

        if (error) throw new Error(`Error accepting quote: ${error.message}`);
        return data;
    }

    static async rejectQuote(uuid) {
        const { data, error } = await supabase
            .from("quotes")
            .update({ status: 'rejected', updated_at: new Date().toISOString(), is_active: false })
            .eq("uuid", uuid)
            .eq("is_deleted", false)
                .select("*")
            .single();

        if (error) throw new Error(`Error rejecting quote: ${error.message}`);
        return data;    
    }

    /**
 * Extend a quote's expiry
 * @param {string} uuid - UUID of the quote
 * @param {Object} options - Either { newDate } or { addDays }
 * @param {string} [options.newDate] - ISO string or 'YYYY-MM-DD' for new expiry
 * @param {number} [options.addDays] - Number of days to add to current expiry
 */

    static async extendQuote (uuid, options = {}) {
        if (!uuid) throw new Error("Quote UUID is required");
        if (!options.newDate && !options.addDays) {
            throw new Error("Either newDate or addDays must be provided");
        }
        // Fetch the current quote first
        const { data: quote, error: fetchError } = await supabase
            .from("quotes")
            .select("*")
            .eq("uuid", uuid)
            .eq("is_deleted", false)
            .single();

        if (fetchError) throw new Error(`Error fetching quote: ${fetchError.message}`);
        if (!quote) throw new Error("Quote not found");

        let newExpiry = null;

        if (options.newDate) {
            // Use picked date
            newExpiry = new Date(options.newDate);
        } else if (options.addDays) {
            // Add N days to current expiry
            newExpiry = new Date(quote.expiry_end);
            newExpiry.setDate(newExpiry.getDate() + options.addDays);
        } else {
            throw new Error("Either newDate or addDays must be provided");
        }

        // Set time to end of day for intuitive expiry
        newExpiry.setHours(23, 59, 59, 999);
        const newExpiryISO = newExpiry.toISOString();

        const updatedAt = new Date().toISOString();

        // Update the quote
        const { data, error } = await supabase
            .from("quotes")
            .update({
            expiry_end: newExpiryISO,
            status: "pending",       // reactivate
            is_expired: false,
            is_active: true,
            updated_at: updatedAt,
            })
        .eq("uuid", uuid)
            .select("*")
        .single();

        if (error) throw new Error(`Error extending quote: ${error.message}`);
        return data;
    };

    static async deleteImagesFromBucket (images = []) {
        const errors = [];

        // Extract file paths from image URLs
        const filePaths = images
            .map((img) => {
            const url = img.url || img;

            // Extract everything after the last "/"
            const parts = url.split("/");
            return parts[parts.length - 1];
            })
            .filter(Boolean);

        // Attempt deletion
        const { error } = await supabase.storage
            .from("quote-images")
            .remove(filePaths);

        if (error) {
            errors.push(error.message);
            return { success: false, errors };
        }

        // Log success
        console.info("Deleted images from bucket:", filePaths);
        return { success: true };
    };

}


