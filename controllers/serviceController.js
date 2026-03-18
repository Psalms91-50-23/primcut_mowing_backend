import Service from "../models/Service.js";

export const getAllServices = async (req, res) => {
  try {
    const services = await Service.getAllActive();

    return res.status(200).json({
      data: services,
    });
  } catch (error) {
    console.error("getAllServices error:", error);
    return res.status(500).json({
      error: error.message || "Failed to fetch services",
    });
  }
};

export const getServiceByUUID = async (req, res) => {
  try {
    const { uuid } = req.params;

    if (!uuid) {
      return res.status(400).json({
        error: "Service uuid is required",
      });
    }

    const service = await Service.getByUUID(uuid);

    return res.status(200).json({
      data: service,
    });
  } catch (error) {
    console.error("getServiceByUUID error:", error);

    if (
      error.message?.toLowerCase().includes("no rows") ||
      error.message?.toLowerCase().includes("json object requested")
    ) {
      return res.status(404).json({
        error: "Service not found",
      });
    }

    return res.status(500).json({
      error: error.message || "Failed to fetch service",
    });
  }
};