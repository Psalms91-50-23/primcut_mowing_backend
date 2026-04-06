import JobRecurrence from "../models/JobRecurrence.js";
import ChangeLog from "../models/ChangeLog.js";
import {
  generatePrefixedId,
  generateUniqueChangeLogUUID,
} from "../util/util.js";
import { createChangeLogSafe } from "../util/createChangeLogSafe.js";

import { sendJobRecurrenceRescheduledToClient } from "../lib/email/index.js"

/**
 * Helpers
 */
const round2 = (value) => {
  const num = Number(value || 0);
  return Math.round(num * 100) / 100;
};

const sanitizeService = (service = {}) => {
  const quantity = Number(service.quantity ?? 1);
  const unitPrice = Number(service.unit_price ?? 0);
  const lineTotal =
    service.line_total !== undefined && service.line_total !== null
      ? Number(service.line_total)
      : quantity * unitPrice;

  return {
    service_uuid: service.service_uuid ?? null,
    code: service.code ?? null,
    label: service.label ?? service.value ?? "Service",
    description: service.description ?? null,
    unit: service.unit ?? null,
    quantity: Number.isFinite(quantity) && quantity >= 0 ? quantity : 0,
    unit_price: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0,
    line_total: Number.isFinite(lineTotal) ? round2(lineTotal) : 0,
  };
};

const sanitizeServicesArray = (services) => {
  if (!Array.isArray(services)) return [];
  return services.map(sanitizeService);
};

const calculateTotalsFromServices = (services = []) => {
  const subtotal = round2(
    services.reduce((sum, service) => {
      const qty = Number(service.quantity ?? 0);
      const unitPrice = Number(service.unit_price ?? 0);
      const lineTotal =
        service.line_total !== undefined && service.line_total !== null
          ? Number(service.line_total)
          : qty * unitPrice;

      return sum + (Number.isFinite(lineTotal) ? lineTotal : 0);
    }, 0)
  );

  const gst = round2(subtotal * 0.15);
  const total = round2(subtotal + gst);

  return {
    subtotal_amount: subtotal,
    gst_amount: gst,
    total_amount: total,
  };
};

const buildChangedFields = (oldRecord, newRecord, allowedFields = []) => {
  const changed = {};

  for (const field of allowedFields) {
    const oldVal = oldRecord?.[field] ?? null;
    const newVal = newRecord?.[field] ?? null;

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changed[field] = {
        old: oldVal,
        new: newVal,
      };
    }
  }

  return changed;
};

/**
 * Create a single job recurrence
 */
export const createJobRecurrence = async (req, res) => {
  try {
    const { job_uuid, scheduled_at } = req.body;
    const actorUserUuid = req.user?.uuid || null;

    if (!job_uuid) {
      return res.status(400).json({
        error: "job_uuid is required",
      });
    }

    if (!scheduled_at) {
      return res.status(400).json({
        error: "scheduled_at is required",
      });
    }

    let uuid;
    let exists;

    do {
      uuid = generatePrefixedId("JR", 7);
      try {
        exists = await JobRecurrence.findByUUID(uuid);
      } catch {
        exists = null;
      }
    } while (exists);

    const recurrence = await JobRecurrence.create({
      uuid,
      job_uuid,
      scheduled_at,
    });

    await createChangeLogSafe({
      uuid: await generateUniqueChangeLogUUID(),
      table_name: "job_recurrences",
      record_uuid: recurrence.uuid,
      user_uuid: actorUserUuid,
      action: "create",
      summary: "Job recurrence created.",
      changed_fields: {
        uuid: {
          old: null,
          new: recurrence.uuid,
        },
        job_uuid: {
          old: null,
          new: recurrence.job_uuid,
        },
        scheduled_at: {
          old: null,
          new: recurrence.scheduled_at,
        },
        status: {
          old: null,
          new: recurrence.status,
        },
        is_completed: {
          old: null,
          new: recurrence.is_completed,
        },
        completed_date: {
          old: null,
          new: recurrence.completed_date,
        },
      },
      oldData: null,
      newData: recurrence,
      source: "dashboard",
    });

    return res.status(201).json(recurrence);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Get all recurrences for a job
 */
export const getRecurrencesByJobUUID = async (req, res) => {
  try {
    const { job_uuid } = req.params;

    if (!job_uuid) {
      return res.status(400).json({ error: "Missing job_uuid" });
    }

    const recurrences = await JobRecurrence.findByJob(job_uuid);
    return res.status(200).json(recurrences);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Get a single recurrence by UUID
 */
export const getRecurrenceByUUID = async (req, res) => {
  try {
    const { uuid } = req.params;

    if (!uuid) {
      return res.status(400).json({ error: "Missing recurrence UUID" });
    }

    const recurrence = await JobRecurrence.findByUUID(uuid);

    if (!recurrence) {
      return res.status(404).json({ error: "Recurrence not found" });
    }

    return res.status(200).json(recurrence);
  } catch (error) {
    return res.status(404).json({ error: error.message });
  }
};

/**
 * General recurrence update
 * Allows:
 * - schedule updates
 * - service overrides
 * - removing inherited services
 * - recalculating totals
 */

export const updateRecurrence = async (req, res) => {
  try {
    const { uuid } = req.params;
    const actorUserUuid = req.user?.uuid || null;

    if (!uuid) {
      return res.status(400).json({ error: "Missing recurrence UUID" });
    }

    const existing = await JobRecurrence.findByUUID(uuid);

    if (!existing) {
      return res.status(404).json({ error: "Recurrence not found" });
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
      clear_service_override,
    } = req.body || {};
    console.log(req.body, "body");
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

    if (clear_service_override === true) {
      updates.services = null;
      updates.subtotal_amount = null;
      updates.gst_amount = null;
      updates.total_amount = null;
      updates.pricing_source = "job_default";
    } else if (services !== undefined) {
      const cleanedServices = sanitizeServicesArray(services);

      updates.services = cleanedServices;

      const computedTotals = calculateTotalsFromServices(cleanedServices);

      updates.subtotal_amount =
        subtotal_amount !== undefined && subtotal_amount !== null
          ? round2(subtotal_amount)
          : computedTotals.subtotal_amount;

      updates.gst_amount =
        gst_amount !== undefined && gst_amount !== null
          ? round2(gst_amount)
          : computedTotals.gst_amount;

      updates.total_amount =
        total_amount !== undefined && total_amount !== null
          ? round2(total_amount)
          : computedTotals.total_amount;

      updates.pricing_source = pricing_source || "recurrence_override";
    } else {
      if (subtotal_amount !== undefined) {
        updates.subtotal_amount =
          subtotal_amount === null ? null : round2(subtotal_amount);
      }

      if (gst_amount !== undefined) {
        updates.gst_amount = gst_amount === null ? null : round2(gst_amount);
      }

      if (total_amount !== undefined) {
        updates.total_amount = total_amount === null ? null : round2(total_amount);
      }

      if (pricing_source !== undefined) {
        updates.pricing_source = pricing_source;
      }
    }

    const updated = await JobRecurrence.update(uuid, updates);

    const changedFields = buildChangedFields(existing, updated, [
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
      "updated_at",
    ]);

    await createChangeLogSafe({
      uuid: await generateUniqueChangeLogUUID(),
      table_name: "job_recurrences",
      record_uuid: uuid,
      user_uuid: actorUserUuid,
      action: "update",
      summary:
        clear_service_override === true
          ? "Job recurrence reset to parent job service pricing."
          : services !== undefined
          ? "Job recurrence services updated."
          : "Job recurrence updated.",
      changed_fields: changedFields,
      oldData: existing,
      newData: updated,
      source: "dashboard",
    });

    return res.status(200).json(updated);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Mark recurrence as completed
 */
export const completeRecurrence = async (req, res) => {
  try {
    const { uuid } = req.params;
    const actorUserUuid = req.user?.uuid || null;

    if (!uuid) {
      return res.status(400).json({ error: "Missing recurrence UUID" });
    }

    const existing = await JobRecurrence.findByUUID(uuid);

    if (!existing) {
      return res.status(404).json({ error: "Recurrence not found" });
    }

    const updated = await JobRecurrence.markCompleted(uuid);

    await createChangeLogSafe({
      uuid: await generateUniqueChangeLogUUID(),
      table_name: "job_recurrences",
      record_uuid: uuid,
      user_uuid: actorUserUuid,
      action: "update",
      summary: "Job recurrence marked as completed.",
      changed_fields: {
        is_completed: {
          old: existing.is_completed,
          new: updated.is_completed,
        },
        completed_date: {
          old: existing.completed_date,
          new: updated.completed_date,
        },
        status: {
          old: existing.status,
          new: updated.status,
        },
      },
      oldData: existing,
      newData: updated,
      source: "dashboard",
    });

    return res.status(200).json(updated);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Mark recurrence as missed
 */
export const missRecurrence = async (req, res) => {
  try {
    const { uuid } = req.params;
    const actorUserUuid = req.user?.uuid || null;

    if (!uuid) {
      return res.status(400).json({ error: "Missing recurrence UUID" });
    }

    const existing = await JobRecurrence.findByUUID(uuid);

    if (!existing) {
      return res.status(404).json({ error: "Recurrence not found" });
    }

    const updated = await JobRecurrence.markMissed(uuid);

    await createChangeLogSafe({
      uuid: await generateUniqueChangeLogUUID(),
      table_name: "job_recurrences",
      record_uuid: uuid,
      user_uuid: actorUserUuid,
      action: "update",
      summary: "Job recurrence marked as missed.",
      changed_fields: {
        status: {
          old: existing.status,
          new: updated.status,
        },
      },
      oldData: existing,
      newData: updated,
      source: "dashboard",
    });

    return res.status(200).json(updated);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Delete recurrence (soft by default)
 */
export const deleteRecurrence = async (req, res) => {
  try {
    const { uuid } = req.params;
    const actorUserUuid = req.user?.uuid || null;

    if (!uuid) {
      return res.status(400).json({ error: "Missing recurrence UUID" });
    }

    const existing = await JobRecurrence.findByUUID(uuid);

    if (!existing) {
      return res.status(404).json({ error: "Recurrence not found" });
    }

    const deleted = await JobRecurrence.delete(uuid, true);

    await createChangeLogSafe({
      uuid: await generateUniqueChangeLogUUID(),
      table_name: "job_recurrences",
      record_uuid: uuid,
      user_uuid: actorUserUuid,
      action: "delete",
      summary: "Job recurrence soft deleted.",
      changed_fields: {
        status: {
          old: existing.status,
          new: deleted?.status ?? "deleted",
        },
      },
      oldData: existing,
      newData: deleted ?? {
        ...existing,
        status: "deleted",
      },
      source: "dashboard",
    });

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const tempBackfillRecurrenceServicesFromParent = async (req, res) => {
  try {
    const { job_uuid } = req.body || {};
    const actorUserUuid = req.user?.uuid || null;

    const result = await JobRecurrence.tempBackfillServicesFromParentJobs({
      job_uuid,
      actorUserUuid,
    });

    await createChangeLogSafe({
      uuid: await generateUniqueChangeLogUUID(),
      table_name: "job_recurrences",
      record_uuid: job_uuid || "bulk-temp-backfill",
      user_uuid: actorUserUuid,
      action: "update",
      summary: job_uuid
        ? `Temp backfill run for recurrences under job ${job_uuid}.`
        : "Temp backfill run for recurrence services from parent jobs.",
      changed_fields: {
        job_uuid: {
          old: null,
          new: job_uuid || null,
        },
        matched_count: {
          old: null,
          new: result.matchedCount,
        },
        updated_count: {
          old: null,
          new: result.updatedCount,
        },
      },
      oldData: null,
      newData: result,
      source: "dashboard",
    });

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
  
};

export const updateRecurrenceAndNotifyClient = async (req, res) => {
  try {
    const { uuid } = req.params;
    const actorUserUuid = req.user?.uuid || null;

    if (!uuid) {
      return res.status(400).json({ error: "Missing recurrence UUID" });
    }

    const existing = await JobRecurrence.findByUUID(uuid);

    if (!existing) {
      return res.status(404).json({ error: "Recurrence not found" });
    }

    const {
      custom_message = null,
      notification_type = "schedule_update",
      ...updateInput
    } = req.body || {};

    let result = await JobRecurrence.updateAndPrepareClientNotification(uuid, {
      ...updateInput,
      client_schedule_message: custom_message,
      client_schedule_message_sent_at: null,
    });

    let { updated, job, customer, emailData } = result;

    let emailSent = false;
    let emailError = null;

    if (customer?.email) {
      try {
        await sendJobRecurrenceRescheduledToClient({
          to: customer.email,
          subject:
            notification_type === "rescheduled"
              ? `Service Rescheduled - ${job?.uuid || updated?.uuid || "Job"}`
              : `Schedule Update - ${job?.uuid || updated?.uuid || "Job"}`,
          data: {
            ...emailData,
            customMessage: custom_message,
            reasonLabel:
              notification_type === "rescheduled"
                ? "Rescheduled"
                : "Schedule updated",
          },
        });

        emailSent = true;

        const sentAt = new Date().toISOString();

        result = await JobRecurrence.updateAndPrepareClientNotification(uuid, {
          client_schedule_message_sent_at: sentAt,
        });

        updated = result.updated;
        job = result.job;
        customer = result.customer;
        emailData = result.emailData;
      } catch (err) {
        console.error("Failed to send recurrence notify email:", err.message);
        emailError = err.message;
      }
    } else {
      emailError = "Customer email not found";
    }

    await createChangeLogSafe({
      uuid: await generateUniqueChangeLogUUID(),
      table_name: "job_recurrences",
      record_uuid: uuid,
      user_uuid: actorUserUuid,
      action: "update",
      summary: emailSent
        ? "Job recurrence updated and client notified."
        : "Job recurrence updated. Client notification attempted.",
      changed_fields: {
        ...(result.changedFields || {}),
        email_sent: {
          old: null,
          new: emailSent,
        },
        email_error: {
          old: null,
          new: emailError,
        },
      },
      oldData: existing,
      newData: updated,
      source: "dashboard",
    });

    return res.status(200).json({
      recurrence: updated,
      emailSent,
      emailError,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};