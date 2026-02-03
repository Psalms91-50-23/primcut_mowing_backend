import LogChange from '../models/LogChange.js';

/**
 * Get all change logs
 * Optional query params:
 *  - entity_type
 *  - entity_uuid
 */
export const getAllChangeLogs = async (req, res) => {
    try {
        const { entity_type, entity_uuid } = req.query;

        let logs;

        if (entity_type && entity_uuid) {
            logs = await LogChange.findByEntity(entity_type, entity_uuid);
        } else if (entity_type) {
            logs = await LogChange.findByEntityType(entity_type);
        } else {
            logs = await LogChange.findAll();
        }

        return res.status(200).json(logs);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

/**
 * Get change logs for a specific entity
 * Example: /logs/jobs/:uuid
 */
export const getLogsByEntity = async (req, res) => {
    try {
        const { entityType, uuid } = req.params;

        if (!entityType || !uuid) {
            return res.status(400).json({ error: 'Missing entity type or UUID' });
        }

        const logs = await LogChange.findByEntity(entityType, uuid);
        return res.status(200).json(logs);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
