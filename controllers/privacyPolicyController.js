import PrivacyPolicy from "../models/PrivacyPolicy.js";
import {
  generatePrefixedId,
} from "../util/util.js";

export const createPrivacyPolicy = async (req, res) => {
  
  try {
    const {
      version,
      title,
      content,
      short_summary,
      pdf_url,
      pdf_storage_path,
      effective_date,
      is_active,
    } = req.body || {};

    console.log(req.body)
    if (!version?.trim()) {
      return res.status(400).json({ error: "Version is required" });
    }

    if (!title?.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }

    if (!content?.trim()) {
      return res.status(400).json({ error: "Content is required" });
    }

    const existingVersion = await PrivacyPolicy.findByVersion(version.trim());
    if (existingVersion) {
      return res.status(409).json({
        error: "A privacy policy with this version already exists",
      });
    }

    let privacyUUID;
    let exists;

    do {
      privacyUUID = generatePrefixedId("PP", 7);
      exists = await PrivacyPolicy.findByUUID(privacyUUID);
    } while (exists);


    const created = await PrivacyPolicy.create({
      uuid: privacyUUID,
      version,
      title,
      content,
      short_summary,
      pdf_url,
      pdf_storage_path,
      effective_date,
      is_active,
    });

    return res.status(201).json({
      message: "Privacy policy created successfully",
      privacy_policy: created,
    });
  } catch (error) {
    console.error("createPrivacyPolicy error:", error);
    return res.status(500).json({
      error: error.message || "Failed to create privacy policy",
    });
  }
};

export const getActivePrivacyPolicy = async (_req, res) => {
  try {
    const policy = await PrivacyPolicy.findActive();

    if (!policy) {
      return res.status(404).json({
        error: "No active privacy policy found",
      });
    }

    return res.status(200).json(policy);
  } catch (error) {
    console.error("getActivePrivacyPolicy error:", error);
    return res.status(500).json({
      error: error.message || "Failed to fetch active privacy policy",
    });
  }
};

export const getLatestPrivacyPolicy = async (_req, res) => {
  try {
    const policy = await PrivacyPolicy.findLatest();

    if (!policy) {
      return res.status(404).json({
        error: "No privacy policy found",
      });
    }

    return res.status(200).json(policy);
  } catch (error) {
    console.error("getLatestPrivacyPolicy error:", error);
    return res.status(500).json({
      error: error.message || "Failed to fetch latest privacy policy",
    });
  }
};

export const getPrivacyPolicyByUUID = async (req, res) => {
  try {
    const { uuid } = req.params;

    if (!uuid) {
      return res.status(400).json({ error: "UUID is required" });
    }

    const policy = await PrivacyPolicy.findByUUID(uuid);

    if (!policy) {
      return res.status(404).json({
        error: "Privacy policy not found",
      });
    }

    return res.status(200).json(policy);
  } catch (error) {
    console.error("getPrivacyPolicyByUUID error:", error);
    return res.status(500).json({
      error: error.message || "Failed to fetch privacy policy",
    });
  }
};

export const getPrivacyPolicyVersions = async (_req, res) => {
  try {
    const versions = await PrivacyPolicy.getAllVersions();

    return res.status(200).json({ versions });
  } catch (error) {
    console.error("getPrivacyPolicyVersions error:", error);
    return res.status(500).json({
      error: error.message || "Failed to fetch privacy policy versions",
    });
  }
};

export const listPrivacyPolicies = async (_req, res) => {
  try {
    const policies = await PrivacyPolicy.listAll();

    return res.status(200).json({
      privacy_policies: policies,
      count: policies.length,
    });
  } catch (error) {
    console.error("listPrivacyPolicies error:", error);
    return res.status(500).json({
      error: error.message || "Failed to fetch privacy policies",
    });
  }
};

export const activatePrivacyPolicy = async (req, res) => {
  try {
    const { uuid } = req.params;

    if (!uuid) {
      return res.status(400).json({ error: "UUID is required" });
    }

    const updated = await PrivacyPolicy.setActive(uuid);

    return res.status(200).json({
      message: "Privacy policy activated successfully",
      privacy_policy: updated,
    });
  } catch (error) {
    console.error("activatePrivacyPolicy error:", error);

    if (error.message === "Privacy policy not found") {
      return res.status(404).json({ error: error.message });
    }

    return res.status(500).json({
      error: error.message || "Failed to activate privacy policy",
    });
  }
};