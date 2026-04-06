import { supabase } from '../config/db.js';
import { obfuscateName, obfuscateAddress } from "../util/util.js";
import crypto from "crypto";
import { buildSearchOr, clampInt } from '../util/util.js';

export default class Job {

  static async listScheduledOccurrences({
    scheduledPreset,
    scheduledStart,
    scheduledEnd,
    limit = 100,
    page = 1,
  } = {}) {
    const safeLimit = clampInt(limit, 100, 1, 500);
    const safePage = clampInt(page, 1, 1, 999999);

    const from = (safePage - 1) * safeLimit;
    const to = from + safeLimit - 1;

    const normalizedPreset =
      typeof scheduledPreset === "string" && scheduledPreset.trim()
        ? scheduledPreset.trim().toLowerCase()
        : null;

    let rangeStart = null;
    let rangeEnd = null;

    const startOfDay = (date) => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const endOfDay = (date) => {
      const d = new Date(date);
      d.setHours(23, 59, 59, 999);
      return d;
    };

    const addDays = (date, days) => {
      const d = new Date(date);
      d.setDate(d.getDate() + days);
      return d;
    };

    const today = new Date();

    if (normalizedPreset === "today") {
      rangeStart = startOfDay(today).toISOString();
      rangeEnd = endOfDay(today).toISOString();
    } else if (normalizedPreset === "day_prior") {
      const tomorrow = addDays(today, 1);
      rangeStart = startOfDay(tomorrow).toISOString();
      rangeEnd = endOfDay(tomorrow).toISOString();
    } else if (normalizedPreset === "seven_days_prior") {
      const sevenDays = addDays(today, 7);
      rangeStart = startOfDay(sevenDays).toISOString();
      rangeEnd = endOfDay(sevenDays).toISOString();
    } else {
      if (scheduledStart) {
        rangeStart = startOfDay(scheduledStart).toISOString();
      }
      if (scheduledEnd) {
        rangeEnd = endOfDay(scheduledEnd).toISOString();
      }
    }

    // 1) Non-recurring scheduled jobs from jobs table
    let jobsQuery = supabase()
      .from("jobs")
      .select(
        `
        uuid,
        status,
        scheduled_at,
        created_at,
        updated_at,
        subtotal_amount,
        gst_amount,
        total_amount,
        has_urgent_fee,
        urgent_fee_amount,
        job_address,
        is_recurring,
        recurrence_frequency,
        recurrence_interval,
        recurrence_end_date,
        services,
        quote:quotes (
          uuid,
          contact_first_name,
          contact_last_name,
          contact_email
        ),
        customer:customers (
          uuid,
          first_name,
          last_name,
          email,
          mobile_phone,
          landline_phone
        )
        `
      )
      .eq("is_deleted", false)
      .eq("is_completed", false)
      .not("status", "in", '("completed","cancelled")')
      .eq("is_recurring", false)
      .not("scheduled_at", "is", null);

    if (rangeStart) jobsQuery = jobsQuery.gte("scheduled_at", rangeStart);
    if (rangeEnd) jobsQuery = jobsQuery.lte("scheduled_at", rangeEnd);

    const { data: baseJobs, error: baseJobsError } = await jobsQuery;

    if (baseJobsError) {
      throw new Error(`Error fetching scheduled jobs: ${baseJobsError.message}`);
    }

    // 2) Recurring occurrences from job_recurrences joined to parent jobs
    let recurrenceQuery = supabase()
      .from("job_recurrences")
      .select(
        `
        id,
        uuid,
        job_uuid,
        scheduled_at,
        status,
        is_completed,
        is_deleted,
        completed_date,
        scheduled_window_mins,
        scheduled_window_preset,
        created_at,
        updated_at,
        services,
        subtotal_amount,
        gst_amount,
        total_amount,
        jobs!inner (
          uuid,
          status,
          created_at,
          updated_at,
          subtotal_amount,
          gst_amount,
          total_amount,
          has_urgent_fee,
          urgent_fee_amount,
          job_address,
          is_recurring,
          recurrence_frequency,
          recurrence_interval,
          recurrence_end_date,
          services,
          is_deleted,
          is_completed,
          quote:quotes (
            uuid,
            contact_first_name,
            contact_last_name,
            contact_email
          ),
          customer:customers (
            uuid,
            first_name,
            last_name,
            email,
            mobile_phone,
            landline_phone
          )
        )
        `
      )
      .eq("is_deleted", false)
      .eq("is_completed", false)
      .not("status", "in", '("completed","missed")')
      .eq("jobs.is_deleted", false)
      .eq("jobs.is_recurring", true)
      .not("scheduled_at", "is", null);

    if (rangeStart) recurrenceQuery = recurrenceQuery.gte("scheduled_at", rangeStart);
    if (rangeEnd) recurrenceQuery = recurrenceQuery.lte("scheduled_at", rangeEnd);

    const { data: recurrenceRows, error: recurrenceError } = await recurrenceQuery;

    if (recurrenceError) {
      throw new Error(
        `Error fetching recurring scheduled jobs: ${recurrenceError.message}`
      );
    }

    const flattenedBaseJobs = (baseJobs || []).map((job) => ({
      kind: "job",
      job_uuid: job.uuid,
      recurrence_uuid: null,
      recurrence_id: null,
      uuid: job.uuid,
      status: job.status,
      scheduled_at: job.scheduled_at,
      created_at: job.created_at || null,
      updated_at: job.updated_at || null,
      subtotal_amount: job.subtotal_amount ?? 0,
      gst_amount: job.gst_amount ?? 0,
      total_amount: job.total_amount ?? 0,
      has_urgent_fee: Boolean(job.has_urgent_fee),
      urgent_fee_amount: Number(job.urgent_fee_amount ?? 0),
      address: job.job_address || null,
      job_address: job.job_address || null,
      is_recurring: false,
      recurrence_frequency: job.recurrence_frequency || null,
      recurrence_interval: job.recurrence_interval || null,
      recurrence_end_date: job.recurrence_end_date || null,
      schedule_label: null,
      services: job.services || [],
      quote: job.quote || null,
      customer: job.customer || null,
    }));

    const flattenedRecurrences = (recurrenceRows || []).map((row) => ({
      kind: "recurrence",
      job_uuid: row.job_uuid,
      recurrence_uuid: row.uuid,
      recurrence_id: row.id,
      uuid: row.jobs?.uuid || row.job_uuid,
      status: row.status || "scheduled",
      scheduled_at: row.scheduled_at,
      created_at: row.created_at || row.jobs?.created_at || null,
      updated_at: row.updated_at || row.jobs?.updated_at || null,
      subtotal_amount: row.subtotal_amount ?? row.jobs?.subtotal_amount ?? 0,
      gst_amount: row.gst_amount ?? row.jobs?.gst_amount ?? 0,
      total_amount: row.total_amount ?? row.jobs?.total_amount ?? 0,
      has_urgent_fee: Boolean(row.jobs?.has_urgent_fee),
      urgent_fee_amount: Number(row.jobs?.urgent_fee_amount ?? 0),
      address: row.jobs?.job_address || null,
      job_address: row.jobs?.job_address || null,
      is_recurring: true,
      recurrence_frequency: row.jobs?.recurrence_frequency || null,
      recurrence_interval: row.jobs?.recurrence_interval || null,
      recurrence_end_date: row.jobs?.recurrence_end_date || null,
      schedule_label: null,
      services: row.services || row.jobs?.services || [],
      quote: row.jobs?.quote || null,
      customer: row.jobs?.customer || null,
    }));

    const merged = [...flattenedBaseJobs, ...flattenedRecurrences].sort((a, b) => {
      const aTime = new Date(a.scheduled_at || 0).getTime();
      const bTime = new Date(b.scheduled_at || 0).getTime();
      return aTime - bTime;
    });

    const total = merged.length;
    const paged = merged.slice(from, to + 1);

    return {
      jobs: paged,
      total,
      totalCount: total,
      page: safePage,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
      limit: safeLimit,
    };
  }

  static async findJobByCustomerUUID(customerUuid) {
    if (!customerUuid) return [];

    const { data, error } = await supabase()
      .from("jobs")
      .select(`*`)
      .eq("customer_uuid", customerUuid)
      .eq("is_deleted", false)
      .is("deleted_at", null)
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) throw error;

    const jobs = data || [];
    if (!jobs.length) return [];

    const jobUuids = jobs.map((job) => job.uuid);

    const { data: recurrences, error: recurrenceError } = await supabase()
      .from("job_recurrences")
      .select(`*`)
      .in("job_uuid", jobUuids)
      .eq("is_deleted", false)
      .order("scheduled_at", { ascending: true });

    if (recurrenceError) throw recurrenceError;

    const recurrenceMap = new Map();

    for (const recurrence of recurrences || []) {
      if (!recurrenceMap.has(recurrence.job_uuid)) {
        recurrenceMap.set(recurrence.job_uuid, []);
      }
      recurrenceMap.get(recurrence.job_uuid).push(recurrence);
    }

    return jobs.map((job) => ({
      ...job,
      job_recurrences: recurrenceMap.get(job.uuid) || [],
    }));
  }

  static async countActiveJobs() {
    const { count, error } = await supabase()
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("is_deleted", false)
      .is("deleted_at", null)
      .eq("is_completed", false)
      .is("completed_date", null)
      .not("status", "in", '("completed","cancelled")');

    if (error) {
      throw new Error(`Error counting active jobs: ${error.message}`);
    }

    return count || 0;
  }

  static async countUpcomingJobs({ days = 7 } = {}) {
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + days);

    const { count, error } = await supabase()
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("is_deleted", false)
      .is("deleted_at", null)
      .eq("is_completed", false)
      .is("completed_date", null)
      .not("scheduled_at", "is", null)
      .gte("scheduled_at", now.toISOString())
      .lt("scheduled_at", future.toISOString())
      .not("status", "in", '("completed","cancelled")');

    if (error) {
      throw new Error(`Error counting upcoming jobs: ${error.message}`);
    }

    return count || 0;
  }

  static async findPublicViewByUUID(uuid) {

    if (!uuid) {
      throw new Error("Job UUID is required");
    }

    const { data: job, error } = await supabase()
      .from("jobs")
      .select(`
        uuid,
        status,
        services,
        subtotal_amount,
        gst_amount,
        has_urgent_fee,
        urgent_fee_amount,
        total_amount,
        scheduled_at,
        scheduled_window_mins,
        scheduled_window_preset,
        is_recurring,
        recurrence_frequency,
        recurrence_interval,
        recurrence_end_date,
        job_address,
        client_schedule_message,
        is_completed,
        completed_date,
        job_images,
        customer:customers (
          first_name,
          last_name
        )
      `)
      .eq("uuid", uuid)
      .eq("is_deleted", false)
      .single();

    if (error) {
      throw new Error(`Error fetching public job view: ${error.message}`);
    }

    let jobRecurrences = [];

    if (job?.is_recurring) {
      const { data: recurrences, error: recurrenceError } = await supabase()
        .from("job_recurrences")
        .select(`
          uuid,
          scheduled_at,
          scheduled_window_mins,
          scheduled_window_preset,
          status,
          is_completed,
          completed_date
        `)
        .eq("job_uuid", uuid)
        .eq("is_deleted", false)
        .order("scheduled_at", { ascending: true });

      if (recurrenceError) {
        throw new Error(`Error fetching job recurrences: ${recurrenceError.message}`);
      }

      jobRecurrences = recurrences || [];
    }

    return {
      ...job,
      customer: job?.customer
        ? {
            first_name: obfuscateName(job.customer.first_name),
            last_name: obfuscateName(job.customer.last_name),
          }
        : null,
      job_address: obfuscateAddress(job?.job_address),
      recurrence_count: jobRecurrences.length,
      recurrence_summary: job?.is_recurring
        ? `${job.recurrence_frequency || "Recurring"}`
        : "One-off",
      job_recurrences: jobRecurrences,
      limited: true,
    };
  }

  static async markClientScheduleMessageSent(uuid) {
    const { data, error } = await supabase()
      .from("jobs")
      .update({
        client_schedule_message_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("uuid", uuid)
      .select("uuid, client_schedule_message_sent_at")
      .single();

    if (error) {
      throw new Error(`Failed to mark client schedule message sent: ${error.message}`);
    }

    return data;
  }

    static async searchSummary(query, limit = 10) {
      const terms = String(query || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

      if (terms.length === 0) return [];

      const loweredTerms = terms.map((t) => t.toLowerCase());

      const baseSelect = `
        uuid,
        customer_uuid,
        quote_uuid,
        status,
        job_address,
        scheduled_at,
        total_amount,
        created_at,
        customer:customers!jobs_customer_fk (
          uuid,
          first_name,
          last_name,
          email,
          mobile_phone,
          landline_phone,
          address
        ),
        quote:quotes!jobs_quote_fk (
          uuid,
          contact_first_name,
          contact_last_name,
          contact_email,
          contact_mobile,
          contact_landline,
          address
        )
      `;

      // A) direct jobs
      const jobOrFilter = buildSearchOr(terms, [
        "uuid",
        "job_address",
        // "status",
        "notes",
      ]);

      const { data: directJobs, error: directJobsError } = await supabase()
        .from("jobs")
        .select(baseSelect)
        .or(jobOrFilter)
        .order("created_at", { ascending: false })
        .limit(limit * 2);

      if (directJobsError) throw directJobsError;

      // B) matching quotes
      const quoteOrFilter = buildSearchOr(terms, [
        "uuid",
        "contact_first_name",
        "contact_last_name",
        "contact_email",
        "contact_mobile",
        "contact_landline",
        "address",
      ]);

      const { data: matchingQuotes, error: matchingQuotesError } = await supabase()
        .from("quotes")
        .select("uuid")
        .or(quoteOrFilter)
        .limit(limit * 5);

      if (matchingQuotesError) throw matchingQuotesError;

      const quoteUUIDs = [
        ...new Set((matchingQuotes || []).map((q) => q.uuid).filter(Boolean)),
      ];

      let quoteJobs = [];
      if (quoteUUIDs.length > 0) {
        const { data, error } = await supabase()
          .from("jobs")
          .select(baseSelect)
          .in("quote_uuid", quoteUUIDs)
          .order("created_at", { ascending: false })
          .limit(limit * 2);

        if (error) throw error;
        quoteJobs = data || [];
      }

      // C) matching customers
      const customerOrFilter = buildSearchOr(terms, [
        "uuid",
        "first_name",
        "last_name",
        "email",
        "mobile_phone",
        "landline_phone",
        "address",
      ]);

      const { data: matchingCustomers, error: matchingCustomersError } = await supabase()
        .from("customers")
        .select("uuid")
        .or(customerOrFilter)
        .limit(limit * 5);

      if (matchingCustomersError) throw matchingCustomersError;

      const customerUUIDs = [
        ...new Set((matchingCustomers || []).map((c) => c.uuid).filter(Boolean)),
      ];

      let customerJobs = [];
      if (customerUUIDs.length > 0) {
        const { data, error } = await supabase()
          .from("jobs")
          .select(baseSelect)
          .in("customer_uuid", customerUUIDs)
          .order("created_at", { ascending: false })
          .limit(limit * 2);

        if (error) throw error;
        customerJobs = data || [];
      }

      // D) merge + dedupe
      const mergedMap = new Map();

      [...(directJobs || []), ...quoteJobs, ...customerJobs].forEach((job) => {
        if (job?.uuid) mergedMap.set(job.uuid, job);
      });

      const merged = Array.from(mergedMap.values());

      // E) final relevance filter
      const filtered = merged.filter((job) => {
        const customer = job.customer || {};
        const quote = job.quote || {};

        const haystack = [
          job.uuid,
          job.status,
          job.job_address,
          customer.uuid,
          customer.first_name,
          customer.last_name,
          customer.email,
          customer.mobile_phone,
          customer.landline_phone,
          customer.address,
          quote.uuid,
          quote.contact_first_name,
          quote.contact_last_name,
          quote.contact_email,
          quote.contact_mobile,
          quote.contact_landline,
          quote.address,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return loweredTerms.every((term) => haystack.includes(term));
      });

      return filtered.slice(0, limit);
  }

  // Get all jobs
  static async findAll() {
    const { data, error } = await supabase()
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw new Error(`Error fetching jobs: ${error.message}`);
    return data;
  }

  static async findByUUID(uuid) {
    if (!uuid) throw new Error("Job UUID is required");

    const { data, error } = await supabase()
      .from("jobs")
      .select(
        `
          *,
          job_recurrences:job_recurrences (
            *
          )
        `
      )
      .eq("uuid", uuid)
      .eq("is_deleted", false)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    return {
      ...data,
      job_recurrences: (data.job_recurrences || []).filter((r) => r.is_deleted === false),
    };
  }

  static async updateScheduleByUUID(uuid, updates = {}) {
    if (!uuid) {
      throw new Error("Job UUID is required");
    }

    const updatePayload = {
      updated_at: new Date().toISOString(),
    };

    if (updates.scheduled_at !== undefined) {
      updatePayload.scheduled_at = updates.scheduled_at;
    }

    if (updates.scheduled_window_mins !== undefined) {
      updatePayload.scheduled_window_mins = updates.scheduled_window_mins;
    }

    if (updates.scheduled_window_preset !== undefined) {
      updatePayload.scheduled_window_preset = updates.scheduled_window_preset;
    }

    if (updates.is_recurring !== undefined) {
      updatePayload.is_recurring = updates.is_recurring;
    }

    if (updates.recurrence_frequency !== undefined) {
      updatePayload.recurrence_frequency = updates.recurrence_frequency;
    }

    if (updates.recurrence_interval !== undefined) {
      updatePayload.recurrence_interval = updates.recurrence_interval;
    }

    if (updates.recurrence_end_date !== undefined) {
      updatePayload.recurrence_end_date = updates.recurrence_end_date;
    }

    if (updates.notes !== undefined) {
      updatePayload.notes = updates.notes;
    }

    if (updates.client_schedule_message !== undefined) {
      updatePayload.client_schedule_message = updates.client_schedule_message;
    }

    if (updates.status !== undefined) {
      updatePayload.status = updates.status;
    }

    const { data, error } = await supabase()
      .from("jobs")
      .update(updatePayload)
      .eq("uuid", uuid)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Error updating job schedule: ${error.message}`);
    }

    return data;
  }

  static async createFromQuote({
      quote,
      uuid,
      scheduled_at,
      is_recurring,
      recurrence_interval,
      recurrence_frequency,
      recurrence_end_date,
      customer_uuid,
    }) {
      if (!quote) {
        throw new Error("Quote is required to create a job");
      }

      const normalizedRecurrenceFrequency =
        quote.recurrence_frequency ||
        recurrence_frequency ||
        "one_off";

      const normalizedIsRecurring =
        typeof is_recurring === "boolean"
          ? is_recurring
          : normalizedRecurrenceFrequency !== "one_off";

      const normalizedRecurrenceInterval =
        recurrence_interval ??
        (normalizedRecurrenceFrequency === "weekly"
          ? 1
          : normalizedRecurrenceFrequency === "fortnightly"
          ? 2
          : normalizedRecurrenceFrequency === "monthly"
          ? 1
          : null);

      const now = new Date().toISOString();

      const { data, error } = await supabase()
        .from("jobs")
        .insert([
          {
            uuid,
            customer_uuid,
            quote_uuid: quote.uuid,
            services: quote.services ?? [],

            subtotal_amount: quote.subtotal_amount ?? 0,
            gst_amount: quote.gst_amount ?? 0,
            total_amount: quote.total_amount ?? 0,

            has_urgent_fee: quote.has_urgent_fee ?? false,
            urgent_fee_amount: quote.urgent_fee_amount ?? 0,

            job_address: quote.address ?? null,
            scheduled_at: scheduled_at ? new Date(scheduled_at).toISOString() : null,
            is_recurring: normalizedIsRecurring,
            recurrence_interval: normalizedRecurrenceInterval,
            recurrence_frequency: normalizedRecurrenceFrequency,
            recurrence_end_date: recurrence_end_date ?? null,
            status: scheduled_at ? "scheduled" : "pending",
            created_at: now,
            updated_at: now,
          },
        ])
        .select("*")
        .single();

      if (error) throw new Error(`Error creating job: ${error.message}`);
      return data;
    }

    static async updateByUUID(uuid, updates) {
        const { data, error } = await supabase()
            .from('jobs')
            .update(updates)
            .eq("uuid", uuid)
            .select('*')
            .maybeSingle();

        if (error) throw new Error(`Error updating job: ${error.message}`);
        return data;
    }

    static async deleteByUUID(uuid) {
        const { data, error } = await supabase()
            .from('jobs')
            .delete()
            .eq("uuid", uuid)
            .select('*')
            .maybeSingle();

        if (error) throw new Error(`Error deleting job: ${error.message}`);
        return data;
    }

    static async findJobByQuoteUUID(quote_uuid) {
        const { data, error } = await supabase()
            .from('jobs')
            .select('*')
            .eq('quote_uuid', quote_uuid)
            .maybeSingle();

        if (error) throw new Error(`Error fetching job with quote UUID ${quote_uuid}: ${error.message}`);
        return data;
    }

    static async deleteByQuoteUUID(quote_uuid) {
        const { data, error } = await supabase()
            .from('jobs')
            .delete()
            .eq('quote_uuid', quote_uuid)
            .select('*')
            .maybeSingle();

        if (error) throw new Error(`Error fetching job with quote UUID ${quote_uuid}: ${error.message}`);
        return data;
    }

  //   static async list({ status, limit = 5, page = 1, olderThanDays = null }) {
  //   const safeLimit = clampInt(limit, 5, 1, 50);
  //   const safePage = clampInt(page, 1, 1, 999999);

  //   const hasOlderThanFilter =
  //       olderThanDays !== null &&
  //       olderThanDays !== undefined &&
  //       olderThanDays !== "" &&
  //       !Number.isNaN(Number(olderThanDays));

  //   const safeOlder = hasOlderThanFilter
  //       ? clampInt(olderThanDays, 30, 0, 3650)
  //       : null;

  //   const from = (safePage - 1) * safeLimit;
  //   const to = from + safeLimit - 1;

  //   const olderThanIso =
  //       safeOlder !== null && safeOlder > 0
  //           ? new Date(Date.now() - safeOlder * 24 * 60 * 60 * 1000).toISOString()
  //           : null;

  //   let q = supabase()
  //       .from("jobs")
  //       .select(
  //           `
  //           *,
  //           quote:quotes (
  //               uuid,
  //               contact_first_name,
  //               contact_last_name
  //           ),
  //           job_recurrences:job_recurrences (
  //               *
  //           )
  //           `,
  //           { count: "exact" }
  //       )
  //       .eq("is_deleted", false)
  //       .order("created_at", { ascending: false });

  //   if (status && typeof status === "string" && status.trim()) {
  //       q = q.eq("status", status.trim());
  //   }

  //   if (olderThanIso) {
  //       q = q.lte("created_at", olderThanIso);
  //   }

  //   const { data, error, count } = await q.range(from, to);
  //   if (error) throw new Error(error.message);

  //   const jobs = (data || []).map((job) => ({
  //       ...job,
  //       job_recurrences: (job.job_recurrences || []).filter(
  //           (r) => r.is_deleted === false
  //       ),
  //   }));

  //   const totalCount = count || 0;
  //   const totalPages = Math.max(1, Math.ceil(totalCount / safeLimit));

  //   return {
  //       jobs,
  //       page: safePage,
  //       totalPages,
  //       totalCount,
  //       limit: safeLimit,
  //   };
  // }

  
    // static async list({ status, limit = 5, page = 1, olderThanDays = 30 }) {
    //     const safeLimit = clampInt(limit, 5, 1, 50);
    //     const safePage = clampInt(page, 1, 1, 999999);
    //     const safeOlder = clampInt(olderThanDays, 30, 0, 3650);

    //     const from = (safePage - 1) * safeLimit;
    //     const to = from + safeLimit - 1;

    //     const olderThanIso =
    //     safeOlder > 0
    //         ? new Date(Date.now() - safeOlder * 24 * 60 * 60 * 1000).toISOString()
    //         : null;

    //     // ✅ jobs.* and nested job_recurrences (filtered client-side to non-deleted)
    //     // Supabase() doesn't support filtering nested selects super cleanly without RPC,
    //     // so we fetch them and filter in JS.
    //     let q = supabase()
    //     .from("jobs")
    //     .select(
    //         `
    //         *,
    //         quote:quotes (
    //             uuid,
    //             contact_first_name,
    //             contact_last_name
    //         ),
    //         job_recurrences:job_recurrences (
    //             *
    //         )
    //         `,
    //         { count: "exact" }
    //     )
    //     .eq("is_deleted", false)
    //     .order("created_at", { ascending: false });

    //     if (status) q = q.eq("status", status);
    //     if (olderThanIso) q = q.lte("created_at", olderThanIso);

    //     const { data, error, count } = await q.range(from, to);
    //     if (error) throw new Error(error.message);

    //     // ✅ Filter out deleted recurrences in JS
    //     const jobs = (data || []).map((job) => ({
    //     ...job,
    //     job_recurrences: (job.job_recurrences || []).filter((r) => r.is_deleted === false),
    //     }));

    //     const totalCount = count || 0;
    //     const totalPages = Math.max(1, Math.ceil(totalCount / safeLimit));

    //     return {
    //         jobs,
    //         page: safePage,
    //         totalPages,
    //         totalCount,
    //         limit: safeLimit,
    //     };
    // }

    // Backfill jobs.job_address from quotes.address for jobs where job_address is null
    
  static async list({
      status,
      search,
      scheduledPreset,
      scheduledStart,
      scheduledEnd,
      limit = 50,
      page = 1,
      olderThanDays = null,
    }) {
      const safeLimit = clampInt(limit, 50, 1, 200);
      const safePage = clampInt(page, 1, 1, 999999);

      const hasOlderThanFilter =
        olderThanDays !== null &&
        olderThanDays !== undefined &&
        olderThanDays !== "" &&
        !Number.isNaN(Number(olderThanDays));

      const safeOlder = hasOlderThanFilter
        ? clampInt(olderThanDays, 30, 0, 3650)
        : null;

      const from = (safePage - 1) * safeLimit;
      const to = from + safeLimit - 1;

      const olderThanIso =
        safeOlder !== null && safeOlder > 0
          ? new Date(Date.now() - safeOlder * 24 * 60 * 60 * 1000).toISOString()
          : null;

      const normalizedStatus =
        typeof status === "string" && status.trim()
          ? status.trim().toLowerCase()
          : null;

      const normalizedSearch =
        typeof search === "string" && search.trim()
          ? search.trim().toLowerCase()
          : null;

      const normalizedPreset =
        typeof scheduledPreset === "string" && scheduledPreset.trim()
          ? scheduledPreset.trim().toLowerCase()
          : null;

      const normalizedScheduledStart =
        typeof scheduledStart === "string" && scheduledStart.trim()
          ? scheduledStart.trim()
          : null;

      const normalizedScheduledEnd =
        typeof scheduledEnd === "string" && scheduledEnd.trim()
          ? scheduledEnd.trim()
          : null;

      const allowedPresets = ["today", "day_prior", "seven_days_prior"];
      if (normalizedPreset && !allowedPresets.includes(normalizedPreset)) {
        throw new Error(
          "scheduledPreset must be one of: today, day_prior, seven_days_prior"
        );
      }

      let q = supabase()
        .from("jobs")
        .select(
          `
          *,
          quote:quotes (
            uuid,
            contact_first_name,
            contact_last_name,
            contact_email,
            contact_mobile,
            contact_landline,
            address
          ),
          customer:customers (
            uuid,
            first_name,
            last_name,
            email,
            mobile_phone,
            landline_phone,
            address
          ),
          job_recurrences:job_recurrences (
            *
          )
          `,
          { count: "exact" }
        )
        .eq("is_deleted", false)
        .order("scheduled_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (normalizedStatus) {
        q = q.eq("status", normalizedStatus);
      }

      if (olderThanIso) {
        q = q.lte("created_at", olderThanIso);
      }

      if (normalizedScheduledStart) {
        q = q.gte("scheduled_at", `${normalizedScheduledStart}T00:00:00.000Z`);
      }

      if (normalizedScheduledEnd) {
        q = q.lte("scheduled_at", `${normalizedScheduledEnd}T23:59:59.999Z`);
      }

      if (normalizedPreset === "today") {
        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const end = new Date();
        end.setHours(23, 59, 59, 999);

        q = q.gte("scheduled_at", start.toISOString()).lte("scheduled_at", end.toISOString());
      }

      if (normalizedPreset === "day_prior") {
        const start = new Date();
        start.setDate(start.getDate() + 1);
        start.setHours(0, 0, 0, 0);

        const end = new Date();
        end.setDate(end.getDate() + 1);
        end.setHours(23, 59, 59, 999);

        q = q.gte("scheduled_at", start.toISOString()).lte("scheduled_at", end.toISOString());
      }

      if (normalizedPreset === "seven_days_prior") {
        const start = new Date();
        start.setDate(start.getDate() + 7);
        start.setHours(0, 0, 0, 0);

        const end = new Date();
        end.setDate(end.getDate() + 7);
        end.setHours(23, 59, 59, 999);

        q = q.gte("scheduled_at", start.toISOString()).lte("scheduled_at", end.toISOString());
      }

      const { data, error, count } = await q.range(from, to);

      if (error) {
        throw new Error(`Error fetching jobs: ${error.message}`);
      }

      let jobs = (data || []).map((job) => {
        const safeRecurrences = (job.job_recurrences || []).filter(
          (r) => r.is_deleted === false
        );

        const customerFirstName =
          job?.quote?.contact_first_name ??
          job?.customer?.first_name ??
          null;

        const customerLastName =
          job?.quote?.contact_last_name ??
          job?.customer?.last_name ??
          null;

        const customerName = [customerFirstName, customerLastName]
          .filter(Boolean)
          .join(" ")
          .trim();

        let scheduleLabel = "Not scheduled";

        if (job.scheduled_at) {
          const date = new Date(job.scheduled_at);
          if (!Number.isNaN(date.getTime())) {
            scheduleLabel = new Intl.DateTimeFormat("en-NZ", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(date);
          }
        }

        return {
          ...job,
          address: job.job_address ?? job.address ?? null,
          schedule_label: scheduleLabel,
          customer_name: customerName || null,
          job_recurrences: safeRecurrences,
        };
      });

      if (normalizedSearch) {
        jobs = jobs.filter((job) => {
          const fullName =
            [job?.quote?.contact_first_name, job?.quote?.contact_last_name]
              .filter(Boolean)
              .join(" ")
              .trim() ||
            [job?.customer?.first_name, job?.customer?.last_name]
              .filter(Boolean)
              .join(" ")
              .trim();

          const serviceLabels = Array.isArray(job.services)
            ? job.services.map((service) => service?.label || service?.value || "").join(" ")
            : "";

          const fields = [
            job.uuid,
            job.status,
            job.job_address,
            job.address,
            job.schedule_label,
            fullName,
            job?.quote?.uuid,
            job?.quote?.contact_email,
            job?.quote?.contact_mobile,
            job?.quote?.contact_landline,
            job?.customer?.email,
            job?.customer?.mobile_phone,
            job?.customer?.landline_phone,
            serviceLabels,
          ]
            .filter(Boolean)
            .map((value) => String(value).toLowerCase());

          return fields.some((value) => value.includes(normalizedSearch));
        });
      }

      const totalCount = normalizedSearch ? jobs.length : count || 0;
      const totalPages = Math.max(1, Math.ceil(totalCount / safeLimit));

      const pagedJobs = normalizedSearch ? jobs.slice(from, to + 1) : jobs;

      return {
        jobs: pagedJobs,
        page: safePage,
        totalPages,
        total: totalCount,
        totalCount,
        limit: safeLimit,
        filters: {
          status: normalizedStatus,
          search: normalizedSearch,
          scheduledPreset: normalizedPreset,
          scheduledStart: normalizedScheduledStart,
          scheduledEnd: normalizedScheduledEnd,
          olderThanDays: safeOlder,
        },
      };
    }
    static async backfillJobAddressesFromQuotes() {
        // 1) get jobs missing job_address, include quote address
        const { data: jobs, error: fetchErr } = await supabase()
            .from("jobs")
            .select(
            `
                uuid,
                quote_uuid,
                job_address,
                quote:quotes (
                uuid,
                address
                )
            `
            )
            .eq("is_deleted", false)
            .is("job_address", null);

        if (fetchErr) throw new Error(`Fetch jobs for backfill failed: ${fetchErr.message}`);

        let updated = 0;
        let skipped = 0;

        // 2) update each job with quote.address
        for (const job of jobs || []) {
            const addr = job?.quote?.address;

            if (!addr) {
            skipped++;
            continue;
            }

            const { error: upErr } = await supabase()
            .from("jobs")
            .update({
                job_address: addr,
                updated_at: new Date().toISOString(),
            })
            .eq("uuid", job.uuid);

            if (upErr) throw new Error(`Update job ${job.uuid} failed: ${upErr.message}`);

            updated++;
        }

        return {
            success: true,
            totalMissing: (jobs || []).length,
            updated,
            skipped,
        };
    }
     /**
   * SUMMARY (for quick-find)
   * - lightweight job fields
   * - recurrence_count (computed) without fetching recurrence rows
   *
   * Returns:
   * {
   *   uuid, status, scheduled_at, total_amount,
   *   quote_uuid, customer_uuid, is_recurring, job_address,
   *   recurrence_count
   * }
   */

    static async findSummaryByUUID(uuid) {
      if (!uuid) throw new Error("Job UUID is required");

      const { data: job, error: jobErr } = await supabase()
        .from("jobs")
        .select(`
          uuid,
          status,
          scheduled_at,
          scheduled_window_mins,
          total_amount,
          quote_uuid,
          customer_uuid,
          job_address,
          is_recurring,
          is_deleted,
          customers (
            first_name,
            last_name
          ),
          quotes (
            services
          )
        `)
        .eq("uuid", uuid)
        .eq("is_deleted", false)
        .maybeSingle();

      if (jobErr) {
        throw new Error(`Error fetching job summary ${uuid}: ${jobErr.message}`);
      }

      if (!job) return null;

      const { count, error: recErr } = await supabase()
        .from("job_recurrences")
        .select("id", { count: "exact", head: true })
        .eq("job_uuid", uuid)
        .eq("is_deleted", false);

      if (recErr) {
        throw new Error(`Error counting recurrences for job ${uuid}: ${recErr.message}`);
      }

      let scheduleLabel = "Not scheduled";

      if (job.scheduled_at) {
        const date = new Date(job.scheduled_at);

        scheduleLabel = new Intl.DateTimeFormat("en-NZ", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(date);
      }

      let customerName = null;

      if (job.customers) {
        const { first_name, last_name } = job.customers;
        customerName = [first_name, last_name].filter(Boolean).join(" ");
      }

      let serviceSummary = null;

      const services = job.quotes?.services;

      if (Array.isArray(services) && services.length > 0) {
        serviceSummary =
          services.length === 1
            ? services[0].label || services[0].value || "1 service"
            : `${services.length} services`;
      }

      return {
        job: {
          uuid: job.uuid,
          status: job.status,
          scheduled_at: job.scheduled_at,
          scheduled_window_mins: job.scheduled_window_mins,
          total_amount: job.total_amount,
          currency: "NZD",
          quote_uuid: job.quote_uuid,
          customer_uuid: job.customer_uuid,
          customer_name: customerName,
          job_address: job.job_address,
          service_summary: serviceSummary,
          is_recurring: job.is_recurring,
          recurrence_count: count ?? 0,
          is_deleted: job.is_deleted,
          schedule_label: scheduleLabel,
        },
      };
    }
  /**
   * DETAILED (for job detail page)
   * - full job row
   * - all job_recurrences (non-deleted)
   * - optionally includes a tiny quote preview for display
   *
   * Returns:
   * {
   *   ...jobColumns,
   *   quote: { uuid, contact_first_name, contact_last_name } | null,
   *   job_recurrences: [...]
   * }
   */

    static async findDetailedByUUID(uuid) {
      if (!uuid) throw new Error("Job UUID is required");

      const { data: job, error: jobErr } = await supabase()
        .from("jobs")
        .select(`
          uuid,
          customer_uuid,
          quote_uuid,
          status,
          services,
          total_amount,
          scheduled_at,
          scheduled_window_mins,
          scheduled_window_preset,
          is_recurring,
          recurrence_frequency,
          recurrence_interval,
          recurrence_end_date,
          job_address,
          notes,
          has_urgent_fee,
          urgent_fee_amount,
          subtotal_amount,
          gst_amount,
          created_at,
          updated_at,
          is_deleted,
          client_schedule_message,
          client_schedule_message_sent_at,
          customers (
            uuid,
            first_name,
            last_name,
            email,
            mobile_phone,
            landline_phone,
            address
          )
        `)
        .eq("uuid", uuid)
        .eq("is_deleted", false)
        .maybeSingle();

      if (jobErr) {
        throw new Error(`Error fetching job ${uuid}: ${jobErr.message}`);
      }

      if (!job) return null;

      let quote = null;

      if (job.quote_uuid) {
        const { data: q, error: qErr } = await supabase()
          .from("quotes")
          .select(`
            uuid,
            status,
            contact_first_name,
            contact_last_name,
            contact_email,
            contact_mobile,
            contact_landline,
            preferred_contact_method,
            services,
            subtotal_amount,
            gst_amount,
            total_amount,
            expiry_end,
            is_quote_sent_to_client,
            quote_sent_at,
            message,
            employer_message,
            images,
            created_at,
            updated_at
          `)
          .eq("uuid", job.quote_uuid)
          .eq("is_deleted", false)
          .maybeSingle();

        if (qErr) {
          throw new Error(`Error fetching quote for job ${uuid}: ${qErr.message}`);
        }

        quote = q || null;
      }

      const { data: recs, error: recErr } = await supabase()
        .from("job_recurrences")
        .select(`
          uuid,
          job_uuid,
          scheduled_at,
          scheduled_window_mins,
          scheduled_window_preset,
          status,
          created_at,
          updated_at,
          is_deleted
        `)
        .eq("job_uuid", uuid)
        .eq("is_deleted", false)
        .order("scheduled_at", { ascending: true });

      if (recErr) {
        throw new Error(`Error fetching recurrences for job ${uuid}: ${recErr.message}`);
      }

      const recurrenceCount = Array.isArray(recs) ? recs.length : 0;

      let customer = null;
      if (job.customers) {
        customer = {
          uuid: job.customers.uuid,
          first_name: job.customers.first_name ?? null,
          last_name: job.customers.last_name ?? null,
          full_name: [job.customers.first_name, job.customers.last_name].filter(Boolean).join(" ") || null,
          email: job.customers.email ?? null,
          mobile: job.customers.mobile ?? null,
          landline: job.customers.landline ?? null,
          address: job.customers.address ?? null,
        };
      }

      let scheduleLabel = "Not scheduled";
      if (job.scheduled_at) {
        scheduleLabel = new Intl.DateTimeFormat("en-NZ", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(job.scheduled_at));
      }

      let recurrenceSummary = "One-off";
      if (job.is_recurring) {
        const freq = job.recurrence_frequency || "recurring";
        const interval = Number(job.recurrence_interval) || 1;

        if (interval === 1) {
          recurrenceSummary = freq.charAt(0).toUpperCase() + freq.slice(1);
        } else {
          recurrenceSummary = `Every ${interval} ${freq}`;
        }
      }

      return {
        uuid: job.uuid,
        customer_uuid: job.customer_uuid,
        quote_uuid: job.quote_uuid,
        status: job.status,
        services: Array.isArray(job.services) ? job.services : [],
        subtotal_amount: job.subtotal_amount,
        gst_amount: job.gst_amount,
        has_urgent_fee: job.has_urgent_fee,
        urgent_fee_amount: job.urgent_fee_amount,
        total_amount: job.total_amount,
        scheduled_at: job.scheduled_at,
        scheduled_window_mins: job.scheduled_window_mins ?? null,
        scheduled_window_preset: job.scheduled_window_preset ?? null,
        schedule_label: scheduleLabel,
        is_recurring: !!job.is_recurring,
        recurrence_frequency: job.recurrence_frequency ?? null,
        recurrence_interval: job.recurrence_interval ?? null,
        recurrence_end_date: job.recurrence_end_date ?? null,
        recurrence_summary: recurrenceSummary,
        recurrence_count: recurrenceCount,
        job_address: job.job_address ?? null,
        notes: job.notes ?? null,
        created_at: job.created_at ?? null,
        updated_at: job.updated_at ?? null,
        client_schedule_message: job.client_schedule_message ?? null,
        client_schedule_message_sent_at: job.client_schedule_message_sent_at ?? null,
        customer,
        quote,
        job_recurrences: recs || [],
      };
    }

  static async findDashboardJobs({
    range,
    page = 1,
    limit = 10,
  }) {
    const safePage = Math.max(parseInt(String(page), 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(String(limit), 10) || 10, 1), 50);
    const from = (safePage - 1) * safeLimit;
    const to = from + safeLimit - 1;

    const allowedRanges = ["attention", "today", "tomorrow", "next7days"];
    if (!allowedRanges.includes(range)) {
      throw new Error("range must be one of: attention, today, tomorrow, next7days");
    }

    const now = new Date();

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    const startOfDayAfterTomorrow = new Date(startOfTomorrow);
    startOfDayAfterTomorrow.setDate(startOfDayAfterTomorrow.getDate() + 1);

    const startOf7DaysLater = new Date(startOfToday);
    startOf7DaysLater.setDate(startOf7DaysLater.getDate() + 7);
    startOf7DaysLater.setHours(23, 59, 59, 999);

    // Base jobs load
    const { data: jobs, error: jobsError } = await supabase()
      .from("jobs")
      .select(`
        uuid,
        status,
        scheduled_at,
        created_at,
        total_amount,
        job_address,
        is_recurring,
        recurrence_end_date,
        recurrence_frequency,
        recurrence_interval,
        quote:quotes (
          uuid,
          contact_first_name,
          contact_last_name
        )
      `)
      .order("created_at", { ascending: false });

    if (jobsError) {
      throw new Error(`Error fetching jobs: ${jobsError.message}`);
    }

    const jobUUIDs = (jobs || []).map((j) => j.uuid);

    let recurrences = [];
    if (jobUUIDs.length > 0) {
      const { data: recurrenceData, error: recurrenceError } = await supabase()
        .from("job_recurrences")
        .select(`
          id,
          job_uuid,
          scheduled_at,
          is_completed,
          completed_date,
          status,
          is_deleted,
          previous_status,
          updated_at
        `)
        .in("job_uuid", jobUUIDs)
        .order("scheduled_at", { ascending: true });

      if (recurrenceError) {
        throw new Error(`Error fetching job recurrences: ${recurrenceError.message}`);
      }

      recurrences = recurrenceData || [];
    }

    const recurrenceMap = new Map();
    for (const r of recurrences) {
      if (!recurrenceMap.has(r.job_uuid)) {
        recurrenceMap.set(r.job_uuid, []);
      }
      recurrenceMap.get(r.job_uuid).push(r);
    }

    const isValidFutureRecurrence = (r) => {
      if (!r) return false;
      if (r.is_deleted) return false;
      if (r.is_completed) return false;
      if (!r.scheduled_at) return false;
      return new Date(r.scheduled_at) >= now;
    };

    const isValidUpcomingRecurrence = (r) => {
      if (!r) return false;
      if (r.is_deleted) return false;
      if (r.is_completed) return false;
      if (!r.scheduled_at) return false;
      return true;
    };

    const enrichedJobs = (jobs || []).map((job) => {
      const jobRecs = recurrenceMap.get(job.uuid) || [];

      const futureRecs = jobRecs.filter(isValidFutureRecurrence);
      const sortedFutureRecs = [...futureRecs].sort(
        (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
      );

      const nextUpcomingRecurrence = sortedFutureRecs[0] || null;
      const futureRecurrenceCount = sortedFutureRecs.length;

      let needsAttention = false;
      let attentionReason = null;

      if (!job.scheduled_at && !nextUpcomingRecurrence) {
        needsAttention = true;
        attentionReason = "missing_schedule";
      } else if (job.is_recurring) {
        const recurrenceEndDate = job.recurrence_end_date ? new Date(job.recurrence_end_date) : null;

        if (recurrenceEndDate && recurrenceEndDate < now && futureRecurrenceCount === 0) {
          needsAttention = true;
          attentionReason = "recurrence_ended";
        } else if (futureRecurrenceCount === 0) {
          needsAttention = true;
          attentionReason = "no_future_recurrences";
        } else if (futureRecurrenceCount < 5) {
          needsAttention = true;
          attentionReason = "low_future_recurrences";
        }
      }

      return {
        ...job,
        scheduled_at: nextUpcomingRecurrence?.scheduled_at || job.scheduled_at || null,
        job_recurrences: jobRecs,
        future_recurrence_count: futureRecurrenceCount,
        needs_attention: needsAttention,
        attention_reason: attentionReason,
      };
    });

    let filtered = [];

    if (range === "attention") {
      filtered = enrichedJobs.filter((job) => job.needs_attention);
    }

    if (range === "today") {
      filtered = enrichedJobs.filter((job) => {
        if (!job.scheduled_at) return false;
        const d = new Date(job.scheduled_at);
        return d >= startOfToday && d < startOfTomorrow;
      });
    }

    if (range === "tomorrow") {
      filtered = enrichedJobs.filter((job) => {
        if (!job.scheduled_at) return false;
        const d = new Date(job.scheduled_at);
        return d >= startOfTomorrow && d < startOfDayAfterTomorrow;
      });
    }

    if (range === "next7days") {
      filtered = enrichedJobs.filter((job) => {
        if (!job.scheduled_at) return false;
        const d = new Date(job.scheduled_at);
        return d >= startOfDayAfterTomorrow && d <= startOf7DaysLater;
      });
    }

    filtered.sort((a, b) => {
      const aTime = a.scheduled_at ? new Date(a.scheduled_at).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.scheduled_at ? new Date(b.scheduled_at).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });

    const total = filtered.length;
    const pagedJobs = filtered.slice(from, to + 1);
    const totalPages = Math.max(Math.ceil(total / safeLimit), 1);

    return {
      jobs: pagedJobs,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPrevPage: safePage > 1,
      },
    };
  }

}