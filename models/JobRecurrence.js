import { supabase } from '../config/db.js';
import { generatePrefixedId } from '../util/util.js';

function getDefaultRecurrenceCount(freq) {
  switch (freq) {
    case "weekly":
      return 12;
    case "fortnightly":
      return 12;
    case "monthly":
      return 12;
    default:
      return 12;
  }
}

function isValidISODate(value) {
  if (!value) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function nextOccurrenceDate(date, frequency, interval = 1) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error("nextOccurrenceDate requires a valid Date");
  }

  if (!Number.isInteger(interval) || interval <= 0) {
    throw new Error("nextOccurrenceDate interval must be a positive integer");
  }

  if (frequency === "weekly") {
    return addDays(date, 7 * interval);
  }

  if (frequency === "fortnightly") {
    return addDays(date, 14);
  }

  if (frequency === "monthly") {
    return addMonths(date, interval);
  }

  throw new Error(
    "nextOccurrenceDate frequency must be 'weekly', 'fortnightly', or 'monthly'"
  );
}

const moveToNextTradingDay = (date) => {
  const adjusted = new Date(date);

  while (adjusted.getDay() === 0 || adjusted.getDay() === 6) {
    adjusted.setDate(adjusted.getDate() + 1);
  }

  return adjusted;
};

export default class JobRecurrence {


  static round2(value) {
    const num = Number(value || 0);
    return Math.round(num * 100) / 100;
  }

  static sanitizeService(service = {}) {
    const quantity = Number(service.quantity || 0);
    const unitPrice = Number(service.unit_price || 0);

    return {
      service_uuid: service.service_uuid ?? null,
      code: service.code ?? null,
      label: service.label ?? service.value ?? "Service",
      value: service.value ?? service.label ?? "Service",
      description: service.description ?? null,
      unit: service.unit ?? null,
      quantity,
      unit_price: unitPrice,
      line_total: this.round2(quantity * unitPrice),
    };
  }

  static sanitizeServicesArray(services) {
    if (!Array.isArray(services)) return [];
    return services.map((service) => this.sanitizeService(service));
  }

  static calculateTotalsFromServices(services = []) {
    const subtotal = this.round2(
      services.reduce((sum, service) => {
        const qty = Number(service.quantity || 0);
        const unitPrice = Number(service.unit_price || 0);
        return sum + qty * unitPrice;
      }, 0)
    );

    const gst = this.round2(subtotal * 0.15);
    const total = this.round2(subtotal + gst);

    return {
      subtotal_amount: subtotal,
      gst_amount: gst,
      total_amount: total,
    };
  }

  static async updateAndPrepareClientNotification(uuid, input = {}) {
    if (!uuid) {
      throw new Error("Recurrence UUID is required");
    }

    const existing = await this.findByUUID(uuid);

    if (!existing) {
      throw new Error("Recurrence not found");
    }

    const {
      scheduled_at,
      scheduled_window_mins,
      scheduled_window_preset,
      is_custom_schedule,
      services,
      subtotal_amount,
      gst_amount,
      total_amount,
      pricing_source,
      status,
      client_schedule_message,
      client_schedule_message_sent_at,
    } = input;

    const updates = {};

    if (scheduled_at !== undefined) {
      updates.scheduled_at = scheduled_at;
    }

    if (scheduled_window_mins !== undefined) {
      updates.scheduled_window_mins = scheduled_window_mins;
    }

    if (scheduled_window_preset !== undefined) {
      updates.scheduled_window_preset = scheduled_window_preset;
    }

    if (is_custom_schedule !== undefined) {
      updates.is_custom_schedule = Boolean(is_custom_schedule);
    }

    if (status !== undefined) {
      updates.status = status;
    }

    if (services !== undefined) {
      const cleanedServices = this.sanitizeServicesArray(services);
      const computedTotals = this.calculateTotalsFromServices(cleanedServices);

      updates.services = cleanedServices;
      updates.subtotal_amount =
        subtotal_amount !== undefined && subtotal_amount !== null
          ? this.round2(subtotal_amount)
          : computedTotals.subtotal_amount;

      updates.gst_amount =
        gst_amount !== undefined && gst_amount !== null
          ? this.round2(gst_amount)
          : computedTotals.gst_amount;

      updates.total_amount =
        total_amount !== undefined && total_amount !== null
          ? this.round2(total_amount)
          : computedTotals.total_amount;

      updates.pricing_source = pricing_source || "recurrence_override";
    } else {
      if (subtotal_amount !== undefined) {
        updates.subtotal_amount =
          subtotal_amount === null ? null : this.round2(subtotal_amount);
      }

      if (gst_amount !== undefined) {
        updates.gst_amount =
          gst_amount === null ? null : this.round2(gst_amount);
      }

      if (total_amount !== undefined) {
        updates.total_amount =
          total_amount === null ? null : this.round2(total_amount);
      }

      if (pricing_source !== undefined) {
        updates.pricing_source = pricing_source;
      }
    }

    if (client_schedule_message !== undefined) {
      updates.client_schedule_message = client_schedule_message;
    }

    if (client_schedule_message_sent_at !== undefined) {
      updates.client_schedule_message_sent_at = client_schedule_message_sent_at;
    }

    const updated = await this.update(uuid, updates);

    const { data: job, error: jobError } = await supabase()
      .from("jobs")
      .select(`
        uuid,
        customer_uuid,
        quote_uuid,
        job_address,
        client_schedule_message,
        scheduled_window_mins
      `)
      .eq("uuid", updated.job_uuid)
      .single();

    if (jobError || !job) {
      throw new Error(
        `Failed to load parent job: ${jobError?.message || "Job not found"}`
      );
    }

    let customer = null;

    if (job.customer_uuid) {
      const { data: customerData, error: customerError } = await supabase()
        .from("users")
        .select(`
          uuid,
          first_name,
          last_name,
          full_name,
          email,
          mobile,
          landline,
          address
        `)
        .eq("uuid", job.customer_uuid)
        .maybeSingle();

      if (customerError) {
        throw new Error(`Failed to load customer: ${customerError.message}`);
      }

      customer = customerData || null;
    }

    const safeServices = Array.isArray(updated.services)
      ? updated.services
      : Array.isArray(existing.services)
      ? existing.services
      : [];

    const emailData = {
      jobUUID: job.uuid,
      recurrenceUUID: updated.uuid,
      recurrenceId: updated.id,
      customerName:
        customer?.full_name ||
        [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") ||
        "Customer",
      customerEmail: customer?.email || null,
      mobile: customer?.mobile || customer?.landline || null,
      address: job.job_address || customer?.address || null,
      services: safeServices,
      previousScheduledAt: existing.scheduled_at || null,
      previousScheduledWindowMins:
        existing.scheduled_window_mins ?? job.scheduled_window_mins ?? null,
      scheduledAt: updated.scheduled_at || null,
      scheduledWindowMins:
        updated.scheduled_window_mins ?? job.scheduled_window_mins ?? null,
      dashboardLink: null,
    };

    const changedFields = this.buildChangedFields(existing, updated, [
      "scheduled_at",
      "scheduled_window_mins",
      "scheduled_window_preset",
      "is_custom_schedule",
      "services",
      "subtotal_amount",
      "gst_amount",
      "total_amount",
      "pricing_source",
      "status",
      "client_schedule_message",
      "client_schedule_message_sent_at",
      "updated_at",
    ]);

    return {
      existing,
      updated,
      job,
      customer,
      emailData,
      changedFields,
    };
  }

  static async findPaginatedByJobUUID(jobUuid, page = 1, limit = 5) {
    if (!jobUuid) throw new Error("Job UUID is required");

    const safePage = Math.max(parseInt(String(page), 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(String(limit), 10) || 5, 1), 50);

    const from = (safePage - 1) * safeLimit;
    const to = from + safeLimit - 1;

    const { data, error, count } = await supabase()
      .from("job_recurrences")
      .select("*", { count: "exact" })
      .eq("job_uuid", jobUuid)
      .order("scheduled_at", { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Error fetching recurrences: ${error.message}`);
    }

    return {
      data: data || [],
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: count || 0,
        totalPages: Math.max(Math.ceil((count || 0) / safeLimit), 1),
        hasNextPage: safePage * safeLimit < (count || 0),
        hasPrevPage: safePage > 1,
      },
    };
  }

  static async regenerateFutureForJob(jobUUID, input = {}) {
    const {
      scheduled_at,
      scheduled_window_mins = null,
      scheduled_window_preset = null,
      recurrence_frequency,
      recurrence_interval = 1,
      recurrence_end_date = null,
      status = "scheduled",
    } = input;

    if (!jobUUID) {
      throw new Error("jobUUID is required");
    }

    if (!scheduled_at || !isValidISODate(scheduled_at)) {
      throw new Error("scheduled_at must be a valid ISO date string");
    }

    if (!["weekly", "fortnightly", "monthly"].includes(recurrence_frequency)) {
      throw new Error(
        "recurrence_frequency must be 'weekly', 'fortnightly', or 'monthly'"
      );
    }

    if (!(Number.isInteger(recurrence_interval) && recurrence_interval > 0)) {
      throw new Error("recurrence_interval must be a positive integer");
    }

    if (recurrence_end_date && !isValidISODate(recurrence_end_date)) {
      throw new Error("recurrence_end_date must be a valid ISO date string or null");
    }

    const baseDate = new Date(scheduled_at);
    const now = new Date();
    const endDate = recurrence_end_date ? new Date(recurrence_end_date) : null;

    const maxOccurrences = 100;

    const todayOnly = new Date(now);
    todayOnly.setHours(0, 0, 0, 0);

    const deleteFromDate = new Date(todayOnly);

    const { error: deleteError } = await supabase()
      .from("job_recurrences")
      .delete()
      .eq("job_uuid", jobUUID)
      .eq("is_completed", false)
      .gte("scheduled_at", deleteFromDate.toISOString());

    if (deleteError) {
      throw new Error(`Error deleting future recurrences: ${deleteError.message}`);
    }

    const rows = [];
    let nextDate = new Date(baseDate);
    let guard = 0;

    while (guard < maxOccurrences) {
      nextDate = nextOccurrenceDate(
        nextDate,
        recurrence_frequency,
        recurrence_interval
      );

      const adjustedDate = moveToNextTradingDay(nextDate);

      if (endDate) {
        const nextDateOnly = new Date(adjustedDate);
        const endDateOnly = new Date(endDate);

        nextDateOnly.setHours(0, 0, 0, 0);
        endDateOnly.setHours(0, 0, 0, 0);

        if (nextDateOnly > endDateOnly) {
          break;
        }
      }

      const adjustedDateOnly = new Date(adjustedDate);
      adjustedDateOnly.setHours(0, 0, 0, 0);

      if (adjustedDateOnly >= todayOnly) {
        let recurrenceUUID;
        let exists;

        do {
          recurrenceUUID = generatePrefixedId("JR", 7);

          const { data, error } = await supabase()
            .from("job_recurrences")
            .select("id")
            .eq("uuid", recurrenceUUID)
            .maybeSingle();

          if (error) {
            throw new Error(`Error checking recurrence UUID: ${error.message}`);
          }

          exists = data;
        } while (exists);

        rows.push({
          uuid: recurrenceUUID,
          job_uuid: jobUUID,
          scheduled_at: adjustedDate.toISOString(),
          scheduled_window_mins,
          scheduled_window_preset,
          is_completed: false,
          completed_date: null,
          status,
        });
      }

      guard += 1;

      if (!endDate && rows.length >= 12) {
        break;
      }
    }

    if (rows.length === 0) {
      return [];
    }

    const { data: insertedRows, error: insertError } = await supabase()
      .from("job_recurrences")
      .insert(rows)
      .select("*");

    if (insertError) {
      throw new Error(`Error inserting future recurrences: ${insertError.message}`);
    }

    return insertedRows;
  }

  static async findByIdForJob(jobUuid, recurrenceId) {
    if (!jobUuid) throw new Error("Job UUID is required");
    if (!recurrenceId) throw new Error("Recurrence ID is required");

    const { data, error } = await supabase()
      .from("job_recurrences")
      .select("*")
      .eq("job_uuid", jobUuid)
      .eq("id", recurrenceId)
      .single();

    if (error) {
      throw new Error(`Error fetching recurrence for job: ${error.message}`);
    }

    return data;
  }

  static async updateScheduleByIdForJob(jobUUID, recurrenceId, updates = {}) {
    if (!jobUUID) {
      throw new Error("Job UUID is required");
    }

    if (!recurrenceId) {
      throw new Error("Recurrence ID is required");
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

    if (updates.is_custom_schedule !== undefined) {
      updatePayload.is_custom_schedule = updates.is_custom_schedule;
    }

    const { data, error } = await supabase()
      .from("job_recurrences")
      .update(updatePayload)
      .eq("job_uuid", jobUUID)
      .eq("id", recurrenceId)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Error updating recurrence schedule: ${error.message}`);
    }

    return data;
  }

  static async create({
    uuid,
    job_uuid,
    scheduled_at,
    status = 'scheduled',
    is_completed = false,
    completed_date = null
  }) {
    const { data, error } = await supabase()
      .from('job_recurrences')
      .insert([{
        uuid,
        job_uuid,
        scheduled_at,
        status,
        is_completed,
        completed_date,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select('*')
      .single();

    if (error) throw new Error(`Error creating job recurrence: ${error.message}`);
    return data;
  }

  static async findByJob(job_uuid) {
    const { data, error } = await supabase()
      .from('job_recurrences')
      .select('*')
      .eq('job_uuid', job_uuid)
      .order('scheduled_at', { ascending: true });

    if (error) throw new Error(`Error fetching recurrences: ${error.message}`);
    return data;
  }

  static async findByUUID(uuid) {
    const { data, error } = await supabase()
      .from('job_recurrences')
      .select('*')
      .eq('uuid', uuid)
      .maybeSingle();

    if (error) throw new Error(`Error fetching job recurrence: ${error.message}`);
    return data;
  }

  static async update(uuid, updates = {}) {
    if (!uuid) {
      throw new Error("Recurrence UUID is required");
    }

    const allowedFields = [
      "scheduled_at",
      "scheduled_window_mins",
      "scheduled_window_preset",
      "is_custom_schedule",
      "services",
      "subtotal_amount",
      "gst_amount",
      "total_amount",
      "pricing_source",
      "status",
      "is_completed",
      "completed_date",
      "previous_status",
      "completion_notes",
      "completed_by_user_uuid",
      "deleted_at",
      "is_deleted",
    ];

    const updatePayload = {
      updated_at: new Date().toISOString(),
    };

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updatePayload[field] = updates[field];
      }
    }

    const { data, error } = await supabase()
      .from('job_recurrences')
      .update(updatePayload)
      .eq('uuid', uuid)
      .select('*')
      .single();

    if (error) throw new Error(`Error updating job recurrence: ${error.message}`);
    return data;
  }

  static async markCompleted(uuid) {
    return this.update(uuid, {
      is_completed: true,
      completed_date: new Date().toISOString(),
      status: 'completed'
    });
  }

  static async markMissed(uuid) {
    return this.update(uuid, {
      status: 'missed',
      updated_at: new Date().toISOString()
    });
  }

  static async delete(uuid, soft = true) {
    if (soft) {
      return this.update(uuid, {
        status: 'deleted',
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      });
    } else {
      const { data, error } = await supabase()
        .from('job_recurrences')
        .delete()
        .eq('uuid', uuid);

      if (error) throw new Error(`Error deleting job recurrence: ${error.message}`);
      return data;
    }
  }

  static async extendFutureForJob(jobUUID, count = 12) {
    if (!jobUUID) {
      throw new Error("jobUUID is required");
    }

    const parsedCount = parseInt(String(count), 10);
    if (!Number.isInteger(parsedCount) || parsedCount <= 0) {
      throw new Error("count must be a positive integer");
    }

    const { data: job, error: jobError } = await supabase()
      .from("jobs")
      .select(`
        uuid,
        scheduled_at,
        scheduled_window_mins,
        is_recurring,
        recurrence_frequency,
        recurrence_interval,
        recurrence_end_date
      `)
      .eq("uuid", jobUUID)
      .single();

    if (jobError || !job) {
      throw new Error(`Job not found: ${jobError?.message}`);
    }

    if (!job.is_recurring) {
      throw new Error("Job is not recurring");
    }

    const {
      scheduled_at,
      scheduled_window_mins,
      recurrence_frequency,
      recurrence_interval,
      recurrence_end_date,
    } = job;

    const interval = recurrence_interval || 1;

    const { data: lastRecurrence, error: lastError } = await supabase()
      .from("job_recurrences")
      .select("scheduled_at")
      .eq("job_uuid", jobUUID)
      .order("scheduled_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastError) {
      throw new Error(`Error fetching last recurrence: ${lastError.message}`);
    }

    let startDate;

    if (lastRecurrence?.scheduled_at) {
      startDate = new Date(lastRecurrence.scheduled_at);
    } else {
      startDate = new Date(scheduled_at);
    }

    const endDate = recurrence_end_date ? new Date(recurrence_end_date) : null;

    if (endDate && startDate >= endDate) {
      return [];
    }

    const rows = [];
    let nextDate = new Date(startDate);

    for (let i = 0; i < parsedCount; i++) {
      nextDate = nextOccurrenceDate(
        nextDate,
        recurrence_frequency,
        interval
      );

      if (endDate && nextDate > endDate) {
        break;
      }

      rows.push({
        uuid: generatePrefixedId("JR", 7),
        job_uuid: jobUUID,
        scheduled_at: nextDate.toISOString(),
        scheduled_window_mins: scheduled_window_mins ?? null,
        is_completed: false,
        completed_date: null,
        status: "scheduled",
        is_custom_schedule: false,
      });
    }

    if (rows.length === 0) {
      return [];
    }

    const { data, error } = await supabase()
      .from("job_recurrences")
      .insert(rows)
      .select("*");

    if (error) {
      throw new Error(`Error extending recurrences: ${error.message}`);
    }

    return data;
  }

  static async findFutureByJobUUID(jobUUID) {
    if (!jobUUID) {
      throw new Error("jobUUID is required");
    }

    const now = new Date().toISOString();

    const { data, error } = await supabase()
      .from("job_recurrences")
      .select("*")
      .eq("job_uuid", jobUUID)
      .eq("is_completed", false)
      .gte("scheduled_at", now)
      .order("scheduled_at", { ascending: true });

    if (error) {
      throw new Error(`Error fetching future recurrences: ${error.message}`);
    }

    return data || [];
  }

  static async deleteFutureByJobUUID(jobUUID) {
    if (!jobUUID) {
      throw new Error("jobUUID is required");
    }

    const now = new Date().toISOString();

    const { data, error } = await supabase()
      .from("job_recurrences")
      .delete()
      .eq("job_uuid", jobUUID)
      .eq("is_completed", false)
      .gte("scheduled_at", now);

    if (error) {
      throw new Error(`Error deleting future recurrences: ${error.message}`);
    }

    return data || [];
  }

    static async tempBackfillServicesFromParentJobs({ job_uuid = null } = {}) {
    let jobsQuery = supabase()
      .from("jobs")
      .select(`
        uuid,
        services,
        subtotal_amount,
        gst_amount,
        total_amount
      `)
      .eq("is_deleted", false);

    if (job_uuid) {
      jobsQuery = jobsQuery.eq("uuid", job_uuid);
    }

    const { data: jobs, error: jobsError } = await jobsQuery;

    if (jobsError) {
      throw new Error(`Error fetching parent jobs for backfill: ${jobsError.message}`);
    }

    if (!jobs || jobs.length === 0) {
      return {
        matchedCount: 0,
        updatedCount: 0,
        updated: [],
        message: job_uuid
          ? `No job found for ${job_uuid}`
          : "No parent jobs found for backfill",
      };
    }

    const jobMap = new Map();
    for (const job of jobs) {
      jobMap.set(job.uuid, job);
    }

    const jobUUIDs = jobs.map((j) => j.uuid);

    let recurrencesQuery = supabase()
      .from("job_recurrences")
      .select(`
        id,
        uuid,
        job_uuid,
        services,
        subtotal_amount,
        gst_amount,
        total_amount,
        pricing_source
      `)
      .in("job_uuid", jobUUIDs)
      .eq("is_deleted", false);

    const { data: recurrences, error: recurrencesError } = await recurrencesQuery;

    if (recurrencesError) {
      throw new Error(`Error fetching recurrences for backfill: ${recurrencesError.message}`);
    }

    if (!recurrences || recurrences.length === 0) {
      return {
        matchedCount: 0,
        updatedCount: 0,
        updated: [],
        message: "No recurrences found to backfill",
      };
    }

    const rowsToUpdate = recurrences.filter((recurrence) => {
      const parentJob = jobMap.get(recurrence.job_uuid);
      if (!parentJob) return false;

      const needsServices =
        recurrence.services === null || recurrence.services === undefined;

      const needsSubtotal =
        recurrence.subtotal_amount === null || recurrence.subtotal_amount === undefined;

      const needsGst =
        recurrence.gst_amount === null || recurrence.gst_amount === undefined;

      const needsTotal =
        recurrence.total_amount === null || recurrence.total_amount === undefined;

      const needsPricingSource =
        recurrence.pricing_source === null || recurrence.pricing_source === undefined;

      return (
        needsServices ||
        needsSubtotal ||
        needsGst ||
        needsTotal ||
        needsPricingSource
      );
    });

    if (rowsToUpdate.length === 0) {
      return {
        matchedCount: 0,
        updatedCount: 0,
        updated: [],
        message: "No recurrences required backfill",
      };
    }

    const updatedRows = [];

    for (const recurrence of rowsToUpdate) {
      const parentJob = jobMap.get(recurrence.job_uuid);
      if (!parentJob) continue;

      const updatePayload = {
        services: parentJob.services ?? [],
        subtotal_amount: parentJob.subtotal_amount ?? 0,
        gst_amount: parentJob.gst_amount ?? 0,
        total_amount: parentJob.total_amount ?? 0,
        pricing_source: "job_default_backfilled",
        updated_at: new Date().toISOString(),
      };

      const { data: updated, error: updateError } = await supabase()
        .from("job_recurrences")
        .update(updatePayload)
        .eq("uuid", recurrence.uuid)
        .select(`
          id,
          uuid,
          job_uuid,
          services,
          subtotal_amount,
          gst_amount,
          total_amount,
          pricing_source
        `)
        .single();

      if (updateError) {
        throw new Error(
          `Error backfilling recurrence ${recurrence.uuid}: ${updateError.message}`
        );
      }

      updatedRows.push(updated);
    }

    return {
      matchedCount: rowsToUpdate.length,
      updatedCount: updatedRows.length,
      updated: updatedRows,
      message: job_uuid
        ? `Backfilled ${updatedRows.length} recurrence(s) for job ${job_uuid}`
        : `Backfilled ${updatedRows.length} recurrence(s) from parent jobs`,
    };
  }
}