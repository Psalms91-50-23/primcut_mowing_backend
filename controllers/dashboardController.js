import Job from "../models/Job.js";
import Quote from "../models/Quote.js";
import Customer from "../models/Customer.js";

export const getDashboardJobs = async (req, res) => {
  try {
    const { range = "today", page = "1", limit = "10" } = req.query;

    const allowedRanges = ["attention", "today", "tomorrow", "next7days"];
    if (!allowedRanges.includes(String(range))) {
      return res.status(400).json({
        error: "range must be one of: attention, today, tomorrow, next7days",
      });
    }

    const parsedPage = parseInt(String(page), 10);
    const parsedLimit = parseInt(String(limit), 10);

    if (!Number.isInteger(parsedPage) || parsedPage <= 0) {
      return res.status(400).json({ error: "page must be a positive integer" });
    }

    if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
      return res.status(400).json({ error: "limit must be a positive integer" });
    }

    const result = await Job.findDashboardJobs({
      range: String(range),
      page: parsedPage,
      limit: parsedLimit,
    });

    return res.status(200).json({
      jobs: result.jobs,
      ...result.pagination,
    });
  } catch (error) {
    console.error("getDashboardJobs error:", error);
    return res.status(500).json({
      error: error.message || "Failed to fetch dashboard jobs",
    });
  }
};

export const getEmployeeDashboardStats = async (req, res) => {
  try {
    const [activeJobs, customers, quotesSent, upcomingJobs] = await Promise.all([
      Job.countActiveJobs(),
      Customer.countAllActive(),
      Quote.countSentQuotes(),
      Job.countUpcomingJobs({ days: 7 }),
    ]);

    return res.status(200).json({
      activeJobs,
      customers,
      quotesSent,
      upcomingJobs,
    });
  } catch (error) {
    console.error("getEmployeeDashboardStats error:", error);
    return res.status(500).json({
      error: error.message || "Failed to fetch employee dashboard stats",
    });
  }
};