import Job from "../models/Job.js";
import Quote from "../models/Quote.js";
// import Customer from "../models/Customer.js";
import JobRecurrence from "../models/JobRecurrence.js";
import sendJobScheduleToClient from '../lib/email/sendJobScheduleToClient.js';
import { createChangeLogSafe } from '../util/createChangeLogSafe.js';
import ChangeLog from '../models/ChangeLog.js';
import { normalizeNZPhone, generatePrefixedId, obfuscatePhoneNumber, obfuscateName, obfuscateEmail, obfuscateAddress, toNZDateStringFromISO, formatFullName, isPlainDateString, localDateToISO } from "../util/util.js";

const UUID_REGEX = /^[a-zA-Z0-9]{9}$/;

function recurrenceLabelFromJob(job) {
  if (!job?.is_recurring) return "One_off service";
  if (job?.recurrence_frequency === "week" && Number(job?.recurrence_interval) === 1) {
    return "Weekly";
  }
  if (job?.recurrence_frequency === "week" && Number(job?.recurrence_interval) === 2) {
    return "Fortnightly";
  }
  if (job?.recurrence_frequency === "month" && Number(job?.recurrence_interval) === 1) {
    return "Monthly";
  }
  return "Recurring service";
}

const ALLOWED_WINDOW_PRESETS = [
  "anytime",
  "morning",
  "midday",
  "afternoon",
  "2hour",
  "3hour",
];

function isValidISODate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

const allowedFrequencies = ["one_off", "weekly", "fortnightly", "monthly"];

function normalizeJobScheduleInput(job = {}) {
  const {
    scheduled_date = undefined,
    scheduled_at = undefined,
    scheduled_window_mins = null,
    scheduled_window_preset = null,
    is_recurring = false,
    recurrence_frequency = null,
    recurrence_interval = null,
    recurrence_end_date = null,
    regenerate_recurrences = false,
    send_schedule_email = false,
    notification_type = "schedule_update",
    notes = null,
    client_schedule_message = null,
  } = job;

  let normalizedScheduledAt = null;

  if (scheduled_date !== undefined) {
    if (!(scheduled_date === null || scheduled_date === "" || isPlainDateString(scheduled_date))) {
      throw new Error("job.scheduled_date must be a valid YYYY-MM-DD string or null");
    }

    normalizedScheduledAt =
      scheduled_date === null || scheduled_date === ""
        ? null
        : localDateToISO(scheduled_date);
  } else if (scheduled_at !== undefined) {
    if (!(scheduled_at === null || isValidISODate(scheduled_at))) {
      throw new Error("job.scheduled_at must be a valid ISO date string or null");
    }

    normalizedScheduledAt = scheduled_at;
  }

  const normalizedWindowMins =
    scheduled_window_mins === null || scheduled_window_mins === undefined
      ? null
      : Number(scheduled_window_mins);

  if (
    !(
      normalizedWindowMins === null ||
      (Number.isInteger(normalizedWindowMins) && normalizedWindowMins > 0)
    )
  ) {
    throw new Error("job.scheduled_window_mins must be a positive integer or null");
  }

  if (
    !(
      scheduled_window_preset === null ||
      scheduled_window_preset === undefined ||
      ALLOWED_WINDOW_PRESETS.includes(scheduled_window_preset)
    )
  ) {
    throw new Error(
      `job.scheduled_window_preset must be one of: ${ALLOWED_WINDOW_PRESETS.join(", ")} or null`
    );
  }

  const normalizedRecurrenceInterval =
    recurrence_interval === null || recurrence_interval === undefined
      ? null
      : Number(recurrence_interval);

  if (is_recurring) {
    if (!allowedFrequencies.includes(recurrence_frequency)) {
      throw new Error(
        "job.recurrence_frequency must be one of: 'one_off', 'weekly', 'fortnightly', 'monthly' when recurring"
      );
    }

    if (
      !(
        Number.isInteger(normalizedRecurrenceInterval) &&
        normalizedRecurrenceInterval > 0
      )
    ) {
      throw new Error("job.recurrence_interval must be a positive integer when recurring");
    }
  }

  if (
    !(
      recurrence_end_date === null ||
      recurrence_end_date === undefined ||
      recurrence_end_date === "" ||
      isPlainDateString(recurrence_end_date)
    )
  ) {
    throw new Error("job.recurrence_end_date must be a valid YYYY-MM-DD string or null");
  }

  const normalizedClientMessage =
    typeof client_schedule_message === "string"
      ? client_schedule_message.trim() || null
      : null;

  const normalizedNotes =
    typeof notes === "string"
      ? notes.trim() || null
      : null;

  const normalizedNotificationType =
    notification_type === "rescheduled" ? "rescheduled" : "schedule_update";

  return {
    scheduled_at: normalizedScheduledAt,
    scheduled_window_mins: normalizedWindowMins,
    scheduled_window_preset:
      scheduled_window_preset === undefined ? null : scheduled_window_preset,
    is_recurring: Boolean(is_recurring),
    recurrence_frequency: is_recurring ? recurrence_frequency : null,
    recurrence_interval: is_recurring ? normalizedRecurrenceInterval : null,
    recurrence_end_date:
      is_recurring && recurrence_end_date ? recurrence_end_date : null,
    regenerate_recurrences: Boolean(regenerate_recurrences),
    send_schedule_email: Boolean(send_schedule_email),
    notification_type: normalizedNotificationType,
    notes: normalizedNotes,
    client_schedule_message: normalizedClientMessage,
  };
}

function normalizeRecurrenceScheduleInput(recurrence = {}) {
  const {
    id,
    scheduled_at = null,
    scheduled_window_mins = null,
    scheduled_window_preset = null,
    is_custom_schedule = true,
    reset_to_job_default = false,
    send_schedule_email = false,
    client_schedule_message = null,
  } = recurrence;

  if (!(Number.isInteger(id) || (typeof id === "string" && /^\d+$/.test(id)))) {
    throw new Error("recurrence.id is required and must be a valid integer");
  }

  if (!(scheduled_at === null || isValidISODate(scheduled_at))) {
    throw new Error("recurrence.scheduled_at must be a valid ISO date string or null");
  }

  if (
    !(
      scheduled_window_mins === null ||
      (Number.isInteger(scheduled_window_mins) && scheduled_window_mins > 0)
    )
  ) {
    throw new Error("recurrence.scheduled_window_mins must be a positive integer or null");
  }

  if (
    !(
      scheduled_window_preset === null ||
      ALLOWED_WINDOW_PRESETS.includes(scheduled_window_preset)
    )
  ) {
    throw new Error(
      `recurrence.scheduled_window_preset must be one of: ${ALLOWED_WINDOW_PRESETS.join(", ")} or null`
    );
  }

  return {
    id: Number(id),
    scheduled_at,
    scheduled_window_mins,
    scheduled_window_preset,
    is_custom_schedule: Boolean(is_custom_schedule),
    reset_to_job_default: Boolean(reset_to_job_default),
    send_schedule_email: Boolean(send_schedule_email),
    client_schedule_message,
  };
}

export const getScheduledJobs = async (req, res) => {
  try {
    const {
      scheduledPreset,
      scheduledStart,
      scheduledEnd,
      limit,
      page,
    } = req.query;

    const result = await Job.listScheduledOccurrences({
      scheduledPreset: typeof scheduledPreset === "string" ? scheduledPreset : undefined,
      scheduledStart: typeof scheduledStart === "string" ? scheduledStart : undefined,
      scheduledEnd: typeof scheduledEnd === "string" ? scheduledEnd : undefined,
      limit: typeof limit === "string" ? Number(limit) : undefined,
      page: typeof page === "string" ? Number(page) : undefined,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("getScheduledJobs error:", error);
    return res.status(500).json({
      error: error.message || "Failed to fetch scheduled jobs",
    });
  }
};

export const getJobsByCustomerUUID = async (req, res) => {
  const { uuid } = req.params;
  const actorUserUuid = req.user?.uuid || null;

  if (!uuid) {
    return res.status(400).json({ error: "Customer UUID is required" });
  }

  try {
    const jobs = await Job.findJobByCustomerUUID(uuid);

    return res.status(200).json({
      jobs,
      count: jobs.length,
      customer_uuid: uuid,
      actor_user_uuid: actorUserUuid ? actorUserUuid : null,
    });
  } catch (error) {
    console.error("getJobsByCustomerUUID error:", error);
    return res.status(500).json({
      error: "Failed to fetch jobs for customer",
    });
  }
};

export const createJobAccessToken = async (req, res) => {
  const { uuid } = req.params;

  if (!uuid) {
    return res.status(400).json({ error: "Job UUID is required" });
  }

  try {
    const tokenRecord = await Job.createAccessToken(uuid, 60);

    return res.status(200).json({
      success: true,
      message: "Job access token created successfully",
      access_token: {
        uuid: tokenRecord.uuid,
        job_uuid: tokenRecord.job_uuid,
        expires_at: tokenRecord.expires_at,
        created_at: tokenRecord.created_at,
      },
      plain_token: tokenRecord.plain_token,
    });
  } catch (error) {
    console.error("createJobAccessToken error:", error);

    return res.status(500).json({
      error: error.message || "Failed to create job access token",
    });
  }
};

export const regenerateJobAccessToken = async (req, res) => {
  const { uuid } = req.params;

  if (!uuid) {
    return res.status(400).json({ error: "Job UUID is required" });
  }

  try {
    await Job.revokeAllAccessTokens(uuid);
    const tokenRecord = await Job.createAccessToken(uuid, 60);

    return res.status(200).json({
      success: true,
      message: "Job access token regenerated successfully",
      access_token: {
        uuid: tokenRecord.uuid,
        job_uuid: tokenRecord.job_uuid,
        expires_at: tokenRecord.expires_at,
        created_at: tokenRecord.created_at,
      },
      plain_token: tokenRecord.plain_token,
    });
  } catch (error) {
    console.error("regenerateJobAccessToken error:", error);

    return res.status(500).json({
      error: error.message || "Failed to regenerate job access token",
    });
  }
};

export const getPublicJobView = async (req, res) => {
  const { uuid } = req.params;
  const { token } = req.query;

  if (!uuid) {
    return res.status(400).json({ error: "Job UUID is required" });
  }

  if (!token) {
    return res.status(401).json({ error: "Access token is required" });
  }

  try {
    const tokenRecord = await Job.validateAccessToken(uuid, token);

    if (!tokenRecord) {
      return res.status(403).json({ error: "Invalid access token" });
    }

    if (tokenRecord?.expired) {
      return res.status(410).json({
        error: "This public job link has expired.",
      });
    }

    const job = await Job.findPublicViewByUUID(uuid);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (job.is_completed && job.completed_date) {
      const completedAt = new Date(job.completed_date);
      const expiresAfterCompletion = new Date(completedAt);
      expiresAfterCompletion.setDate(expiresAfterCompletion.getDate() + 14);

      if (new Date() > expiresAfterCompletion) {
        return res.status(410).json({
          error: "This public job link is no longer available.",
        });
      }
    }

    return res.status(200).json({
      success: true,
      job,
    });
  } catch (error) {
    console.error("getPublicJobView error:", error);

    return res.status(500).json({
      error: error.message || "Failed to load public job view",
    });
  }
};

// export const getPublicJobView = async (req, res) => {
//   const { uuid } = req.params;

//   if (!uuid) {
//     return res.status(400).json({ error: "Job UUID is required" });
//   }

//   try {
//     const job = await Job.findPublicViewByUUID(uuid);

//     if (!job) {
//       return res.status(404).json({ error: "Job not found" });
//     }

//     const safeJob = {
//       ...job,
//       limited: true,

//       job_address: job?.job_address ? obfuscateAddress(job.job_address) : null,

//       customer: job?.customer
//         ? {
//             ...job.customer,
//             first_name: job.customer.first_name
//               ? obfuscateName(job.customer.first_name)
//               : null,
//             last_name: job.customer.last_name
//               ? obfuscateName(job.customer.last_name)
//               : null,
//             full_name: job.customer.full_name
//               ? `${obfuscateName(job.customer.first_name || "")} ${obfuscateName(
//                   job.customer.last_name || ""
//                 )}`.trim()
//               : null,
//             email: job.customer.email ? obfuscateEmail(job.customer.email) : null,
//             mobile_phone: job.customer.mobile_phone
//               ? obfuscatePhoneNumber(job.customer.mobile_phone)
//               : null,
//             landline_phone: job.customer.landline_phone
//               ? obfuscatePhoneNumber(job.customer.landline_phone)
//               : null,
//             address: job.customer.address
//               ? obfuscateAddress(job.customer.address)
//               : null,
//           }
//         : null,

//       quote: job?.quote
//         ? {
//             ...job.quote,
//             contact_first_name: job.quote.contact_first_name
//               ? obfuscateName(job.quote.contact_first_name)
//               : null,
//             contact_last_name: job.quote.contact_last_name
//               ? obfuscateName(job.quote.contact_last_name)
//               : null,
//             contact_email: job.quote.contact_email
//               ? obfuscateEmail(job.quote.contact_email)
//               : null,
//             contact_mobile: job.quote.contact_mobile
//               ? obfuscatePhoneNumber(job.quote.contact_mobile)
//               : null,
//             contact_landline: job.quote.contact_landline
//               ? obfuscatePhoneNumber(job.quote.contact_landline)
//               : null,
//             address: job.quote.address
//               ? obfuscateAddress(job.quote.address)
//               : null,
//           }
//         : null,

//       job_recurrences: Array.isArray(job?.job_recurrences)
//         ? job.job_recurrences.map((recurrence) => ({
//             ...recurrence,
//           }))
//         : [],
//     };

//     return res.status(200).json({
//       success: true,
//       job: safeJob,
//     });
//   } catch (error) {
//     console.error("getPublicJobView error:", error);

//     return res.status(500).json({
//       error: error.message || "Failed to load public job view",
//     });
//   }
// };

export const getJobRecurrences = async (req, res) => {
  const { uuid } = req.params;
  const { page = "1", limit = "5" } = req.query;

  if (!uuid) {
    return res.status(400).json({ error: "Job UUID is required" });
  }

  try {
    const existingJob = await Job.findDetailedByUUID(uuid);

    if (!existingJob) {
      return res.status(404).json({ error: "Job not found" });
    }

    const result = await JobRecurrence.findPaginatedByJobUUID(uuid, page, limit);

    return res.json({
      success: true,
      recurrences: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("getJobRecurrences error:", error);
    return res.status(500).json({
      error: error.message || "Failed to fetch recurrences",
    });
  }
};

// export const updateJobSchedule = async (req, res) => {
//   const { uuid } = req.params;
//   const { mode, job, recurrence } = req.body || {};
//   const actorUserUuid = req.user?.uuid || null;

//   if (!uuid) {
//     return res.status(400).json({ error: "Job UUID is required" });
//   }

//   if (!["job", "recurrence", "both"].includes(mode)) {
//     return res.status(400).json({
//       error: "mode must be one of: 'job', 'recurrence', 'both'",
//     });
//   }

//   let previousJob = null;
//   let previousRecurrence = null;
//   let previousFutureRecurrences = [];
//   let regeneratedRecurrences = false;
//   let jobUpdated = false;
//   let recurrenceUpdated = false;
//   let createdChangeLog = null;

//   try {
//     const existingJob = await Job.findDetailedByUUID(uuid);

//     if (!existingJob) {
//       return res.status(404).json({ error: "Job not found" });
//     }

//     previousJob = {
//       scheduled_at: existingJob.scheduled_at,
//       scheduled_window_mins: existingJob.scheduled_window_mins,
//       scheduled_window_preset: existingJob.scheduled_window_preset,
//       is_recurring: existingJob.is_recurring,
//       recurrence_frequency: existingJob.recurrence_frequency,
//       recurrence_interval: existingJob.recurrence_interval,
//       recurrence_end_date: existingJob.recurrence_end_date,
//       client_schedule_message: existingJob.client_schedule_message,
//       notes: existingJob.notes,
//       status: existingJob.status,
//     };

//     let updatedRecurrence = null;
//     let normalizedJob = null;
//     let normalizedRecurrence = null;

//     if (mode === "job" || mode === "both") {
//       normalizedJob = normalizeJobScheduleInput(job);
//       console.log("normalizedJob:", normalizedJob);

//       if (!existingJob.is_completed && existingJob.status !== "cancelled") {
//         if (normalizedJob.scheduled_at) {
//           normalizedJob.status = "scheduled";
//         } else {
//           normalizedJob.status = "pending";
//         }
//       }

//       const updatedJob = await Job.updateScheduleByUUID(uuid, normalizedJob);
//       jobUpdated = true;
//       console.log({updatedJob})
//       if (normalizedJob.is_recurring && normalizedJob.regenerate_recurrences) {
//         previousFutureRecurrences = await JobRecurrence.findFutureByJobUUID(uuid);

//         await JobRecurrence.regenerateFutureForJob(uuid, {
//           scheduled_at: normalizedJob.scheduled_at,
//           scheduled_window_mins: normalizedJob.scheduled_window_mins,
//           scheduled_window_preset: normalizedJob.scheduled_window_preset,
//           recurrence_frequency: normalizedJob.recurrence_frequency,
//           recurrence_interval: normalizedJob.recurrence_interval,
//           recurrence_end_date: normalizedJob.recurrence_end_date,
//         });

//         regeneratedRecurrences = true;
//       }
//     }

//     if (mode === "recurrence" || mode === "both") {
//       normalizedRecurrence = normalizeRecurrenceScheduleInput(recurrence);
//       console.log("normalizedRecurrence:", normalizedRecurrence);

//       const recurrenceExists = await JobRecurrence.findByIdForJob(
//         uuid,
//         normalizedRecurrence.id
//       );

//       if (!recurrenceExists) {
//         return res.status(404).json({
//           error: "Recurrence not found for this job",
//         });
//       }

//       previousRecurrence = {
//         id: recurrenceExists.id,
//         scheduled_at: recurrenceExists.scheduled_at,
//         scheduled_window_mins: recurrenceExists.scheduled_window_mins,
//         scheduled_window_preset: recurrenceExists.scheduled_window_preset,
//         is_custom_schedule: recurrenceExists.is_custom_schedule,
//       };

//       updatedRecurrence = await JobRecurrence.updateScheduleByIdForJob(
//         uuid,
//         normalizedRecurrence.id,
//         normalizedRecurrence
//       );
//       recurrenceUpdated = true;
//     }
//     console.log({updatedRecurrence})
//     let fullJob = await Job.findDetailedByUUID(uuid);

//     const shouldSendScheduleEmail =
//       Boolean(normalizedJob?.send_schedule_email) ||
//       Boolean(normalizedRecurrence?.send_schedule_email);

//     const notificationType =
//       normalizedJob?.notification_type ||
//       normalizedRecurrence?.notification_type ||
//       "schedule_update";

//     console.log("shouldSendScheduleEmail:", shouldSendScheduleEmail);
//     console.log(
//       "normalizedJob?.client_schedule_message:",
//       normalizedJob?.client_schedule_message
//     );
//     console.log(
//       "fullJob?.client_schedule_message before email:",
//       fullJob?.client_schedule_message
//     );

//     const changedFields = {};

//     if (jobUpdated) {
//       changedFields.job_schedule = {
//         old: previousJob,
//         new: {
//           scheduled_at: fullJob.scheduled_at,
//           scheduled_window_mins: fullJob.scheduled_window_mins,
//           scheduled_window_preset: fullJob.scheduled_window_preset,
//           is_recurring: fullJob.is_recurring,
//           recurrence_frequency: fullJob.recurrence_frequency,
//           recurrence_interval: fullJob.recurrence_interval,
//           recurrence_end_date: fullJob.recurrence_end_date,
//           client_schedule_message: fullJob.client_schedule_message,
//           notes: fullJob.notes,
//           status: fullJob.status,
//         },
//       };
//     }

//     if (recurrenceUpdated && previousRecurrence && updatedRecurrence) {
//       changedFields.recurrence_schedule = {
//         old: previousRecurrence,
//         new: updatedRecurrence,
//       };
//     }

//     if (Object.keys(changedFields).length > 0) {
//       createdChangeLog = await createChangeLogSafe({
//         table_name: "jobs",
//         record_uuid: uuid,
//         user_uuid: actorUserUuid,
//         action: "update",
//         summary:
//           notificationType === "rescheduled"
//             ? "Job schedule rescheduled."
//             : "Job schedule updated.",
//         changed_fields: {
//           mode,
//           ...changedFields,
//           regenerate_recurrences: Boolean(normalizedJob?.regenerate_recurrences),
//           send_schedule_email: shouldSendScheduleEmail,
//           notification_type: notificationType,
//         },
//         source: "dashboard",
//       });
//     }

//     let emailSent = false;
//     let emailError = null;

//     if (shouldSendScheduleEmail) {
//       const customerEmail =
//         fullJob?.quote?.contact_email ||
//         fullJob?.customer?.email ||
//         fullJob?.customer_email ||
//         null;

//       console.log("shouldSendScheduleEmail:", shouldSendScheduleEmail);
//       console.log("customerEmail:", customerEmail);

//       if (customerEmail) {
//         try {
//           const customerName =
//             [fullJob?.quote?.contact_first_name, fullJob?.quote?.contact_last_name]
//               .filter(Boolean)
//               .join(" ") ||
//             fullJob?.customer?.full_name ||
//             "Customer";

//           let scheduledAt = fullJob?.scheduled_at;
//           let scheduledWindow = fullJob?.scheduled_window_mins;
//           let scheduledWindowPreset = fullJob?.scheduled_window_preset;

//           if (updatedRecurrence) {
//             scheduledAt = updatedRecurrence?.scheduled_at ?? scheduledAt;
//             scheduledWindow =
//               updatedRecurrence?.scheduled_window_mins ?? scheduledWindow;
//             scheduledWindowPreset =
//               updatedRecurrence?.scheduled_window_preset ?? scheduledWindowPreset;
//           }

//           const customMessage =
//             normalizedJob?.client_schedule_message ??
//             fullJob?.client_schedule_message ??
//             null;

//           const subject =
//             notificationType === "rescheduled"
//               ? `Job Rescheduled - ${fullJob.uuid}`
//               : `Job Schedule Update - ${fullJob.uuid}`;

//           console.log("About to send schedule email", {
//             to: customerEmail,
//             subject,
//             customMessage,
//             scheduledAt,
//             scheduledWindow,
//             scheduledWindowPreset,
//           });

//           const emailResult = await sendJobScheduleToClient({
//             to: customerEmail,
//             subject,
//             data: {
//               jobUUID: fullJob.uuid,
//               customerName,
//               customerEmail,
//               address: fullJob?.job_address,
//               services: fullJob?.services || [],
//               scheduledAt,
//               scheduledWindowMins: scheduledWindow,
//               scheduledWindowPreset,
//               customMessage,
//               notificationType,
//               dashboardLink: `${process.env.CLIENT_URL}/jobs/${fullJob.uuid}/view`,
//             },
//           });

//           console.log("sendJobScheduleToClient result:", emailResult);

//           const sentMarker = await Job.markClientScheduleMessageSent(uuid);
//           console.log("sentMarker:", sentMarker);

//           emailSent = true;
//         } catch (err) {
//           console.error("Failed to send schedule email:", err);
//           emailError = err?.message || "Failed to send schedule email";
//         }
//       } else {
//         console.error("No customer email found for this job");
//         emailError = "No customer email found for this job";
//       }
//     } else {
//       console.log("Schedule email not requested");
//     }

//     fullJob = await Job.findDetailedByUUID(uuid);

//     console.log(
//       "fullJob?.client_schedule_message after refresh:",
//       fullJob?.client_schedule_message
//     );
//     console.log(
//       "fullJob?.client_schedule_message_sent_at after refresh:",
//       fullJob?.client_schedule_message_sent_at
//     );

//     return res.json({
//       success: true,
//       job: fullJob,
//       recurrence: updatedRecurrence,
//       emailSent,
//       emailError,
//       notificationType,
//     });
//   } catch (error) {
//     console.error("updateJobSchedule error:", error);

//     try {
//       if (createdChangeLog?.id) {
//         await ChangeLog.deleteById(createdChangeLog.id);
//       }

//       if (regeneratedRecurrences) {
//         await JobRecurrence.replaceFutureForJob(uuid, previousFutureRecurrences);
//       }

//       if (recurrenceUpdated && previousRecurrence) {
//         await JobRecurrence.updateScheduleByIdForJob(
//           uuid,
//           previousRecurrence.id,
//           previousRecurrence
//         );
//       }

//       if (jobUpdated && previousJob) {
//         await Job.updateScheduleByUUID(uuid, previousJob);
//       }

//       console.warn("Rollback successful");
//     } catch (rollbackError) {
//       console.error("Rollback failed:", rollbackError);
//     }

//     return res.status(500).json({
//       error: error.message || "Failed to update schedule",
//     });
//   }
// };


// export const updateJobSchedule = async (req, res) => {
//   const { uuid } = req.params;
//   const { mode, job, recurrence } = req.body || {};
//   const actorUserUuid = req.user?.uuid || null;

//   console.log({job})

//   if (!uuid) {
//     return res.status(400).json({ error: "Job UUID is required" });
//   }

//   if (!["job", "recurrence", "both"].includes(mode)) {
//     return res.status(400).json({
//       error: "mode must be one of: 'job', 'recurrence', 'both'",
//     });
//   }

//   let previousJob = null;
//   let previousRecurrence = null;
//   let previousFutureRecurrences = [];
//   let regeneratedRecurrences = false;
//   let jobUpdated = false;
//   let recurrenceUpdated = false;
//   let createdChangeLog = null;

//   try {
//     const existingJob = await Job.findDetailedByUUID(uuid);

//     if (!existingJob) {
//       return res.status(404).json({ error: "Job not found" });
//     }

//     previousJob = {
//       scheduled_at: existingJob.scheduled_at,
//       scheduled_window_mins: existingJob.scheduled_window_mins,
//       scheduled_window_preset: existingJob.scheduled_window_preset,
//       is_recurring: existingJob.is_recurring,
//       recurrence_frequency: existingJob.recurrence_frequency,
//       recurrence_interval: existingJob.recurrence_interval,
//       recurrence_end_date: existingJob.recurrence_end_date,
//       client_schedule_message: existingJob.client_schedule_message,
//       notes: existingJob.notes,
//       status: existingJob.status,
//     };

//     let updatedRecurrence = null;
//     let normalizedJob = null;
//     let normalizedRecurrence = null;

//     if (mode === "job" || mode === "both") {
//       normalizedJob = normalizeJobScheduleInput(job);
//       console.log("normalizedJob:", normalizedJob);

//       if (!existingJob.is_completed && existingJob.status !== "cancelled") {
//         normalizedJob.status = normalizedJob.scheduled_at ? "scheduled" : "pending";
//       }

//       const updatedJob = await Job.updateScheduleByUUID(uuid, normalizedJob);
//       jobUpdated = true;
//       console.log({ updatedJob });

//       if (normalizedJob.is_recurring && normalizedJob.regenerate_recurrences) {
//         previousFutureRecurrences = await JobRecurrence.findFutureByJobUUID(uuid);

//         await JobRecurrence.regenerateFutureForJob(uuid, {
//           scheduled_at: normalizedJob.scheduled_at,
//           scheduled_window_mins: normalizedJob.scheduled_window_mins,
//           scheduled_window_preset: normalizedJob.scheduled_window_preset,
//           recurrence_frequency: normalizedJob.recurrence_frequency,
//           recurrence_interval: normalizedJob.recurrence_interval,
//           recurrence_end_date: normalizedJob.recurrence_end_date,
//         });

//         regeneratedRecurrences = true;
//       }
//     }

//     if (mode === "recurrence" || mode === "both") {
//       normalizedRecurrence = normalizeRecurrenceScheduleInput(recurrence);
//       console.log("normalizedRecurrence:", normalizedRecurrence);

//       const recurrenceExists = await JobRecurrence.findByIdForJob(
//         uuid,
//         normalizedRecurrence.id
//       );

//       if (!recurrenceExists) {
//         return res.status(404).json({
//           error: "Recurrence not found for this job",
//         });
//       }

//       previousRecurrence = {
//         id: recurrenceExists.id,
//         scheduled_at: recurrenceExists.scheduled_at,
//         scheduled_window_mins: recurrenceExists.scheduled_window_mins,
//         scheduled_window_preset: recurrenceExists.scheduled_window_preset,
//         is_custom_schedule: recurrenceExists.is_custom_schedule,
//       };

//       updatedRecurrence = await JobRecurrence.updateScheduleByIdForJob(
//         uuid,
//         normalizedRecurrence.id,
//         normalizedRecurrence
//       );
//       recurrenceUpdated = true;
//     }

//     console.log({ updatedRecurrence });

//     let fullJob = await Job.findDetailedByUUID(uuid);

//     const shouldSendScheduleEmail =
//       Boolean(normalizedJob?.send_schedule_email) ||
//       Boolean(normalizedRecurrence?.send_schedule_email);

//     const notificationType =
//       normalizedJob?.notification_type ||
//       normalizedRecurrence?.notification_type ||
//       "schedule_update";

//     console.log("shouldSendScheduleEmail:", shouldSendScheduleEmail);
//     console.log(
//       "normalizedJob?.client_schedule_message:",
//       normalizedJob?.client_schedule_message
//     );
//     console.log(
//       "fullJob?.client_schedule_message before email:",
//       fullJob?.client_schedule_message
//     );

//     const changedFields = {};

//     if (jobUpdated) {
//       changedFields.job_schedule = {
//         old: previousJob,
//         new: {
//           scheduled_at: fullJob.scheduled_at,
//           scheduled_window_mins: fullJob.scheduled_window_mins,
//           scheduled_window_preset: fullJob.scheduled_window_preset,
//           is_recurring: fullJob.is_recurring,
//           recurrence_frequency: fullJob.recurrence_frequency,
//           recurrence_interval: fullJob.recurrence_interval,
//           recurrence_end_date: fullJob.recurrence_end_date,
//           client_schedule_message: fullJob.client_schedule_message,
//           notes: fullJob.notes,
//           status: fullJob.status,
//         },
//       };
//     }

//     if (recurrenceUpdated && previousRecurrence && updatedRecurrence) {
//       changedFields.recurrence_schedule = {
//         old: previousRecurrence,
//         new: updatedRecurrence,
//       };
//     }

//     if (Object.keys(changedFields).length > 0) {
//       createdChangeLog = await createChangeLogSafe({
//         table_name: "jobs",
//         record_uuid: uuid,
//         user_uuid: actorUserUuid,
//         action: "update",
//         summary:
//           notificationType === "rescheduled"
//             ? "Job schedule rescheduled."
//             : "Job schedule updated.",
//         changed_fields: {
//           mode,
//           ...changedFields,
//           regenerate_recurrences: Boolean(normalizedJob?.regenerate_recurrences),
//           send_schedule_email: shouldSendScheduleEmail,
//           notification_type: notificationType,
//         },
//         source: "dashboard",
//       });
//     }

//     let emailSent = false;
//     let emailError = null;

//     if (shouldSendScheduleEmail) {
//       const customerEmail =
//         fullJob?.quote?.contact_email ||
//         fullJob?.customer?.email ||
//         fullJob?.customer_email ||
//         null;

//       console.log("shouldSendScheduleEmail:", shouldSendScheduleEmail);
//       console.log("customerEmail:", customerEmail);

//       if (customerEmail) {
//         try {
//           const customerName =
//             formatFullName(
//               fullJob?.quote?.contact_first_name,
//               fullJob?.quote?.contact_last_name
//             ) ||
//             fullJob?.customer?.full_name ||
//             "Customer";

//           let scheduledAt = fullJob?.scheduled_at;
//           let scheduledWindow = fullJob?.scheduled_window_mins;
//           let scheduledWindowPreset = fullJob?.scheduled_window_preset;

//           if (updatedRecurrence) {
//             scheduledAt = updatedRecurrence?.scheduled_at ?? scheduledAt;
//             scheduledWindow =
//               updatedRecurrence?.scheduled_window_mins ?? scheduledWindow;
//             scheduledWindowPreset =
//               updatedRecurrence?.scheduled_window_preset ?? scheduledWindowPreset;
//           }

//           const customMessage =
//             normalizedJob?.client_schedule_message ??
//             normalizedRecurrence?.client_schedule_message ??
//             fullJob?.client_schedule_message ??
//             null;

//           const subject =
//             notificationType === "rescheduled"
//               ? `Job Rescheduled - ${fullJob.uuid}`
//               : `Job Schedule Update - ${fullJob.uuid}`;

//           console.log("About to send schedule email", {
//             to: customerEmail,
//             subject,
//             customMessage,
//             scheduledAt,
//             scheduledWindow,
//             scheduledWindowPreset,
//             hasUrgentFee: fullJob?.has_urgent_fee,
//             urgentFeeAmount: fullJob?.urgent_fee_amount,
//             subtotalAmount: fullJob?.subtotal_amount,
//             gstAmount: fullJob?.gst_amount,
//             totalAmount: fullJob?.total_amount,
//           });

//           const emailResult = await sendJobScheduleToClient({
//             to: customerEmail,
//             subject,
//             data: {
//               jobUUID: fullJob.uuid,
//               customerName,
//               address: fullJob?.job_address,
//               services: fullJob?.services || [],
//               scheduledAt,
//               scheduledWindowMins: scheduledWindow,
//               scheduledWindowPreset,
//               customMessage,
//               notificationType,
//               hasUrgentFee: fullJob?.has_urgent_fee,
//               urgentFeeAmount: fullJob?.urgent_fee_amount,
//               subtotalAmount: fullJob?.subtotal_amount,
//               gstAmount: fullJob?.gst_amount,
//               totalAmount: fullJob?.total_amount,
//             },
//           });

//           console.log("sendJobScheduleToClient result:", emailResult);

//           const sentMarker = await Job.markClientScheduleMessageSent(uuid);
//           console.log("sentMarker:", sentMarker);

//           emailSent = true;
//         } catch (err) {
//           console.error("Failed to send schedule email:", err);
//           emailError = err?.message || "Failed to send schedule email";
//         }
//       } else {
//         console.error("No customer email found for this job");
//         emailError = "No customer email found for this job";
//       }
//     } else {
//       console.log("Schedule email not requested");
//     }

//     fullJob = await Job.findDetailedByUUID(uuid);

//     console.log(
//       "fullJob?.client_schedule_message after refresh:",
//       fullJob?.client_schedule_message
//     );
//     console.log(
//       "fullJob?.client_schedule_message_sent_at after refresh:",
//       fullJob?.client_schedule_message_sent_at
//     );

//     return res.json({
//       success: true,
//       job: fullJob,
//       recurrence: updatedRecurrence,
//       emailSent,
//       emailError,
//       notificationType,
//     });
//   } catch (error) {
//     console.error("updateJobSchedule error:", error);

//     try {
//       if (createdChangeLog?.id) {
//         await ChangeLog.deleteById(createdChangeLog.id);
//       }

//       if (regeneratedRecurrences) {
//         await JobRecurrence.replaceFutureForJob(uuid, previousFutureRecurrences);
//       }

//       if (recurrenceUpdated && previousRecurrence) {
//         await JobRecurrence.updateScheduleByIdForJob(
//           uuid,
//           previousRecurrence.id,
//           previousRecurrence
//         );
//       }

//       if (jobUpdated && previousJob) {
//         await Job.updateScheduleByUUID(uuid, previousJob);
//       }

//       console.warn("Rollback successful");
//     } catch (rollbackError) {
//       console.error("Rollback failed:", rollbackError);
//     }

//     return res.status(500).json({
//       error: error.message || "Failed to update schedule",
//     });
//   }
// };

export const updateJobSchedule = async (req, res) => {
  const { uuid } = req.params;
  const { mode, job, recurrence } = req.body || {};
  const actorUserUuid = req.user?.uuid || null;

  if (!uuid) {
    return res.status(400).json({ error: "Job UUID is required" });
  }

  if (!["job", "recurrence", "both"].includes(mode)) {
    return res.status(400).json({
      error: "mode must be one of: 'job', 'recurrence', 'both'",
    });
  }

  let previousJob = null;
  let previousRecurrence = null;
  let previousFutureRecurrences = [];
  let futureRecurrencesTouched = false;
  let jobUpdated = false;
  let recurrenceUpdated = false;
  let createdChangeLog = null;

  try {
    const existingJob = await Job.findDetailedByUUID(uuid);

    if (!existingJob) {
      return res.status(404).json({ error: "Job not found" });
    }

    previousJob = {
      scheduled_at: existingJob.scheduled_at,
      scheduled_window_mins: existingJob.scheduled_window_mins,
      scheduled_window_preset: existingJob.scheduled_window_preset,
      is_recurring: existingJob.is_recurring,
      recurrence_frequency: existingJob.recurrence_frequency,
      recurrence_interval: existingJob.recurrence_interval,
      recurrence_end_date: existingJob.recurrence_end_date,
      client_schedule_message: existingJob.client_schedule_message,
      notes: existingJob.notes,
      status: existingJob.status,
    };

    let updatedRecurrence = null;
    let normalizedJob = null;
    let normalizedRecurrence = null;

    if (mode === "job" || mode === "both") {
      normalizedJob = normalizeJobScheduleInput(job);
      console.log("normalizedJob:", normalizedJob);

      if (!existingJob.is_completed && existingJob.status !== "cancelled") {
        normalizedJob.status = normalizedJob.scheduled_at ? "scheduled" : "pending";
      }

      const updatedJob = await Job.updateScheduleByUUID(uuid, normalizedJob);
      jobUpdated = true;
      console.log({ updatedJob });

      // Always capture current future recurrences before mutating them
      previousFutureRecurrences = await JobRecurrence.findFutureByJobUUID(uuid);

      // Case 1: recurring job + regenerate future rows
      if (normalizedJob.is_recurring && normalizedJob.regenerate_recurrences) {
        await JobRecurrence.regenerateFutureForJob(uuid, {
          scheduled_at: normalizedJob.scheduled_at,
          scheduled_window_mins: normalizedJob.scheduled_window_mins,
          scheduled_window_preset: normalizedJob.scheduled_window_preset,
          recurrence_frequency: normalizedJob.recurrence_frequency,
          recurrence_interval: normalizedJob.recurrence_interval,
          recurrence_end_date: normalizedJob.recurrence_end_date,
        });

        futureRecurrencesTouched = true;
      }

      // Case 2: no longer recurring -> remove future recurrence rows
      if (!normalizedJob.is_recurring) {
        await JobRecurrence.deleteFutureByJobUUID(uuid);
        futureRecurrencesTouched = true;
      }
    }

    if (mode === "recurrence" || mode === "both") {
      normalizedRecurrence = normalizeRecurrenceScheduleInput(recurrence);
      console.log("normalizedRecurrence:", normalizedRecurrence);

      const recurrenceExists = await JobRecurrence.findByIdForJob(
        uuid,
        normalizedRecurrence.id
      );

      if (!recurrenceExists) {
        return res.status(404).json({
          error: "Recurrence not found for this job",
        });
      }

      previousRecurrence = {
        id: recurrenceExists.id,
        scheduled_at: recurrenceExists.scheduled_at,
        scheduled_window_mins: recurrenceExists.scheduled_window_mins,
        scheduled_window_preset: recurrenceExists.scheduled_window_preset,
        is_custom_schedule: recurrenceExists.is_custom_schedule,
      };

      updatedRecurrence = await JobRecurrence.updateScheduleByIdForJob(
        uuid,
        normalizedRecurrence.id,
        normalizedRecurrence
      );
      recurrenceUpdated = true;
    }

    console.log({ updatedRecurrence });

    let fullJob = await Job.findDetailedByUUID(uuid);

    const shouldSendScheduleEmail =
      Boolean(normalizedJob?.send_schedule_email) ||
      Boolean(normalizedRecurrence?.send_schedule_email);

    const notificationType =
      normalizedJob?.notification_type ||
      normalizedRecurrence?.notification_type ||
      "schedule_update";

    console.log("shouldSendScheduleEmail:", shouldSendScheduleEmail);
    console.log(
      "normalizedJob?.client_schedule_message:",
      normalizedJob?.client_schedule_message
    );
    console.log(
      "fullJob?.client_schedule_message before email:",
      fullJob?.client_schedule_message
    );

    const changedFields = {};

    if (jobUpdated) {
      changedFields.job_schedule = {
        old: previousJob,
        new: {
          scheduled_at: fullJob.scheduled_at,
          scheduled_window_mins: fullJob.scheduled_window_mins,
          scheduled_window_preset: fullJob.scheduled_window_preset,
          is_recurring: fullJob.is_recurring,
          recurrence_frequency: fullJob.recurrence_frequency,
          recurrence_interval: fullJob.recurrence_interval,
          recurrence_end_date: fullJob.recurrence_end_date,
          client_schedule_message: fullJob.client_schedule_message,
          notes: fullJob.notes,
          status: fullJob.status,
        },
      };
    }

    if (recurrenceUpdated && previousRecurrence && updatedRecurrence) {
      changedFields.recurrence_schedule = {
        old: previousRecurrence,
        new: updatedRecurrence,
      };
    }

    if (futureRecurrencesTouched) {
      changedFields.future_recurrences = {
        old_count: Array.isArray(previousFutureRecurrences)
          ? previousFutureRecurrences.length
          : 0,
        new_count: Array.isArray(fullJob?.job_recurrences)
          ? fullJob.job_recurrences.filter((r) => {
            if (!r?.scheduled_at) return false;
            const now = new Date();
            return new Date(r.scheduled_at) >= now;
          }).length
          : null,
      };
    }

    if (Object.keys(changedFields).length > 0) {
      createdChangeLog = await createChangeLogSafe({
        table_name: "jobs",
        record_uuid: uuid,
        user_uuid: actorUserUuid,
        action: "update",
        summary:
          notificationType === "rescheduled"
            ? "Job schedule rescheduled."
            : "Job schedule updated.",
        changed_fields: {
          mode,
          ...changedFields,
          regenerate_recurrences: Boolean(normalizedJob?.regenerate_recurrences),
          send_schedule_email: shouldSendScheduleEmail,
          notification_type: notificationType,
        },
        source: "dashboard",
      });
    }

    let emailSent = false;
    let emailError = null;

    if (shouldSendScheduleEmail) {
      const customerEmail =
        fullJob?.quote?.contact_email ||
        fullJob?.customer?.email ||
        fullJob?.customer_email ||
        null;

      console.log("shouldSendScheduleEmail:", shouldSendScheduleEmail);
      console.log("customerEmail:", customerEmail);

      if (customerEmail) {
        try {
          const customerName =
            formatFullName(
              fullJob?.quote?.contact_first_name,
              fullJob?.quote?.contact_last_name
            ) ||
            fullJob?.customer?.full_name ||
            "Customer";

          let scheduledAt = fullJob?.scheduled_at;
          let scheduledWindow = fullJob?.scheduled_window_mins;
          let scheduledWindowPreset = fullJob?.scheduled_window_preset;

          if (updatedRecurrence) {
            scheduledAt = updatedRecurrence?.scheduled_at ?? scheduledAt;
            scheduledWindow =
              updatedRecurrence?.scheduled_window_mins ?? scheduledWindow;
            scheduledWindowPreset =
              updatedRecurrence?.scheduled_window_preset ?? scheduledWindowPreset;
          }

          const customMessage =
            normalizedJob?.client_schedule_message ??
            normalizedRecurrence?.client_schedule_message ??
            fullJob?.client_schedule_message ??
            null;

          const subject =
            notificationType === "rescheduled"
              ? `Job Rescheduled - ${fullJob.uuid}`
              : `Job Schedule Update - ${fullJob.uuid}`;

          console.log("About to send schedule email", {
            to: customerEmail,
            subject,
            customMessage,
            scheduledAt,
            scheduledWindow,
            scheduledWindowPreset,
            hasUrgentFee: fullJob?.has_urgent_fee,
            urgentFeeAmount: fullJob?.urgent_fee_amount,
            subtotalAmount: fullJob?.subtotal_amount,
            gstAmount: fullJob?.gst_amount,
            totalAmount: fullJob?.total_amount,
          });

          const emailResult = await sendJobScheduleToClient({
            to: customerEmail,
            subject,
            data: {
              jobUUID: fullJob.uuid,
              customerName,
              address: fullJob?.job_address,
              services: fullJob?.services || [],
              scheduledAt,
              scheduledWindowMins: scheduledWindow,
              scheduledWindowPreset,
              customMessage,
              notificationType,
              hasUrgentFee: fullJob?.has_urgent_fee,
              urgentFeeAmount: fullJob?.urgent_fee_amount,
              subtotalAmount: fullJob?.subtotal_amount,
              gstAmount: fullJob?.gst_amount,
              totalAmount: fullJob?.total_amount,
            },
          });

          console.log("sendJobScheduleToClient result:", emailResult);

          const sentMarker = await Job.markClientScheduleMessageSent(uuid);
          console.log("sentMarker:", sentMarker);

          emailSent = true;
        } catch (err) {
          console.error("Failed to send schedule email:", err);
          emailError = err?.message || "Failed to send schedule email";
        }
      } else {
        console.error("No customer email found for this job");
        emailError = "No customer email found for this job";
      }
    } else {
      console.log("Schedule email not requested");
    }

    fullJob = await Job.findDetailedByUUID(uuid);

    console.log(
      "fullJob?.client_schedule_message after refresh:",
      fullJob?.client_schedule_message
    );
    console.log(
      "fullJob?.client_schedule_message_sent_at after refresh:",
      fullJob?.client_schedule_message_sent_at
    );

    return res.json({
      success: true,
      job: fullJob,
      recurrence: updatedRecurrence,
      emailSent,
      emailError,
      notificationType,
    });
  } catch (error) {
    console.error("updateJobSchedule error:", error);

    try {
      if (createdChangeLog?.id) {
        await ChangeLog.deleteById(createdChangeLog.id);
      }

      if (futureRecurrencesTouched) {
        await JobRecurrence.replaceFutureForJob(uuid, previousFutureRecurrences);
      }

      if (recurrenceUpdated && previousRecurrence) {
        await JobRecurrence.updateScheduleByIdForJob(
          uuid,
          previousRecurrence.id,
          previousRecurrence
        );
      }

      if (jobUpdated && previousJob) {
        await Job.updateScheduleByUUID(uuid, previousJob);
      }

      console.warn("Rollback successful");
    } catch (rollbackError) {
      console.error("Rollback failed:", rollbackError);
    }

    return res.status(500).json({
      error: error.message || "Failed to update schedule",
    });
  }
};


function validateUUID(uuid) {
  const id = String(uuid || "").trim();

  if (!id) throw new Error("Job UUID is required");
  if (!UUID_REGEX.test(id)) throw new Error("UUID must be exactly 9 letters or numbers");

  return id;
}

/**
 * GET /api/jobs/:uuid/summary
 */

export const getJobSummaryByUUID = async (req, res) => {
  try {
    const uuid = validateUUID(req.params.uuid);
    if (!uuid) {
      return res.status(400).json({ error: "Invalid job UUID" });
    }
    const job = await Job.findSummaryByUUID(uuid);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    return res.status(200).json({ job });
  } catch (err) {
    console.error("getJobSummaryByUUID error:", err);
    return res.status(400).json({ error: err.message || "Failed to fetch job summary" });
  }
};

/**
 * GET /api/jobs/:uuid
 */

export const getJobDetailedByUUID = async (req, res) => {
  try {
    const uuid = validateUUID(req.params.uuid);
    if (!uuid) {
      return res.status(400).json({ error: "Invalid job UUID" });
    }
    const job = await Job.findDetailedByUUID(uuid);
    console.log({ job })
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    return res.status(200).json({ job });
  } catch (err) {
    console.error("getJobDetailedByUUID error:", err);
    return res.status(400).json({ error: err.message || "Failed to fetch job" });
  }
};

// export const getAllJobs = async (req, res) => {
//   try {
//     const { status, limit, page, olderThan } = req.query;

//     const result = await Job.list({
//       status: typeof status === "string" ? status : undefined,
//       limit: typeof limit === "string" ? Number(limit) : undefined,
//       page: typeof page === "string" ? Number(page) : undefined,
//       olderThanDays: typeof olderThan === "string" ? Number(olderThan) : undefined,
//     });
//     console.log({ result });
//     return res.json(result);
//   } catch (err) {
//     console.error("listJobs error:", err?.message || err);
//     return res.status(500).json({ error: err?.message || "Failed to fetch jobs" });
//   }
// };

export const getAllJobs = async (req, res) => {
  try {
    const {
      status,
      search,
      scheduledPreset,
      scheduledStart,
      scheduledEnd,
      limit,
      page,
      olderThan,
    } = req.query;

    const result = await Job.list({
      status: typeof status === "string" ? status : undefined,
      search: typeof search === "string" ? search : undefined,
      scheduledPreset: typeof scheduledPreset === "string" ? scheduledPreset : undefined,
      scheduledStart: typeof scheduledStart === "string" ? scheduledStart : undefined,
      scheduledEnd: typeof scheduledEnd === "string" ? scheduledEnd : undefined,
      limit: typeof limit === "string" ? Number(limit) : undefined,
      page: typeof page === "string" ? Number(page) : undefined,
      olderThanDays: typeof olderThan === "string" ? Number(olderThan) : undefined,
    });

    return res.json(result);
  } catch (err) {
    console.error("listJobs error:", err?.message || err);
    return res.status(500).json({
      error: err?.message || "Failed to fetch jobs",
    });
  }
};

export const backfillJobAddresses = async (req, res) => {
  const actorUserUuid = req.user?.uuid || null;

  try {
    const result = await Job.backfillJobAddressesFromQuotes();

    await createChangeLogSafe({
      table_name: "jobs",
      record_uuid: "bulk_backfill_job_addresses",
      user_uuid: actorUserUuid,
      action: "update",
      summary: "Backfilled job addresses from quotes.",
      changed_fields: {
        result,
      },
      source: "system",
    });

    return res.json(result);
  } catch (err) {
    console.error("backfillJobAddresses error:", err?.message || err);
    return res.status(500).json({ error: err?.message || "Backfill failed" });
  }
};

export const getJobByUUID = async (req, res) => {
  try {
    const { uuid } = req.params;

    const job = await Job.findByUUID(uuid);
    if (!job) return res.status(404).json({ error: "Job not found" });

    return res.json({ job });
  } catch (err) {
    console.error("getJobByUUID error:", err?.message || err);
    return res.status(500).json({ error: err?.message || "Failed to fetch job" });
  }
};

export const createJobFromQuote = async (req, res) => {
  const { quote_uuid } = req.params;
  const actorUserUuid = req.user?.uuid || null;

  if (!quote_uuid) {
    return res.status(400).json({ error: 'Missing quote UUID' });
  }

  try {
    const quote = await Quote.findByUUID(quote_uuid);
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    if (quote.status !== 'accepted') {
      return res.status(400).json({
        error: 'Job can only be created from an accepted quote'
      });
    }

    if (quote.is_deleted) {
      return res.status(400).json({
        error: 'Quote has been set to deleted at creation of job'
      });
    }

    if (quote.is_expired) {
      return res.status(400).json({
        error: 'Quote has expired at creation of job'
      });
    }

    const existingJob = await Job.findJobByQuoteUUID(quote.uuid);
    if (existingJob) {
      return res.status(400).json({ error: 'Job already exists for this quote', job: existingJob });
    }

    let uuid;
    let exists;
    do {
      uuid = generatePrefixedId("J", 8);
      exists = await Job.findByUUID(uuid);
    } while (exists);

    const job = await Job.createFromQuote({
      quote,
      uuid,
      scheduled_at: req.body?.scheduledAt ?? null,
      is_recurring: req.body?.isRecurring ?? false,
      recurrence_interval: req.body?.recurrenceInterval ?? null,
      recurrence_frequency: req.body?.recurrenceFrequency ?? null,
      recurrence_end_date: req.body?.recurrenceEndDate ?? null
    });

    await createChangeLogSafe({
      table_name: "jobs",
      record_uuid: job.uuid,
      user_uuid: actorUserUuid,
      action: "create",
      summary: "Job created from accepted quote.",
      changed_fields: {
        quote_uuid: quote.uuid,
        job_uuid: job.uuid,
        scheduled_at: job.scheduled_at ?? null,
        is_recurring: job.is_recurring ?? false,
        recurrence_interval: job.recurrence_interval ?? null,
        recurrence_frequency: job.recurrence_frequency ?? null,
        recurrence_end_date: job.recurrence_end_date ?? null,
      },
      source: "dashboard",
    });

    return res.status(201).json(job);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const hardDeleteJobByUUID = async (req, res) => {
  const { uuid } = req.params;
  const actorUserUuid = req.user?.uuid || null;

  if (!uuid) {
    return res.status(400).json({ error: 'Missing job UUID' });
  }

  try {
    const jobFound = await Job.findByUUID(uuid);
    if (!jobFound) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const deletedJob = await Job.deleteByUUID(uuid);
    if (!deletedJob) {
      return res.status(404).json({ error: 'Job not found' });
    }

    await createChangeLogSafe({
      table_name: "jobs",
      record_uuid: uuid,
      user_uuid: actorUserUuid,
      action: "delete",
      summary: "Job hard deleted.",
      changed_fields: {
        deleted_record: jobFound,
      },
      source: "dashboard",
    });

    return res.status(200).json({ data: deletedJob, message: 'Job deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const getJobByQuoteUUID = async (req, res) => {
  const { quote_uuid } = req.params;
  if (!quote_uuid) {
    return res.status(400).json({ error: 'Missing quote UUID' });
  }

  try {
    const job = await Job.findOneByQuoteUUID(quote_uuid);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    return res.status(200).json(job);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const softDeleteJobByUUID = async (req, res) => {
  const { uuid } = req.params;
  const actorUserUuid = req.user?.uuid || null;

  if (!uuid) {
    return res.status(400).json({ error: 'Missing job UUID' });
  }

  try {
    const jobFound = await Job.findByUUID(uuid);
    if (!jobFound) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const deletedDated = new Date().toISOString();
    const updatedJob = await Job.updateByUUID(uuid, {
      is_deleted: true,
      deleted_at: deletedDated
    });

    await createChangeLogSafe({
      table_name: "jobs",
      record_uuid: uuid,
      user_uuid: actorUserUuid,
      action: "delete",
      summary: "Job soft deleted.",
      changed_fields: {
        is_deleted: {
          old: jobFound.is_deleted ?? false,
          new: true,
        },
        deleted_at: {
          old: jobFound.deleted_at ?? null,
          new: deletedDated,
        },
      },
      source: "dashboard",
    });

    return res.status(200).json({ data: updatedJob, message: 'Job soft deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const updateByUUID = async (req, res) => {
  const { uuid } = req.params;
  const updates = req.body;
  const actorUserUuid = req.user?.uuid || null;

  if (!uuid) {
    return res.status(400).json({ error: "Missing job UUID" });
  }

  if (!updates || Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No updates provided" });
  }

  const jobObject = {};

  if ("status" in updates) {
    jobObject.status = updates.status;
  }

  if ("services" in updates) {
    jobObject.services = updates.services;
  }

  if ("isCompleted" in updates) {
    jobObject.is_completed = updates.isCompleted;
    jobObject.completed_date = updates.isCompleted
      ? new Date().toISOString()
      : null;
  }

  if ("isDeleted" in updates) {
    jobObject.is_deleted = updates.isDeleted;
    jobObject.deleted_at = updates.isDeleted
      ? new Date().toISOString()
      : null;
  }

  jobObject.updated_at = new Date().toISOString();

  try {
    const exists = await Job.findByUUID(uuid);
    if (!exists) {
      return res.status(404).json({ error: "Job not found" });
    }

    const job = await Job.updateByUUID(uuid, jobObject);
    if (!job) {
      return res.status(404).json({ error: "Failed to update job" });
    }

    const changedFields = {};

    if ("status" in jobObject) {
      changedFields.status = {
        old: exists.status ?? null,
        new: job.status ?? jobObject.status,
      };
    }

    if ("services" in jobObject) {
      changedFields.services = {
        old: exists.services ?? [],
        new: job.services ?? jobObject.services,
      };
    }

    if ("is_completed" in jobObject) {
      changedFields.is_completed = {
        old: exists.is_completed ?? false,
        new: job.is_completed ?? jobObject.is_completed,
      };
      changedFields.completed_date = {
        old: exists.completed_date ?? null,
        new: job.completed_date ?? jobObject.completed_date,
      };
    }

    if ("is_deleted" in jobObject) {
      changedFields.is_deleted = {
        old: exists.is_deleted ?? false,
        new: job.is_deleted ?? jobObject.is_deleted,
      };
      changedFields.deleted_at = {
        old: exists.deleted_at ?? null,
        new: job.deleted_at ?? jobObject.deleted_at,
      };
    }

    await createChangeLogSafe({
      table_name: "jobs",
      record_uuid: uuid,
      user_uuid: actorUserUuid,
      action: "update",
      summary: "Job updated.",
      changed_fields: changedFields,
      source: "dashboard",
    });

    return res.status(200).json({
      data: job,
      message: "Job updated successfully",
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

export const extendJobRecurrences = async (req, res) => {
  const actorUserUuid = req.user?.uuid || null;

  try {
    const { uuid } = req.params;
    const { count = 12 } = req.body;

    if (!uuid) {
      return res.status(400).json({ error: "Job UUID is required" });
    }

    const parsedCount = parseInt(String(count), 10);

    if (!Number.isInteger(parsedCount) || parsedCount <= 0) {
      return res.status(400).json({ error: "count must be a positive integer" });
    }

    const insertedRows = await JobRecurrence.extendFutureForJob(uuid, parsedCount);

    await createChangeLogSafe({
      table_name: "jobs",
      record_uuid: uuid,
      user_uuid: actorUserUuid,
      action: "update",
      summary: "Future job recurrences extended.",
      changed_fields: {
        inserted_count: insertedRows.length,
        recurrence_uuids: insertedRows.map((row) => row.uuid),
        requested_count: parsedCount,
      },
      source: "dashboard",
    });

    return res.status(200).json({
      message: "Recurrences extended successfully",
      insertedCount: insertedRows.length,
      recurrences: insertedRows,
    });
  } catch (error) {
    console.error("extendJobRecurrences error:", error);
    return res.status(500).json({
      error: error.message || "Failed to extend recurrences",
    });
  }
};

export const getDashboardJobs = async (req, res) => {
  try {
    const { range = "today", page = "1", limit = "10" } = req.query;

    const allowedRanges = ["attention", "today", "tomorrow", "next7days"];
    if (!allowedRanges.includes(String(range))) {
      return res.status(400).json({
        error: "range must be one of: attention, today, tomorrow, next7days",
      });
    }

    const parsedPage = parseInt(String(page), 10);
    const parsedLimit = parseInt(String(limit), 10);

    if (!Number.isInteger(parsedPage) || parsedPage <= 0) {
      return res.status(400).json({ error: "page must be a positive integer" });
    }

    if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
      return res.status(400).json({ error: "limit must be a positive integer" });
    }

    const result = await Job.findDashboardJobs({
      range: String(range),
      page: parsedPage,
      limit: parsedLimit,
    });

    return res.status(200).json({
      jobs: result.jobs,
      ...result.pagination,
    });
  } catch (error) {
    console.error("getDashboardJobs error:", error);
    return res.status(500).json({
      error: error.message || "Failed to fetch dashboard jobs",
    });
  }
};