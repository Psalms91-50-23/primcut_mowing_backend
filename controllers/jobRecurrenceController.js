import JobRecurrence from '../models/JobRecurrence.js';
import { generatePrefixedId } from '../util/util.js';
import ChangeLog from "../models/ChangeLog.js";
import { createChangeLogSafe } from '../util/createChangeLogSafe.js';

/**
 * Create a single job recurrence
 */
export const createJobRecurrence = async (req, res) => {
  try {
    const { job_uuid, scheduled_at } = req.body;
    const actorUserUuid = req.user?.uuid || null;

    if (!job_uuid) {
      return res.status(400).json({
        error: 'job_uuid is required'
      });
    }

    if (!scheduled_at) {
      return res.status(400).json({
        error: 'scheduled_at is required'
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
      scheduled_at
    });

    await createChangeLogSafe({
      table_name: "job_recurrences",
      record_uuid: recurrence.uuid,
      user_uuid: actorUserUuid,
      action: "create",
      summary: "Job recurrence created.",
      changed_fields: {
        uuid: recurrence.uuid,
        job_uuid: recurrence.job_uuid,
        scheduled_at: recurrence.scheduled_at,
        status: recurrence.status,
        is_completed: recurrence.is_completed,
        completed_date: recurrence.completed_date,
      },
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
      return res.status(400).json({ error: 'Missing job_uuid' });
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
      return res.status(400).json({ error: 'Missing recurrence UUID' });
    }

    const recurrence = await JobRecurrence.findByUUID(uuid);
    return res.status(200).json(recurrence);
  } catch (error) {
    return res.status(404).json({ error: error.message });
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
      return res.status(400).json({ error: 'Missing recurrence UUID' });
    }

    const existing = await JobRecurrence.findByUUID(uuid);
    const updated = await JobRecurrence.markCompleted(uuid);

    await createChangeLogSafe({
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
      return res.status(400).json({ error: 'Missing recurrence UUID' });
    }

    const existing = await JobRecurrence.findByUUID(uuid);
    const updated = await JobRecurrence.markMissed(uuid);

    await createChangeLogSafe({
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
      return res.status(400).json({ error: 'Missing recurrence UUID' });
    }

    const existing = await JobRecurrence.findByUUID(uuid);
    await JobRecurrence.delete(uuid, true);

    await createChangeLogSafe({
      table_name: "job_recurrences",
      record_uuid: uuid,
      user_uuid: actorUserUuid,
      action: "delete",
      summary: "Job recurrence soft deleted.",
      changed_fields: {
        status: {
          old: existing.status,
          new: "deleted",
        },
      },
      source: "dashboard",
    });

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};