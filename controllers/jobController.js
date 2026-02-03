import Job from "../models/Job.js";
import Quote from "../models/Quote.js";
import Customer from "../models/Customer.js";
import { generateShortId, normalizeNZPhone } from "../util/util.js";

export const getAllJobs = async (req, res) => {
    try {
        const jobs = await Job.findAll();
        if(!jobs) {    
            return res.status(404).json({ error: 'No jobs found' });
        }
        return res.status(200).json(jobs);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

export const getJobByUUID = async (req, res) => {
    const { uuid } = req.params;

    try {
        const job = await Job.findByUUID(uuid);
        if(!job) {    
            return res.status(404).json({ error: 'Job not found' });
        }
        return res.status(200).json(job);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

export const createJobFromQuote  = async (req, res) => {
    const { quote_uuid } = req.params;
    if(!quote_uuid) {
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

        const existingJob = await Job.findOneByQuoteUUID(quote.uuid);
        if (existingJob) {
            return res.status(400).json({ error: 'Job already exists for this quote', job: existingJob });
        }

        let uuid;
        let exists;
        do {
            uuid = generateShortId(9);
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

        return res.status(201).json(job);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

export const hardDeleteJobByUUID = async (req, res) => {
    const { uuid } = req.params;

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
        return res.status(200).json({data: deletedJob, message: 'Job deleted successfully'});
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }   
}

export const getJobByQuoteUUID = async (req, res) => {
    const { quote_uuid } = req.params;
    if(!quote_uuid) {
        return res.status(400).json({ error: 'Missing quote UUID' });
    }

    try {
        const job = await Job.findOneByQuoteUUID(quote_uuid);
        if(!job) {    
            return res.status(404).json({ error: 'Job not found' });
        }
        return res.status(200).json(job);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

export const softDeleteJobByUUID = async (req, res) => {
    const { uuid } = req.params;

    if (!uuid) {
        return res.status(400).json({ error: 'Missing job UUID' });
    }
    try {

        const jobFound = await Job.findByUUID(uuid);
        if (!jobFound) {
            return res.status(404).json({ error: 'Job not found' });
        }
        const deletedDated = new Date().toISOString();
        const updatedJob = await Job.updateByUUID(uuid, { is_deleted: true, deleted_at: deletedDated });
        return res.status(200).json({data: updatedJob, message: 'Job soft deleted successfully'});
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }   
}

export const updateByUUID = async (req, res) => {
    const { uuid } = req.params;
    const updates = req.body;
    const { recurrenceEndDate, recurrenceInterval, recurrenceFrequency, isRecurring, isDeleted, isCompleted, completedDate, deletedAt, status, services } = req.body;
    if (!uuid) {
        return res.status(400).json({ error: 'Missing job UUID' });
    }
    if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
    }

    const jobObject = {};

    // map only what is present
    if ('scheduledAt' in updates) {
    jobObject.scheduled_at = updates.scheduledAt
        ? new Date(updates.scheduledAt).toISOString()
        : null;
    }

    if ('recurrenceEndDate' in updates) {
    jobObject.recurrence_end_date = updates.recurrenceEndDate
        ? updates.recurrenceEndDate // DATE column → keep as string
        : null;
    }

    if ('recurrenceInterval' in updates) {
    jobObject.recurrence_interval = updates.recurrenceInterval;
    }

    if ('recurrenceFrequency' in updates) {
    jobObject.recurrence_frequency = updates.recurrenceFrequency;
    }

    if ('isRecurring' in updates) {
    jobObject.is_recurring = updates.isRecurring;
    }

    if ('status' in updates) {
    jobObject.status = updates.status;
    }

    if ('services' in updates) {
    jobObject.services = updates.services;
    }

    if ('isCompleted' in updates) {
    jobObject.is_completed = updates.isCompleted;
    jobObject.completed_date = updates.isCompleted
        ? new Date().toISOString()
        : null;
    }

    jobObject.updated_at = new Date().toISOString();

    try {

        const exists = await Job.findByUUID(uuid);
        if (!exists) {
            return res.status(404).json({ error: 'Job not found' });
        }  

        const job = await Job.updateByUUID(uuid, jobObject);
        if (!job) {
            return res.status(404).json({ error: 'Failed to update job' });
        }
        return res.status(200).json({data: job, message: 'Job updated successfully'});
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
}