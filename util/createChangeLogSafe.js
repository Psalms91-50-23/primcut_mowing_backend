import ChangeLog from "../models/ChangeLog.js";

export const createChangeLogSafe = async ({
  table_name,
  record_uuid,
  user_uuid = null,
  action,
  summary = null,
  changed_fields = null,
  source = "dashboard",
}) => {
  try {
    await ChangeLog.create({
      table_name,
      record_uuid,
      user_uuid,
      action,
      summary,
      changed_fields,
      source,
    });
  } catch (logErr) {
    console.error("Change log error:", logErr.message);
  }
};