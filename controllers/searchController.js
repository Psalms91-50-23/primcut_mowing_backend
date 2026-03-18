import Customer from "../models/Customer.js";
import Quote from "../models/Quote.js";
import Job from "../models/Job.js";

export const globalSearch = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const type = String(req.query.type || "all").trim().toLowerCase();

    if (!q) {
      return res.status(400).json({ error: "q is required" });
    }

    let customers = [];
    let quotes = [];
    let jobs = [];

    if (type === "all" || type === "customers") {
      customers = await Customer.searchSummary(q, 10);
    }

    if (type === "all" || type === "quotes") {
      quotes = await Quote.searchSummary(q, 10);
    }

    if (type === "all" || type === "jobs") {
      jobs = await Job.searchSummary(q, 10);
    }

    return res.status(200).json({
      query: q,
      customers,
      quotes,
      jobs,
    });
  } catch (error) {
    console.error("globalSearch error:", error);
    return res.status(500).json({
      error: error.message || "Search failed",
    });
  }
};