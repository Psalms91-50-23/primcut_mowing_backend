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

        // 2. Business rules
        if (quote.status !== 'accepted') {
            return res.status(400).json({
                error: 'Job can only be created from an accepted quote'
            });
        }

        if (quote.is_deleted || quote.is_expired) {
            return res.status(400).json({
                error: 'Quote is not valid for job creation'
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

        // 3. Create job using quote data
        const job = await Job.createFromQuote({
            quote,
            uuid,
            scheduled_at: req.body?.scheduled_at ?? null,
            is_recurring: req.body?.is_recurring ?? false,
            recurrence_interval: req.body?.recurrence_interval ?? null,
            recurrence_frequency: req.body?.recurrence_frequency ?? null,
            recurrence_end_date: req.body?.recurrence_end_date ?? null
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