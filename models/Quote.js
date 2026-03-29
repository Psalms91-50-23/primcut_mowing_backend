import supabase from "../config/db.js";

function buildSearchOr(terms, columns) {
  const filters = [];

  for (const rawTerm of terms) {
    const term = String(rawTerm || "").trim().replace(/,/g, "");
    if (!term) continue;

    for (const column of columns) {
      filters.push(`${column}.ilike.%${term}%`);
    }
  }

  return filters.join(",");
}

export default class Quote {

    static async findByCustomerUUID(customerUuid) {
        if (!customerUuid) return [];

        const { data, error } = await supabase
        .from("quotes")
        .select(`
            uuid,
            customer_uuid,
            status,
            subtotal_amount,
            gst_amount,
            total_amount,
            address,
            message,
            created_at,
            updated_at,
            deleted_at
        `)
        .eq("customer_uuid", customerUuid)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

        if (error) {
        throw error;
        }

        return data || [];
    }

    static async countSentQuotes() {
        const { count, error } = await supabase
            .from("quotes")
            .select("*", { count: "exact", head: true })
            .eq("status", "sent")
            .eq("is_deleted", false)
            .is("deleted_at", null);

        if (error) {
            throw new Error(`Error counting sent quotes: ${error.message}`);
        }

        return count || 0;
    }

    static async searchSummary(query, limit = 10) {
        const terms = String(query || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

        if (terms.length === 0) return [];

        const orFilter = buildSearchOr(terms, [
        "uuid",
        "contact_first_name",
        "contact_last_name",
        "contact_email",
        "contact_mobile",
        "contact_landline",
        "address",
        // "status",
        ]);

        const { data, error } = await supabase
        .from("quotes")
        .select(`
            uuid,
            status,
            contact_first_name,
            contact_last_name,
            contact_email,
            contact_mobile,
            contact_landline,
            address,
            total_amount,
            created_at
        `)
        .or(orFilter)
        .order("created_at", { ascending: false })
        .limit(limit);

        if (error) throw error;
        return data || [];
    }
    
    static async findAllWithPagination({
        page = 1,
        limit = 10,
        status,
        olderThan = 7,
    }) {
        const pageNum = Math.max(Number(page) || 1, 1);
        const limitNum = Math.min(Number(limit) || 10, 100);
        const from = (pageNum - 1) * limitNum;
        const to = from + limitNum - 1;

        let query = supabase
            .from("quotes")
            .select(
            `
                *,
                customer:customers (
                uuid,
                first_name,
                last_name,
                email
                )
            `,
            { count: "exact" }
            )
            .range(from, to)
            .order("created_at", { ascending: false });

        // ------------------------
        // STATUS FILTERS
        // ------------------------
        if (status === "draft") {
            query = query.eq("status", "draft");
        }

        if (status === "sent") {
            query = query.eq("status", "sent");
        }

        if (status === "accepted") {
            query = query.eq("status", "accepted");
        }

        if (status === "rejected") {
            query = query.eq("status", "rejected");
        }

        // ------------------------
        // EXPIRED (DERIVED)
        // ------------------------
       if (status === "expired") {
        const cutoffDate = new Date(
            Date.now() - Number(olderThan) * 24 * 60 * 60 * 1000
        ).toISOString();

            query = query
            .eq("status", "expired")      // ← check expired, not draft/sent
            .lt("created_at", cutoffDate);
        }

        const { data, error, count } = await query;

        if (error) {
            throw new Error(`Error fetching quotes: ${error.message}`);
        }

        return {
            quotes: data || [],
            page: pageNum,
            limit: limitNum,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limitNum),
        };
    }

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

    // static async hardDelete(uuid) {
    //     if (!uuid) {
    //     throw new Error("Quote UUID is required");
    //     }

    //     // Fetch the quote first to verify existence
    //     const { data: quote, error: fetchError } = await supabase
    //         .from('quotes')
    //         .select('*')
    //         .eq('uuid', uuid)
    //         .maybeSingle(); // read only, existence check

    //     if (fetchError) {
    //         throw new Error(`Error fetching quote ${uuid}: ${fetchError.message}`);
    //     }

    //     if (!quote) {
    //         throw new Error(`Quote with UUID ${uuid} not found`);
    //     }

    //     // Perform the hard delete
    //     const { data, error } = await supabase
    //         .from('quotes')
    //         .delete()
    //         .eq('uuid', uuid)
    //         .select("*") 
    //         .single(); 

    //     if (error) {
    //         throw new Error(`Error deleting quote ${uuid}: ${error.message}`);
    //     }
    //         console.info(`Quote ${uuid} hard-deleted at ${new Date().toISOString()}`);
    //     return data; 
    // }

    static async hardDelete(uuid) {
        if (!uuid) throw new Error("Quote UUID is required");

        // Fetch the quote first (so we can delete images)
        const { data: quote, error: fetchError } = await supabase
            .from("quotes")
            .select("*")
            .eq("uuid", uuid)
            .maybeSingle();

        if (fetchError) throw new Error(`Error fetching quote ${uuid}: ${fetchError.message}`);
        if (!quote) throw new Error(`Quote with UUID ${uuid} not found`);

        // 1) DELETE IMAGES FIRST (storage)
        const images = quote.images || [];
        if (images.length > 0) {
            const deleteResult = await Quote.deleteImagesFromBucket(images);
            if (!deleteResult?.success) {
            const details = deleteResult?.errors || [];
            throw new Error(
                `Failed to delete images for quote ${uuid}. Quote was NOT deleted. Details: ${JSON.stringify(details)}`
            );
            }
        }

        // 2) DELETE RELATED JOBS
        await Job.deleteByQuoteUUID(uuid);

        // 3) DELETE THE QUOTE ROW
        const { data, error } = await supabase
            .from("quotes")
            .delete()
            .eq("uuid", uuid)
            .select("*")
            .single();

        if (error) throw new Error(`Error deleting quote ${uuid}: ${error.message}`);

        console.info(`Quote ${uuid} hard-deleted at ${new Date().toISOString()}`);
        return data;
    }
    
    // Soft delete (set deleted_at)
    // static async softDelete(uuid) {
    //     if (!uuid) {
    //         throw new Error("Quote UUID is required");
    //     }
    //     const now = new Date().toISOString();
    //     const { data, error } = await supabase
    //         .from("quotes")
    //         .update({ 
    //             deleted_at: now, 
    //             is_active: false, 
    //             is_deleted: true, 
    //             updated_at: now, 
    //             status: "rejected" })
    //         .eq("uuid", uuid)
    //         .select("*")
    //         .single();

    //     if (error) throw new Error(`Error soft deleting quote: ${error.message}`);
    //     return data;
    // }
    
    static async softDelete(uuid) {
        if (!uuid) throw new Error("Quote UUID is required");

        const now = new Date().toISOString();

        // Fetch quote status so we can store previous_status
        const { data: quote, error: quoteFetchErr } = await supabase
            .from("quotes")
            .select("status,is_deleted")
            .eq("uuid", uuid)
            .maybeSingle();

        if (quoteFetchErr) throw new Error(`Error fetching quote ${uuid}: ${quoteFetchErr.message}`);
        if (!quote) throw new Error(`Quote with UUID ${uuid} not found`);

        // Optional: idempotent
        if (quote.is_deleted) return quote;

        // 0) Find jobs for this quote (usually 0 or 1)
        const { data: jobs, error: jobsFetchErr } = await supabase
            .from("jobs")
            .select("uuid,status,is_deleted")
            .eq("quote_uuid", uuid);

        if (jobsFetchErr) {
            throw new Error(`Error fetching jobs for quote ${uuid}: ${jobsFetchErr.message}`);
        }

        const activeJobs = (jobs || []).filter(j => !j.is_deleted);
        const jobUuids = activeJobs.map((j) => j.uuid);

        // 1) Soft-delete recurrences for those jobs (safe even if none exist)
        if (jobUuids.length > 0) {
            const { error: recErr } = await supabase
            .from("job_recurrences")
            .update({
                deleted_at: now,
                is_deleted: true,
                updated_at: now,
            })
            .in("job_uuid", jobUuids)
            .eq("is_deleted", false);

            if (recErr) {
            throw new Error(`Error soft deleting recurrences for quote ${uuid}: ${recErr.message}`);
            }
        }

        // 2) Soft-delete jobs (per job so we can store previous_status accurately)
        for (const job of activeJobs) {
            const { error: oneJobErr } = await supabase
            .from("jobs")
            .update({
                previous_status: job.status,
                deleted_at: now,
                is_active: false,
                is_deleted: true,
                updated_at: now,
                status: "cancelled", // must exist in job_status
            })
            .eq("uuid", job.uuid)
            .eq("is_deleted", false);

            if (oneJobErr) {
            throw new Error(`Error soft deleting job ${job.uuid}: ${oneJobErr.message}`);
            }
        }

        // 3) Soft-delete quote + store previous_status
        const { data, error } = await supabase
            .from("quotes")
            .update({
            previous_status: quote.status,
            deleted_at: now,
            is_active: false,
            is_deleted: true,
            updated_at: now,
            status: "rejected", // must exist in quote_status
            })
            .eq("uuid", uuid)
            .select("*")
            .single();

        if (error) throw new Error(`Error soft deleting quote: ${error.message}`);
        return data;
    }

    static async restore(uuid) {

        if (!uuid) throw new Error("Quote UUID is required");

        const now = new Date().toISOString();

        // 0) Fetch quote previous_status (so we know what to restore to)
        const { data: quoteRow, error: quoteFetchErr } = await supabase
            .from("quotes")
            .select("previous_status,status,is_deleted")
            .eq("uuid", uuid)
            .maybeSingle();

        if (quoteFetchErr) {
            throw new Error(`Error fetching quote ${uuid}: ${quoteFetchErr.message}`);
        }
        if (!quoteRow) {
            throw new Error(`Quote with UUID ${uuid} not found`);
        }

        // Choose what status to restore to
        const restoredQuoteStatus = quoteRow.previous_status || "draft";

        // 1) Find jobs for this quote (usually 0 or 1)
        const { data: jobs, error: jobsFetchErr } = await supabase
            .from("jobs")
            .select("uuid,previous_status,status,is_deleted")
            .eq("quote_uuid", uuid);

        if (jobsFetchErr) {
            throw new Error(`Error fetching jobs for quote ${uuid}: ${jobsFetchErr.message}`);
        }

        const jobUuids = (jobs || []).map((j) => j.uuid);

        // 2) Restore job recurrences first (safe even if none exist)
        if (jobUuids.length > 0) {
            const { error: recErr } = await supabase
            .from("job_recurrences")
            .update({
                deleted_at: null,
                is_deleted: false,
                // Restore status from previous_status if available, otherwise leave as-is
                // (We can't do "status = previous_status" in a single query via supabase-js)
                // We'll handle correct per-row restore below if you want true restore.
                updated_at: now, // only if you have updated_at on job_recurrences; if not, remove this line
            })
            .in("job_uuid", jobUuids)
            .eq("is_deleted", true);

            // NOTE: You don't currently have updated_at on job_recurrences in your schema.
            // If you do NOT have it, remove updated_at above.

            if (recErr) {
            throw new Error(`Error restoring recurrences for quote ${uuid}: ${recErr.message}`);
            }
        }

        // 2b) OPTIONAL: true status restore for recurrences (per-row using previous_status)
        // If you want recurrences to return to their exact prior status, uncomment this block.
        
        if (jobUuids.length > 0) {
            const { data: occs, error: occFetchErr } = await supabase
            .from("job_recurrences")
            .select("id,previous_status")
            .in("job_uuid", jobUuids)
            .eq("is_deleted", false);

            if (occFetchErr) {
            throw new Error(`Error fetching recurrences for restore: ${occFetchErr.message}`);
            }

            const updates = (occs || [])
            .filter(o => o.previous_status) // only those we can restore precisely
            .map(o => ({
                id: o.id,
                status: o.previous_status,
                previous_status: null,
            }));

            if (updates.length > 0) {
            const { error: occUpdateErr } = await supabase
                .from("job_recurrences")
                .upsert(updates, { onConflict: "id" });

            if (occUpdateErr) {
                throw new Error(`Error restoring recurrence statuses: ${occUpdateErr.message}`);
            }
            }
        }

        // 3) Restore jobs (safe even if 0 jobs match)
        // Restore each job to its previous_status if present, otherwise default
        // Because we can’t do status = previous_status in one update, do it per job (usually 0/1 anyway).
        for (const job of jobs || []) {
            const restoredJobStatus = job.previous_status || "pending";

            const { error: jobRestoreErr } = await supabase
            .from("jobs")
            .update({
                deleted_at: null,
                is_deleted: false,
                is_active: true,
                updated_at: now,
                status: restoredJobStatus,
                previous_status: null,
            })
            .eq("uuid", job.uuid);

            if (jobRestoreErr) {
            throw new Error(`Error restoring job ${job.uuid} for quote ${uuid}: ${jobRestoreErr.message}`);
            }
        }

        // 4) Restore quote
        const { data: restoredQuote, error: quoteRestoreErr } = await supabase
            .from("quotes")
            .update({
            deleted_at: null,
            is_deleted: false,
            is_active: true,
            updated_at: now,
            status: restoredQuoteStatus,
            previous_status: null,
            })
            .eq("uuid", uuid)
            .select("*")
            .single();

        if (quoteRestoreErr) {
            throw new Error(`Error restoring quote ${uuid}: ${quoteRestoreErr.message}`);
        }

        return restoredQuote;
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

    static async acceptQuote(uuid, customerUUID) {
        if (!uuid) {
            throw new Error("Quote UUID is required");
        }
        const now = new Date().toISOString();
        const { data, error } = await supabase
        .from("quotes")
        .update({ 
            status: 'accepted', 
            is_active: false,
            updated_at: now,
            responded_at: now,
            customer_uuid: customerUUID
        })
        .eq("uuid", uuid)
        .eq('is_expired', false)
        .eq('is_deleted', false)
        .is("responded_at", null) // ⭐ THIS IS THE MOST IMPORTANT LINE
        .select("*")
        .maybeSingle();

        if (error) throw new Error(`Error accepting quote: ${error.message}`);

        if (!data) {
            throw new Error("Quote already processed or locked");
        }
        return data;
    }

    static async rejectQuote(uuid) {
        const now = new Date().toISOString();
        const { data, error } = await supabase
            .from("quotes")
            .update({ status: 'rejected', updated_at: now, is_active: false, responded_at: now })
            .eq("uuid", uuid)
            .eq('is_expired', false)
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

    static async autoExpire(uuid) {
        if (!uuid) {
            throw new Error("Quote UUID is required");
        }

        const now = new Date().toISOString();

    /**
     * Only expire if:
     * - Quote is sent
     * - Not deleted
     * - Not already responded
     * - Expiry time passed
     */
        const { data, error } = await supabase
            .from("quotes")
            .update({
                status: "expired",
                is_expired: true,
                is_active: false,
                responded_at: now,
                updated_at: now
            })
            .eq("uuid", uuid)
            .eq("status", "sent")
            .eq("is_deleted", false)
            .eq("is_expired", false)
            .lte("expiry_end", now)
            .is("responded_at", null)
            .select("*")
            .maybeSingle();

        if (error) {
            throw new Error(`Error auto expiring quote: ${error.message}`);
        }

        if (!data) {
            throw new Error("Quote cannot be auto expired or already processed");
        }

        return data;
    }

    // static async dispatchQuote(uuid, payload, pdfBuffer) {
    //     if (!uuid) throw new Error("Quote UUID is required");

    //     const { data, error } = await supabase
    //         .from("quotes")
    //         .update({
    //         ...payload,
    //         quote_pdf_version: (payload.quote_pdf_version || 0) + 1,
    //         quote_sent_at: new Date().toISOString(),
    //         is_quote_sent_to_client: true,
    //         status: "sent",
    //         updated_at: new Date().toISOString()
    //         })
    //         .eq("uuid", uuid)
    //         .select("*")
    //         .single();

    //     if (error) throw new Error(error.message);

    //     return data;
    // }

    //original
    // static async dispatchQuote(uuid, payload, pdfBuffer) {
    //     if (!uuid) throw new Error("Quote UUID is required");
    //     if (!pdfBuffer) throw new Error("PDF buffer is required");

    //     // 1) Get current quote to determine next version
    //     const { data: existing, error: fetchError } = await supabase
    //         .from("quotes")
    //         .select("uuid, quote_pdf_version")
    //         .eq("uuid", uuid)
    //         .single();

    //     if (fetchError) throw new Error(fetchError.message);
    //     if (!existing) throw new Error("Quote not found");

    //     const currentVersion = Number(existing.quote_pdf_version ?? 1);
    //     const nextVersion = currentVersion + 1;

    //     // 2) Upload PDF to storage
    //     const filePath = `quotes/${uuid}/quote-v${nextVersion}.pdf`;

    //     const { error: uploadError } = await supabase.storage
    //         .from("quotes-pdf")
    //         .upload(filePath, pdfBuffer, {
    //         contentType: "application/pdf",
    //         upsert: true
    //         });

    //     if (uploadError) throw new Error(uploadError.message);

    //     // 3) Store PATH (recommended). If you want URL instead, see note below.
    //     const quote_pdf_url = filePath;

    //     // 4) Update quote record
    //     const { data: updated, error: updateError } = await supabase
    //         .from("quotes")
    //         .update({
    //         ...payload,
    //         quote_pdf_url,
    //         quote_pdf_version: nextVersion,
    //         quote_sent_at: new Date().toISOString(),
    //         is_quote_sent_to_client: true,
    //         status: "sent",
    //         updated_at: new Date().toISOString()
    //         })
    //         .eq("uuid", uuid)
    //         .select("*")
    //         .single();

    //     if (updateError) throw new Error(updateError.message);

    //     // Optional: return filePath too if you want rollback deletion support
    //     // return updated;
    //     return { updated, filePath };
    // }

    static async dispatchQuote(uuid, payload, pdfBuffer) {
        if (!uuid) throw new Error("Quote UUID is required");
        if (!pdfBuffer) throw new Error("PDF buffer is required");

        const { data: existing, error: fetchError } = await supabase
            .from("quotes")
            .select("uuid, quote_pdf_version")
            .eq("uuid", uuid)
            .single();

        if (fetchError) throw new Error(fetchError.message);
        if (!existing) throw new Error("Quote not found");

        const currentVersion = Number(existing.quote_pdf_version ?? 0);
        const nextVersion = currentVersion + 1;

        const filePath = `quotes/${uuid}/quote-v${nextVersion}.pdf`;

        const { error: uploadError } = await supabase.storage
            .from("quotes-pdf")
            .upload(filePath, pdfBuffer, {
            contentType: "application/pdf",
            upsert: true,
            });

        if (uploadError) throw new Error(uploadError.message);
        // store only storage path in DB
        const quote_pdf_url = filePath;

        const { data: updated, error: updateError } = await supabase
            .from("quotes")
            .update({
            ...payload,
            quote_pdf_url,
            quote_pdf_version: nextVersion,
            quote_sent_at: new Date().toISOString(),
            is_quote_sent_to_client: true,
            status: "sent",
            updated_at: new Date().toISOString(),
            })
            .eq("uuid", uuid)
            .select("*")
            .single();

        if (updateError) throw new Error(updateError.message);
        const { data: publicUrlData } = supabase.storage
            .from("quotes-pdf")
            .getPublicUrl(filePath);
            
        return {
            updated: {
            ...updated,
            quote_pdf_url: publicUrlData?.publicUrl || null,
            quote_pdf_storage_path: filePath,
            },
            filePath,
        };
        // return { updated, filePath };
    }

    // Quote model

    static async findSummaryByUUID(uuid) {
    if (!uuid) throw new Error("Quote UUID is required");

    const quoteSelect = [
      "uuid",
      "status",
      "total_amount",
      "updated_at",
      "contact_first_name",
      "contact_last_name",
      "contact_email",
      "address",
    ].join(",");

    const { data: quote, error: quoteErr } = await supabase
      .from("quotes")
      .select(quoteSelect)
      .eq("uuid", uuid)
      .eq("is_deleted", false)
      .maybeSingle();

    if (quoteErr) throw new Error(`Error fetching quote summary ${uuid}: ${quoteErr.message}`);
    if (!quote) return null;

    // Your DB enforces unique_job_per_quote, so this is max 1 row.
    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .select("uuid,is_recurring")
      .eq("quote_uuid", uuid)
      .eq("is_deleted", false)
      .maybeSingle();

    if (jobErr) throw new Error(`Error fetching job for quote ${uuid}: ${jobErr.message}`);

    let recurrence_count = 0;

    if (job?.uuid) {
      const { count, error: recErr } = await supabase
        .from("job_recurrences")
        .select("id", { count: "exact", head: true })
        .eq("job_uuid", job.uuid)
        .eq("is_deleted", false);

      if (recErr) throw new Error(`Error counting recurrences for job ${job.uuid}: ${recErr.message}`);
      recurrence_count = count ?? 0;
    }

    return {
      ...quote,
      has_job: !!job,
      is_recurring: job?.is_recurring ?? false,
      recurrence_count,
    };
  }

  /**
   * DETAILED (for quote detail page)
   * - full quote row (or you can reduce fields if you want)
   * - the linked job (0 or 1)
   * - job_recurrences for that job
   *
   * Returns:
   * {
   *   ...quoteColumns,
   *   job: { ...jobColumns, job_recurrences: [...] } | null
   * }
   */
    static async findDetailedByUUID(uuid) {
        if (!uuid) throw new Error("Quote UUID is required");

        // If you want to avoid pulling massive jsonb for details, replace "*" with explicit columns.
        const { data: quote, error: quoteErr } = await supabase
        .from("quotes")
        .select("*")
        .eq("uuid", uuid)
        .eq("is_deleted", false)
        .maybeSingle();

        if (quoteErr) throw new Error(`Error fetching quote ${uuid}: ${quoteErr.message}`);
        if (!quote) return null;

        // linked job (0 or 1 because unique_job_per_quote)
        const { data: job, error: jobErr } = await supabase
        .from("jobs")
        .select("*")
        .eq("quote_uuid", uuid)
        .eq("is_deleted", false)
        .maybeSingle();

        if (jobErr) throw new Error(`Error fetching job for quote ${uuid}: ${jobErr.message}`);

        // if no job, still return the quote
        if (!job) {
        return {
            ...quote,
            job: null,
        };
        }

        // fetch recurrences for that job
        const { data: recs, error: recErr } = await supabase
        .from("job_recurrences")
        .select("*")
        .eq("job_uuid", job.uuid)
        .eq("is_deleted", false)
        .order("scheduled_at", { ascending: true });

        if (recErr) throw new Error(`Error fetching recurrences for job ${job.uuid}: ${recErr.message}`);

        return {
        ...quote,
        job: {
            ...job,
            job_recurrences: recs || [],
        },
        };
    }
}