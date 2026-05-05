import { supabase } from '../config/db.js';
import { getQuotePdfPublicUrl } from '../util/getQuotePdfPublicUrl.js';
import { obfuscateName, obfuscateAddress, normalizePhone, buildSearchOr, phoneMatches } from "../util/util.js";

export default class Customer {

    static async countAllActive() {

        const { count, error } = await supabase()
            .from("customers")
            .select("*", { count: "exact", head: true })
            .is("deleted_at", null);

        if (error) {
            throw new Error(`Error counting customers: ${error.message}`);
        }

        return count || 0;
    }

    static async findCustomerByUUID (uuid) {
        const { data, error } = await supabase()
            .from("customers")
            .select("*")
            .eq("uuid", uuid)
            .is("deleted_at", null)
            .single();

        if (error) {
            throw new Error(error.message);
        }

        return data;
    };
    
    static async findQuotesByCustomerUUID(uuid) {
        if (!uuid) {
            throw new Error("Customer UUID is required");
        }

        const { data, error } = await supabase()
            .from("quotes")
            .select("*")
            .eq("customer_uuid", uuid)
            .eq("is_deleted", false)
            .order("created_at", { ascending: false });

        if (error) {
            throw new Error(
            `Error fetching quotes for customer with UUID ${uuid}: ${error.message}`
            );
        }

        const normalizedQuotes = await Promise.all(
            (data || []).map(async (quote) => {
            const rawPath =
                typeof quote.quote_pdf_storage_path === "string" &&
                quote.quote_pdf_storage_path.trim()
                ? quote.quote_pdf_storage_path
                : typeof quote.quote_pdf_url === "string" &&
                    quote.quote_pdf_url.trim()
                ? quote.quote_pdf_url
                : null;
                
            return {
                ...quote,
                quote_pdf_storage_path: rawPath,
                quote_pdf_url: await getQuotePdfPublicUrl(rawPath), // ✅ FIX
            };
            })
        );

        return normalizedQuotes;

    }

    static async findJobsByCustomerUUID(uuid) {
        if (!uuid) {
            throw new Error("Customer UUID is required");
        }

        const { data, error } = await supabase()
            .from("jobs")
            .select(`
                *,
                job_recurrences (*)
            `)
            .eq("customer_uuid", uuid)
            .eq("is_deleted", false)
            .order("created_at", { ascending: false });

        if (error) {
            throw new Error(`Error fetching jobs for customer with UUID ${uuid}: ${error.message}`);
        }

        return (data || []).map((job) => ({
            ...job,
            recurrences: job.job_recurrences || [],
        }));
    }

    static async searchSummary(query, limit = 10) {
        const rawQuery = String(query || "").trim();
        const terms = rawQuery.split(/\s+/).filter(Boolean);
        const normalizedPhone = normalizePhone(rawQuery);

        if (!rawQuery) return [];

        const isPhoneSearch = normalizedPhone.length >= 5;

        let data = [];
        let error = null;

        if (isPhoneSearch) {
            const result = await supabase()
            .from("customers")
            .select(`
                uuid,
                first_name,
                last_name,
                email,
                mobile_phone,
                landline_phone,
                address,
                created_at
            `)
            .order("created_at", { ascending: false })
            .limit(1000);

            data = result.data || [];
            error = result.error;
        } else {
            const orFilter = buildSearchOr(terms, [
            "uuid",
            "first_name",
            "last_name",
            "email",
            "mobile_phone",
            "landline_phone",
            "address",
            ]);

            const result = await supabase()
            .from("customers")
            .select(`
                uuid,
                first_name,
                last_name,
                email,
                mobile_phone,
                landline_phone,
                address,
                created_at
            `)
            .or(orFilter)
            .order("created_at", { ascending: false })
            .limit(limit);

            data = result.data || [];
            error = result.error;
        }

        if (error) throw error;

        if (!isPhoneSearch) return data || [];

        const filtered = (data || []).filter((row) =>
            phoneMatches(rawQuery, row.mobile_phone) ||
            phoneMatches(rawQuery, row.landline_phone)
        );

        return filtered.slice(0, limit);
    }

    static async findAllWithDetailsPaginated({
        page = 1,
        pageSize = 20,
    }) {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        const { data, error, count } = await supabase()
        .from("customers")
        .select(`
            *,
            businesses (*),
            quotes (*),
            jobs (
            *,
            invoices (
                *,
                payments (*)
            )
            )
        `, { count: "exact" })
        .range(from, to)
        .order("created_at", { ascending: false });

        if (error) {
        throw new Error(`Error fetching customers: ${error.message}`);
        }

        return { data, count };
    }

    //works fine 9/01/2026  
    static async findAll({ includeBusiness = false, isDeleted } = {}) {
        let query;
        
        if (includeBusiness) {
            query = supabase()
                .from('customers')
                .select(`
                    *,
                    businesses (
                        id,
                        uuid,
                        name,
                        business_landline_phone,
                        business_mobile_phone,
                        email,
                        address,
                        is_deleted,
                        created_at,
                        updated_at,
                        deleted_at
                    )
                `);
        } else {
            query = supabase()
                .from('customers')
                .select('*');
        }
        // OPTIONAL filter
        if (typeof isDeleted === 'boolean') {
            query = query.eq('is_deleted', isDeleted);
        }

        query = query.order('created_at', { ascending: true });

        const { data, error } = await query;

        if (error) {
            throw new Error(`Error fetching customers: ${error.message}`);
        }

        return data;

    }

    static async findByField(field, value) {
        const { data, error } = await supabase()
            .from('customers')
            .select('*')
            .eq(field, value);
        if (error) {
            throw new Error(`Error fetching customer with ${field}=${value}: ${error.message}`);
        }
        return  data;
        
    }   

    //works fine 9/01/2026  
    static async findByUUID(uuid) {
        if (!uuid) {
            throw new Error("Customer UUID is required");
        }
        const { data, error } = await supabase()
            .from('customers')
            .select('*')
            .eq("uuid", uuid)
            .maybeSingle();

        if (error) {
            throw new Error(`Error fetching customer with ${uuid}: ${error.message}`);
        }

        return data;
    
    }   

    //works fine 9/01/2026  
    static async findById(id) {
        if (!id) {
            throw new Error("Customer ID is required");
        }
        const { data, error } = await supabase()
            .from('customers')
            .select('*')
            .eq('id', id)
            .maybeSingle();
            // .single();
        if (error) {
            throw new Error(`Error fetching customer with ID ${id}: ${error.message}`);
        }
        return data;
        
    }

    //works fine
    static async create(customer) {
        if (!customer) {
            throw new Error("Customer data is required");
        }
        const { data, error } = await supabase()
            .from('customers')
            .insert([customer])
            .select()
            .single();
        if (error) {
            throw new Error(`Error creating customer: ${error.message}`);
        }

        return data;
    }

    //have not tested
    static async findByIdAndUpdate(id, customer) {
        if (!id) {
            throw new Error("Customer ID is required");
        }
        if (!customer) {
            throw new Error("Customer data is required");
        }
        const { data, error } = await supabase()
            .from('customers')
            .update(customer)
            .eq('id', id)
            .select("*")
            .single();
        if (error) {
            throw new Error(`Error updating customer with ID ${id}: ${error.message}`);
        }
        return data;
   
    }

     //works fine 9/01/2026 
    static async findByUUIDAndUpdate(uuid, customer) {
        if (!uuid) {
            throw new Error("Customer UUID is required");
        }
        if (!customer) {
            throw new Error("Customer data is required");
        }
        const { data, error } = await supabase()
        .from('customers')
        .update(customer)
        .eq('uuid', uuid)
        .select()
        .single()
         
        console.log({ data, error }, "in find cust by uuid and update");
        if (error) {
            throw new Error(`Error updating customer with UUID ${uuid}: ${error.message}`);
        }
        return data;
       
    }
    

  //hardcore delete
    static async delete(uuid) {
        if (!uuid) {
            throw new Error("Customer UUID is required");
        }
        const { data: customer, error: fetchError } = await supabase()
        .from('customers')
        .select('*')
        .eq('uuid', uuid)
        .maybeSingle(); // reading to check existence

        if (fetchError) {
            throw new Error(`Error fetching customer ${uuid}: ${fetchError.message}`);
        }
        if (!customer) {
            throw new Error(`Customer with UUID ${uuid} not found`);
        }

        const { data, error } = await supabase()
            .from('customers')
            .delete()
            .eq('uuid', uuid)
            .select("*")
            .single();
            
        if (error) {
            throw new Error(`Error deleting customer with UUID ${uuid}: ${error.message}`);
        }
        return data;
    }   
    //works fine 9/01/2026  
    static async softDeleteCustomer (uuid) {
        const now = new Date().toISOString();
        const { data, error } = await supabase()
            .from('customers')
            .update({ deleted_at: now, updated_at: now, is_deleted: true })
            .eq('uuid', uuid)
            .select("*")
            .maybeSingle();
        if (error) {
            throw new Error(`Error soft deleting customer with UUID ${uuid}: ${error.message}`);
        }
        return data;
    }

    static async reinstateCustomer(uuid) {
        const now = new Date().toISOString();
        const { data, error } = await supabase()
            .from('customers')
            .update({ deleted_at: null , updated_at: now , is_deleted: false})
            .eq('uuid', uuid)
            .select("*")
            .maybeSingle();
        if (error) {
            throw new Error(`Error reinstating customer with UUID ${uuid}: ${error.message}`);
        }
        return data;
   
    }

    static async findByEmail(email) {
        const cleanEmail = email?.toLowerCase().trim();
        const { data, error } = await supabase()
            .from('customers')
            .select('*')
            .eq('email', cleanEmail)
            .maybeSingle();

        if (error) {
            throw new Error(`Error fetching customer with email ${email}: ${error.message}`);
        }
        return data;

    }

    static async findByEmailAndName(email, firstName, lastName) {
        const cleanEmail = email?.toLowerCase().trim();
        const cleanFirst = firstName?.trim();
        const cleanLast = lastName?.trim();
        const { data, error } = await supabase()
            .from('customers')
            .select('*')
            .ilike('email', cleanEmail)
            .ilike('first_name', cleanFirst)
            .ilike('last_name', cleanLast)
            .eq("is_deleted", false)
            .maybeSingle();

        if (error) {
            throw new Error(`Error fetching customer with email ${cleanEmail}: ${error.message}`);
        }
        return data;

    }

    static async findByPhone(mobile, landline) {
    // Build OR condition for both columns
        const orCondition = [
        mobile && `mobile_phone.eq.${mobile}`,
        landline && `landline_phone.eq.${landline}`
        ].filter(Boolean);
        if (orCondition.length === 0) return null;

        const { data, error } = await supabase()
            .from('customers')
            .select('*')
            .or(orCondition.join(','))
            .maybeSingle();

        if (error) throw new Error(`Error fetching customer: ${error.message}`);
        if (!data) return null;

        // Determine which column matched
        let matchedType = [];
        if (mobile && data.mobile_phone === mobile) matchedType.push('mobile');
        if (landline && data.landline_phone === landline) matchedType.push('landline');
        return { data, matchedType };

    }   

    static async findByAddress(address) {
        const { data, error } = await supabase()
            .from('customers')
            .select('*')
            .eq('address', address)
            .maybeSingle();
        if (error) {
            throw new Error(`Error fetching customer with address ${address}: ${error.message}`);
        }
        return data;

    }   

    static async findByName(firstName, lastName) {
        const { data, error } = await supabase()
            .from('customers')
            .select('*')
            .eq('first_name', firstName)
            .eq('last_name', lastName)
            .maybeSingle();
        if (error) {
            throw new Error(`Error fetching customer with first name ${firstName} and last name ${lastName}: ${error.message}`);
        }
        return data;
       
    }

    static async findByBusinessUUID(business_uuid) {
        const { data, error } = await supabase()
            .from('customers')
            .select('*')
            .eq('business_uuid', business_uuid)
            .maybeSingle();
        if (error) {
            throw new Error(`Error fetching customers with business UUID ${business_uuid}: ${error.message}`);
        }
        return data;
        
    }   

    static async findOneCustomerWithDetails(uuid) {
        if (!uuid) return null;
        let query = supabase()
            .from('customers')
            .select(`
                *,
                businesses (*),
                quotes (*),
                jobs (*,
                    invoices (
                        *,
                        payments (*)
                    )
                )
            `)
            .eq("uuid", uuid)
            .order('created_at', { ascending: false })
            .maybeSingle();

        const { data, error } = await query;

        if (error) {
            throw new Error(`Error fetching customers with details: ${error.message}`);
        }
        return data;
    }

    //works fine 13/01/2025
    static async findAllWithDetails({ page = 1, pageSize = 20 }) {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        const { data, error, count } = await supabase()
            .from('customers')
            .select(`
                *,
                businesses (*),
                quotes (*),
                jobs (*,
                    invoices (
                        *,
                        payments (*)
                    )
                )
            `, { count: 'exact' })
            .range(from, to)
            .order('created_at', { ascending: false });

        if (error) throw new Error(`Error fetching customers: ${error.message}`);

        return { data, count };
    }
    /**
   * SUMMARY (for quick-find)
   * - lightweight customer fields
   * - quote_count, job_count, recurrence_count (computed counts only)
   *
   * Returns:
   * {
   *   uuid, first_name, last_name, email, address, mobile_phone, landline_phone,
   *   quote_count, job_count, recurrence_count
   * }
   */
    static async findSummaryByUUID(uuid) {
        if (!uuid) throw new Error("Customer UUID is required");

        const customerSelect = [
            "uuid",
            "first_name",
            "last_name",
            "email",
            "address",
            "mobile_phone",
            "landline_phone",
            "is_deleted",
            "is_blacklisted",
            "created_via",
        ].join(",");

        const { data: customer, error: custErr } = await supabase()
            .from("customers")
            .select(customerSelect)
            .eq("uuid", uuid)
            .eq("is_deleted", false)
            .maybeSingle();

        if (custErr) {
            throw new Error(`Error fetching customer summary ${uuid}: ${custErr.message}`);
        }

        if (!customer) return null;

        // Total quotes
        const { count: quoteCount, error: quoteErr } = await supabase()
            .from("quotes")
            .select("id", { count: "exact", head: true })
            .eq("customer_uuid", uuid)
            .eq("is_deleted", false);

        if (quoteErr) {
            throw new Error(`Error counting quotes for customer ${uuid}: ${quoteErr.message}`);
        }

        // Active quotes
        const { count: activeQuoteCount, error: activeQuoteErr } = await supabase()
            .from("quotes")
            .select("id", { count: "exact", head: true })
            .eq("customer_uuid", uuid)
            .eq("is_deleted", false)
            .eq("is_active", true);

        if (activeQuoteErr) {
            throw new Error(`Error counting active quotes for customer ${uuid}: ${activeQuoteErr.message}`);
        }

        // Latest quote created_at
        const { data: latestQuote, error: latestQuoteErr } = await supabase()
            .from("quotes")
            .select("created_at")
            .eq("customer_uuid", uuid)
            .eq("is_deleted", false)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (latestQuoteErr) {
            throw new Error(`Error fetching latest quote for customer ${uuid}: ${latestQuoteErr.message}`);
        }

        // Jobs list for counts + latest job
        const { data: jobs, error: jobsErr } = await supabase()
            .from("jobs")
            .select("uuid, status, is_completed, scheduled_at, created_at")
            .eq("customer_uuid", uuid)
            .eq("is_deleted", false);

        if (jobsErr) {
            throw new Error(`Error fetching jobs for customer ${uuid}: ${jobsErr.message}`);
        }

        const safeJobs = jobs || [];
        const jobUuids = safeJobs.map((j) => j.uuid);
        const jobCount = safeJobs.length;

        const pendingJobCount = safeJobs.filter((j) => j.status === "pending").length;

        const completedJobCount = safeJobs.filter(
            (j) => j.is_completed === true || j.status === "completed"
        ).length;

        const latestJobCreatedAt =
            safeJobs.length > 0
            ? safeJobs
                .map((j) => j.created_at)
                .filter(Boolean)
                .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null
            : null;

        const now = new Date();

        const nextScheduledJobAt =
            safeJobs
            .filter((j) => j.scheduled_at && new Date(j.scheduled_at) >= now)
            .sort(
                (a, b) =>
                new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
            )[0]?.scheduled_at || null;

        let recurrenceCount = 0;
        if (jobUuids.length > 0) {
            const { count, error: recErr } = await supabase()
            .from("job_recurrences")
            .select("id", { count: "exact", head: true })
            .in("job_uuid", jobUuids)
            .eq("is_deleted", false);

            if (recErr) {
            throw new Error(`Error counting recurrences for customer ${uuid}: ${recErr.message}`);
            }

            recurrenceCount = count ?? 0;
        }

        const latestActivityCandidates = [
            customer.created_at || null,
            latestQuote?.created_at || null,
            latestJobCreatedAt || null,
        ].filter(Boolean);

        const latestActivityAt =
            latestActivityCandidates.length > 0
            ? latestActivityCandidates.sort(
                (a, b) => new Date(b).getTime() - new Date(a).getTime()
                )[0]
            : null;

        return {
            ...customer,
            quote_count: quoteCount ?? 0,
            active_quote_count: activeQuoteCount ?? 0,
            job_count: jobCount,
            pending_job_count: pendingJobCount,
            completed_job_count: completedJobCount,
            recurrence_count: recurrenceCount,
            latest_quote_created_at: latestQuote?.created_at || null,
            latest_job_created_at: latestJobCreatedAt,
            next_scheduled_job_at: nextScheduledJobAt,
            latest_activity_at: latestActivityAt,
        };
    }

  /**
   * DETAILED (for customer detail page)
   * - full customer row
   * - all quotes for customer (non-deleted)
   * - all jobs for customer (non-deleted)
   * - job_recurrences nested under each job
   *
   * Returns:
   * {
   *   ...customerColumns,
   *   quotes: [...],
   *   jobs: [
   *     { ...job, job_recurrences: [...] }
   *   ]
   * }
   */

  static async findDetailedByUUID(uuid) {
    if (!uuid) throw new Error("Customer UUID is required");

    const { data: customer, error: custErr } = await supabase()
      .from("customers")
      .select("*")
      .eq("uuid", uuid)
      .eq("is_deleted", false)
      .maybeSingle();

    if (custErr) throw new Error(`Error fetching customer ${uuid}: ${custErr.message}`);
    if (!customer) return null;

    // Quotes (non-deleted)
    const { data: quotes, error: quotesErr } = await supabase()
      .from("quotes")
      .select("*")
      .eq("customer_uuid", uuid)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });

    if (quotesErr) throw new Error(`Error fetching quotes for customer ${uuid}: ${quotesErr.message}`);

    // Jobs (non-deleted)
    const { data: jobs, error: jobsErr } = await supabase()
      .from("jobs")
      .select("*")
      .eq("customer_uuid", uuid)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });

    if (jobsErr) throw new Error(`Error fetching jobs for customer ${uuid}: ${jobsErr.message}`);

    const jobUuids = (jobs || []).map((j) => j.uuid);

    // Fetch all recurrences for all jobs in one go
    let recurrences = [];
    if (jobUuids.length > 0) {
      const { data: recs, error: recErr } = await supabase()
        .from("job_recurrences")
        .select("*")
        .in("job_uuid", jobUuids)
        .eq("is_deleted", false)
        .order("scheduled_at", { ascending: true });

      if (recErr) throw new Error(`Error fetching recurrences for customer ${uuid}: ${recErr.message}`);
      recurrences = recs || [];
    }

    // Index recurrences by job_uuid
    const byJob = new Map();
    for (const r of recurrences) {
      const key = r.job_uuid;
      if (!byJob.has(key)) byJob.set(key, []);
      byJob.get(key).push(r);
    }

    const jobsWithRecs = (jobs || []).map((j) => ({
      ...j,
      job_recurrences: byJob.get(j.uuid) || [],
    }));

    return {
      ...customer,
      quotes: quotes || [],
      jobs: jobsWithRecs,
    };
  }

  static async findContactsByCustomerUUID(uuid) {
    if (!uuid) {
      throw new Error("Customer UUID is required");
    }
    const { data, error } = await supabase()
      .from("customer_contacts")
      .select("*")
      .eq("customer_uuid", uuid)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Error fetching contacts for customer with UUID ${uuid}: ${error.message}`);
    }
    return data || [];
  }
  
//   returns for below function{
//   ...customerFields,
//   quotes: [...],
//   jobs: [
//     {
//       ...jobFields,
//       job_recurrences: [...]
//     }
//   ],
//   inquiries: [...],
//   user: { ... } || null
// }
  static async findFullProfileByUUID(uuid) {
    if (!uuid) throw new Error("Customer UUID is required");

    // 1. Customer
    const { data: customer, error: customerError } = await supabase()
        .from("customers")
        .select("*")
        .eq("uuid", uuid)
        .eq("is_deleted", false)
        .maybeSingle();

    if (customerError) {
        throw new Error(`Error fetching customer ${uuid}: ${customerError.message}`);
    }

    if (!customer) return null;

    // 2. Quotes
    const { data: quotes, error: quotesError } = await supabase()
        .from("quotes")
        .select("*")
        .eq("customer_uuid", uuid)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

    if (quotesError) {
        throw new Error(`Error fetching quotes for customer ${uuid}: ${quotesError.message}`);
    }

    // 3. Jobs
    const { data: jobs, error: jobsError } = await supabase()
        .from("jobs")
        .select("*")
        .eq("customer_uuid", uuid)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

    if (jobsError) {
        throw new Error(`Error fetching jobs for customer ${uuid}: ${jobsError.message}`);
    }

    const safeJobs = jobs || [];
    const jobUuids = safeJobs.map((job) => job.uuid);

    // 4. Recurrences for all jobs
    let recurrences = [];
    if (jobUuids.length > 0) {
        const { data: recurrenceData, error: recurrencesError } = await supabase()
        .from("job_recurrences")
        .select("*")
        .in("job_uuid", jobUuids)
        .eq("is_deleted", false)
        .order("scheduled_at", { ascending: true });

        if (recurrencesError) {
        throw new Error(`Error fetching recurrences for customer ${uuid}: ${recurrencesError.message}`);
        }

        recurrences = recurrenceData || [];
    }

    const recurrencesByJobUUID = new Map();
    for (const recurrence of recurrences) {
        const key = recurrence.job_uuid;
        if (!recurrencesByJobUUID.has(key)) {
        recurrencesByJobUUID.set(key, []);
        }
        recurrencesByJobUUID.get(key).push(recurrence);
    }

    const jobsWithRecurrences = safeJobs.map((job) => ({
        ...job,
        job_recurrences: recurrencesByJobUUID.get(job.uuid) || [],
    }));

    // 5. Inquiries
    const { data: inquiries, error: inquiriesError } = await supabase()
        .from("inquiries")
        .select("*")
        .eq("customer_uuid", uuid)
        .order("created_at", { ascending: false });

    if (inquiriesError) {
        throw new Error(`Error fetching inquiries for customer ${uuid}: ${inquiriesError.message}`);
    }

    // 6. Linked user (if one exists)
    const { data: user, error: userError } = await supabase()
        .from("users")
        .select(`
        uuid,
        auth_user_id,
        customer_uuid,
        first_name,
        last_name,
        email,
        role,
        created_at,
        updated_at
        `)
        .eq("customer_uuid", uuid)
        .maybeSingle();

    if (userError) {
        throw new Error(`Error fetching linked user for customer ${uuid}: ${userError.message}`);
    }

    return {
        ...customer,
        quotes: quotes || [],
        jobs: jobsWithRecurrences,
        inquiries: inquiries || [],
        user: user || null,
    };
    }

}