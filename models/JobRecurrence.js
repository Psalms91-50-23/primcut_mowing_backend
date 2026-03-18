import supabase from '../config/db.js';
import { generatePrefixedId } from '../util/util.js';

function getDefaultRecurrenceCount(freq) {
  switch (freq) {
    case "weekly":
      return 12;        // 3 months
    case "fortnightly":
      return 12;        // 6 months
    case "monthly":
      return 12;        // 1 year
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
  const safeInterval = Number(interval) || 1;

  if (frequency === "weekly") {
    return addDays(date, 7 * safeInterval);
  }

  if (frequency === "fortnightly") {
    return addDays(date, 14 * safeInterval);
  }

  if (frequency === "monthly") {
    return addMonths(date, safeInterval);
  }

  throw new Error(`Unsupported recurrence_frequency: ${frequency}`);
}

class JobRecurrence {

    static async findPaginatedByJobUUID(jobUuid, page = 1, limit = 5) {
      if (!jobUuid) throw new Error("Job UUID is required");

      const safePage = Math.max(parseInt(String(page), 10) || 1, 1);
      const safeLimit = Math.min(Math.max(parseInt(String(limit), 10) || 5, 1), 50);

      const from = (safePage - 1) * safeLimit;
      const to = from + safeLimit - 1;

      const { data, error, count } = await supabase
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

      // Safety cap so you do not accidentally generate infinite rows
      const maxOccurrences = 100;

      // 1) Delete future incomplete recurrences
      const { error: deleteError } = await supabase
        .from("job_recurrences")
        .delete()
        .eq("job_uuid", jobUUID)
        .eq("is_completed", false)
        .gte("scheduled_at", now.toISOString());

      if (deleteError) {
        throw new Error(
          `Error deleting future recurrences: ${deleteError.message}`
        );
      }

      // 2) Generate new future recurrences
      const rows = [];
      let nextDate = new Date(baseDate);
      let guard = 0;

      while (guard < maxOccurrences) {
        nextDate = nextOccurrenceDate(
          nextDate,
          recurrence_frequency,
          recurrence_interval
        );

        if (endDate && nextDate > endDate) {
          break;
        }

        // Only create future recurrences
        if (nextDate > now) {
          let recurrenceUUID;
          let exists;

          do {
            recurrenceUUID = generatePrefixedId("JR", 7);
            // recurrenceUUID = generateShortId(9);
            const { data, error } = await supabase
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
            scheduled_at: nextDate.toISOString(),
            scheduled_window_mins,
            is_completed: false,
            completed_date: null,
            status,
            // recurrence_frequency,
            // recurrence_interval,
          });
        }

        guard += 1;

        // If no end date, stop after a reasonable amount
        if (!endDate && rows.length >= 12) {
          break;
        }
      }

      if (rows.length === 0) {
        return [];
      }

      const { data: insertedRows, error: insertError } = await supabase
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

      const { data, error } = await supabase
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

    const { data, error } = await supabase
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
    // Create a new recurrence
    static async create({ 
      uuid, 
      job_uuid, 
      scheduled_at, 
      status = 'scheduled', 
      is_completed = false, 
      completed_date = null }) {
        const { data, error } = await supabase
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

    // Fetch all recurrences for a given job
    static async findByJob(job_uuid) {
        const { data, error } = await supabase
            .from('job_recurrences')
            .select('*')
            .eq('job_uuid', job_uuid)
            .order('scheduled_at', { ascending: true });

        if (error) throw new Error(`Error fetching recurrences: ${error.message}`);
        return data;
    }

    // Fetch a single recurrence by UUID
    static async findByUUID(uuid) {
        const { data, error } = await supabase
            .from('job_recurrences')
            .select('*')
            .eq('uuid', uuid)
            .maybeSingle();

        if (error) throw new Error(`Error fetching job recurrence: ${error.message}`);
        return data;
    }

    // Update a recurrence (status, completed, date, etc.)
    static async update(uuid, updates = {}) {
        updates.updated_at = new Date().toISOString();
        const { data, error } = await supabase
            .from('job_recurrences')
            .update(updates)
            .eq('uuid', uuid)
            .select('*')
            .single();

        if (error) throw new Error(`Error updating job recurrence: ${error.message}`);
        return data;
    }

    // Mark a recurrence as completed
    static async markCompleted(uuid) {
        return this.update(uuid, {
            is_completed: true,
            completed_date: new Date().toISOString(),
            status: 'completed'
        });
    }

    // Mark a recurrence as missed
    static async markMissed(uuid) {
        return this.update(uuid, {
            status: 'missed',
            updated_at: new Date().toISOString()
        });
    }

    // Delete a recurrence (soft delete or hard delete)
    static async delete(uuid, soft = true) {
        if (soft) {
            return this.update(uuid, { status: 'deleted' });
        } else {
            const { data, error } = await supabase
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

    // 1️⃣ Get job recurrence settings
    const { data: job, error: jobError } = await supabase
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

    // 2️⃣ Find latest recurrence
    const { data: lastRecurrence, error: lastError } = await supabase
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
    // ✅ If recurrence already ended, stop immediately
    if (endDate && startDate >= endDate) {
      return [];
    }
    // 3️⃣ Generate next occurrences
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

    // 4️⃣ Insert
    const { data, error } = await supabase
      .from("job_recurrences")
      .insert(rows)
      .select("*");

    if (error) {
      throw new Error(`Error extending recurrences: ${error.message}`);
    }

    return data;
  }
}

export default JobRecurrence;
