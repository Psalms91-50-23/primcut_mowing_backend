import Job from "../models/Job.js";
import JobAccessToken from "../models/JobAccessToken.js";
import { generatePrefixedId } from "../util/util.js";

export const create = async (req, res) => {
  const { job_uuid, expires_at } = req.body || {};

  if (!job_uuid) {
    return res.status(400).json({ message: "Job UUID is required" });
  }

  try {
    const job = await Job.findByUUID(job_uuid);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    const plainToken = JobAccessToken.generatePlainAccessToken();
    const tokenHash = JobAccessToken.hashAccessToken(plainToken);

    let uuid;
    while (true) {
      uuid = generatePrefixedId("JAT", 8);
      const existing = await JobAccessToken.findByUUID(uuid);
      if (!existing) break;
    }

    let finalExpiresAt;

    if (expires_at) {
      finalExpiresAt = new Date(expires_at).toISOString();
    } else if (job.is_completed && job.completed_date) {
      const completedAt = new Date(job.completed_date);
      completedAt.setDate(completedAt.getDate() + 14);
      finalExpiresAt = completedAt.toISOString();
    } else {
      const defaultExpiry = new Date();
      defaultExpiry.setDate(defaultExpiry.getDate() + 60);
      finalExpiresAt = defaultExpiry.toISOString();
    }

    const tokenRecord = await JobAccessToken.create({
      job_uuid,
      token_hash: tokenHash,
      expires_at: finalExpiresAt,
      uuid,
    });

    return res.status(201).json({
      success: true,
      accessToken: tokenRecord,
      plainToken,
    });
  } catch (err) {
    console.error("Create job access token error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const revokeAll = async (req, res) => {
  const { job_uuid } = req.params;

  if (!job_uuid) {
    return res.status(400).json({ message: "Job UUID is required" });
  }

  try {
    await JobAccessToken.revokeAllForJob(job_uuid);

    res.clearCookie("job_session", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "All job access tokens revoked",
    });
  } catch (err) {
    console.error("Revoke all job tokens error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const validateJobAccessToken = async (req, res) => {
  const { uuid } = req.params;
  const { token } = req.body;

  console.log("validate job token access as no cookies");

  if (!uuid || !token) {
    return res.status(400).json({ message: "Job UUID and token are required" });
  }

  try {
    const tokenHash = JobAccessToken.hashAccessToken(token);
    const now = new Date();

    const tokenRecord = await JobAccessToken.findOne(uuid, tokenHash);

    if (!tokenRecord) {
      res.clearCookie("job_session", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });

      return res.status(401).json({ message: "Invalid or expired job link" });
    }

    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < now) {
      res.clearCookie("job_session", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });

      return res.status(401).json({ message: "Invalid or expired job link" });
    }

    const job = await Job.findPublicViewByUUID(uuid);

    if (!job) {
      res.clearCookie("job_session", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });

      return res.status(401).json({ message: "Invalid or expired job link" });
    }

    if (job.is_completed && job.completed_date) {
      const completedExpiry = new Date(job.completed_date);
      completedExpiry.setDate(completedExpiry.getDate() + 14);

      if (Number.isNaN(completedExpiry.getTime()) || completedExpiry < now) {
        res.clearCookie("job_session", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        });

        return res.status(401).json({ message: "Invalid or expired job link" });
      }
    }

    const jobExpiry =
      tokenRecord.expires_at && !Number.isNaN(new Date(tokenRecord.expires_at).getTime())
        ? new Date(tokenRecord.expires_at)
        : null;

    const maxAgeMs = jobExpiry ? jobExpiry.getTime() - now.getTime() : 0;

    res.cookie("job_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: maxAgeMs > 0 ? maxAgeMs : 0,
      path: "/",
    });

    const jobAccessToken = await JobAccessToken.incrementViewCount(tokenRecord.uuid);
    if (!jobAccessToken) {
      console.warn("Job access update failed for token:", tokenRecord.uuid);
    }

    return res.status(200).json({ job });
  } catch (err) {
    console.error("Job token validation error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const viewPublicJob = async (req, res) => {
  const { uuid } = req.params;
  const token =
    req.cookies?.job_session ||
    req.query?.token ||
    req.headers["x-job-token"] ||
    null;

  if (!uuid || !token) {
    return res.status(400).json({ message: "Job UUID and token are required" });
  }

  try {
    const tokenHash = JobAccessToken.hashAccessToken(token);
    const now = new Date();

    const tokenRecord = await JobAccessToken.findOne(uuid, tokenHash);

    if (!tokenRecord) {
      return res.status(401).json({ message: "Invalid or expired job link" });
    }

    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < now) {
      return res.status(401).json({ message: "Invalid or expired job link" });
    }

    const job = await Job.findPublicViewByUUID(uuid);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    if (job.is_completed && job.completed_date) {
      const completedExpiry = new Date(job.completed_date);
      completedExpiry.setDate(completedExpiry.getDate() + 14);

      if (Number.isNaN(completedExpiry.getTime()) || completedExpiry < now) {
        return res.status(401).json({ message: "Invalid or expired job link" });
      }
    }

    return res.status(200).json({ job });
  } catch (err) {
    console.error("View public job error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};