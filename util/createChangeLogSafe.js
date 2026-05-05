import ChangeLog from "../models/ChangeLog.js";

export const createChangeLogSafe = async ({
  uuid,
  table_name,
  record_uuid,
  user_uuid = null,
  action,
  summary = null,
  changed_fields = null,
  oldData = null,
  newData = null,
  source = "dashboard",
}) => {
  try {
    const log = await ChangeLog.create({
      uuid,
      table_name,
      record_uuid,
      user_uuid,
      action,
      summary,
      changed_fields,
      oldData,
      newData,
      source,
    });

    return log || null;
  } catch (logErr) {
    console.error("Change log error:", logErr.message);
    return null;
  }
};

