import Quote from "../models/Quote.js";
import Customer from "../models/Customer.js";
import { generateShortId, normalizeNZPhone } from "../util/util.js";

// Get all quotes
export const getAllQuotes = async (req, res) => {
    try {
        const quotes = await Quote.findAll();
        return res.status(200).json(quotes);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

// Get quote by ID
export const getQuoteById = async (req, res) => {
    const { id } = req.params;

    try {
        const quote = await Quote.findById(id);
        return res.status(200).json(quote);
    } catch (error) {
        return res.status(404).json({ error: error.message });
    }
};

// Get quote by UUID
export const getQuoteByUUID = async (req, res) => {
    const { uuid } = req.params;

    try {
        const quote = await Quote.findByUUID(uuid);
        return res.status(200).json(quote);
    } catch (error) {
        return res.status(404).json({ error: error.message });
    }
};

// Create quote
// export const createQuote = async (req, res) => {
//     const { customer_uuid, services, total_amount } = req.body;

//     if (!customer_uuid || !services) {
//         return res.status(400).json({ error: "Missing required fields" });
//     }

//     try {
//         const newQuote = await Quote.create(req.body);
//         res.status(201).json(newQuote);
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// };

export const createQuote = async (req, res) => {
    try {
        const { customer_uuid, services, images } = req.body;

        if (!customer_uuid) {
            return res.status(400).json({ error: 'Customer UUID is required' });
        }

        if (!services || !Array.isArray(services) || services.length === 0) {
            return res.status(400).json({ error: 'Services are required' });
        }

        const customer = await Customer.findByUUID(customer_uuid);
        if (!customer) return res.status(404).json({ error: 'Customer not found' });

        // Calculate total amount
        const total_amount = services.reduce((sum, service) => {
            const unitPrice = Number(service.unit_price) || 0;
            const quantity = Number(service.quantity) || 0;
            return sum + unitPrice * quantity;
        }, 0);

        console.log({total_amount});

        let uuid;
        let exists;
        do {
            uuid = generateShortId(9);
            exists = await Quote.findByUUID(uuid);
        } while (exists);


        const newQuoteData  = {
            uuid,
            customer_uuid,
            // services: JSON.parse(JSON.stringify(services)), 
            services,
            total_amount,
            // images: images ? JSON.parse(JSON.stringify(images)) : []
            images: images? images : []
        };


        const newQuote = await Quote.create(newQuoteData);
        console.log({newQuote})

        return res.status(201).json({ data: newQuote });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Server error' });
    }
};


// Update by UUID
export const updateQuoteByUUID = async (req, res) => {
    const { uuid } = req.params;

    try {
        const updated = await Quote.updateByUUID(uuid, req.body);
        return res.status(200).json(updated);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

// Update by ID
export const updateQuoteById = async (req, res) => {
    const { id } = req.params;

    try {
        const updated = await Quote.updateById(id, req.body);
        return res.status(200).json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Soft delete
export const softDeleteQuote = async (req, res) => {
    const { uuid } = req.params;

    try {
        const deleted = await Quote.softDelete(uuid);
        return res.status(200).json(deleted);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

// Reinstate quote
export const reinstateQuote = async (req, res) => {
    const { uuid } = req.params;

    try {
        const reinstated = await Quote.reinstate(uuid);
        return res.status(200).json(reinstated);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

// Hard delete
export const hardDeleteQuote = async (req, res) => {
    const { uuid } = req.params;

    try {
        await Quote.hardDelete(uuid);
        return res.status(200).json({ message: "Quote permanently deleted" });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

export const acceptQuote = async (req, res) => {
    const { uuid } = req.params;

    try {

        const quoteExists = await Quote.findByUUID(uuid);
        if (!quoteExists) {
            return res.status(404).json({ error: 'Quote not found' });
        }

        const acceptedQuote = await Quote.acceptQuote(uuid);
        return res.status(200).json(acceptedQuote);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

export const rejectQuote = async (req, res) => {
    const { uuid } = req.params;

    try {
        const quoteExists = await Quote.findByUUID(uuid);
        if (!quoteExists) {
            return res.status(404).json({ error: 'Quote not found' });
        }
        const rejectedQuote = await Quote.rejectQuote(uuid);
        return res.status(200).json(rejectedQuote);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}