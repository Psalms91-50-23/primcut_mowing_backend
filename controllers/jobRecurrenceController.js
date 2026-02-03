import JobRecurrence from '../models/JobRecurrence.js';
import { generateShortId } from '../util/util.js';

/**
 * Create a single job recurrence
 */
export const createJobRecurrence = async (req, res) => {
    try {
        const {
            job_uuid,
            scheduled_at
        } = req.body;
        
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
            uuid = generateShortId(9);
            exists = await JobRecurrence.findByUUID(uuid);
        } while (exists);

        const recurrence = await JobRecurrence.create({
            uuid,
            job_uuid,
            scheduled_at
        });

        return res.status(201).json(recurrence);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

/**
 * Get all recurrences for a job
 */
export const getRecurrencesByJob = async (req, res) => {
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
        if (!uuid) {
            return res.status(400).json({ error: 'Missing recurrence UUID' });
        }

        const updated = await JobRecurrence.markCompleted(uuid);
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
        if (!uuid) {
            return res.status(400).json({ error: 'Missing recurrence UUID' });
        }

        const updated = await JobRecurrence.markMissed(uuid);
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
        if (!uuid) {
            return res.status(400).json({ error: 'Missing recurrence UUID' });
        }

        await JobRecurrence.delete(uuid, true);
        return res.status(204).send();
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
