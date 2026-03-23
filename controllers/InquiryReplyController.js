
import InquiryReply from ("../models/inquiryReply.js");

import {
  generatePrefixedId,
} from "../util/util.js";
import {
  sendInquiryToClient,
} from "../lib/email/index.js";

const createInquiryReply = async (req, res) => {
  try {
    const authUser = req.user || null;

    const {
      inquiry_uuid,
      recipient_email,
      subject,
      message,
    } = req.body;

    if (!inquiry_uuid) {
      return res.status(400).json({ error: "inquiry_uuid is required" });
    }

    if (!recipient_email) {
      return res.status(400).json({ error: "recipient_email is required" });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "message is required" });
    }

    // ✅ Generate unique reply UUID
    let uuid;
    let exists;

    do {
      uuid = generatePrefixedId("RIQ", 6);
      exists = await InquiryReply.findByUUID(uuid);
    } while (exists);

    // ✅ Create reply
    const reply = await InquiryReply.create({
      uuid,
      inquiry_uuid,
      sender_user_uuid: authUser?.uuid || null,
      recipient_email,
      subject: subject || null,
      message: message.trim(),
      sent_at: new Date().toISOString(),
    });

    await sendInquiryToClient({
      email: recipient_email,
      subject: subject || null,
      message: message.trim(),
    });


    return res.status(201).json({
      message: "Reply sent and saved",
      reply,
    });
  } catch (error) {
    console.error("createInquiryReply error:", error);
    return res.status(500).json({ error: error.message });
  }
};

const getRepliesByInquiry = async (req, res) => {
  try {
    const { inquiry_uuid } = req.params;

    const replies = await InquiryReply.findByInquiryUUID(inquiry_uuid);

    return res.status(200).json({ replies });
  } catch (error) {
    console.error("getRepliesByInquiry error:", error);
    return res.status(500).json({ error: error.message });
  }
};

const getReplyByUUID = async (req, res) => {
  try {
    const { uuid } = req.params;

    const reply = await InquiryReply.findByUUID(uuid);

    return res.status(200).json({ reply });
  } catch (error) {
    console.error("getReplyByUUID error:", error);
    return res.status(500).json({ error: error.message });
  }
};

const deleteInquiryReply = async (req, res) => {
  try {
    const { uuid } = req.params;

    const deleted = await InquiryReply.deleteByUUID(uuid);

    return res.status(200).json({
      message: "Reply deleted",
      reply: deleted,
    });
  } catch (error) {
    console.error("deleteInquiryReply error:", error);
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createInquiryReply,
  getRepliesByInquiry,
  getReplyByUUID,
  deleteInquiryReply,
};