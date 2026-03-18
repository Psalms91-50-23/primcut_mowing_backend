import ChangeLog from "../models/ChangeLog.js";

export const getAllChangeLogs = async (req, res) => {
  try {
    const { table_name, record_uuid, user_uuid } = req.query;

    let logs;

    if (table_name && record_uuid) {
      logs = await ChangeLog.findByRecord(table_name, record_uuid);
    } else if (table_name) {
      logs = await ChangeLog.findByTable(table_name);
    } else if (user_uuid) {
      logs = await ChangeLog.findByUser(user_uuid);
    } else {
      logs = await ChangeLog.findAll();
    }

    return res.status(200).json(logs);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const getLogsByEntity = async (req, res) => {
  try {
    const { table, uuid } = req.params;

    if (!table || !uuid) {
      return res.status(400).json({ error: "Missing table or UUID" });
    }

    const logs = await ChangeLog.findByRecord(table, uuid);
    return res.status(200).json(logs);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};