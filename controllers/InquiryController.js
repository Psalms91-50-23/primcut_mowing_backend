import Inquiry from "../models/Inquiry.js";
import Customer from "../models/Customer.js";
import { generatePrefixedId } from "../util/util.js";
import { normalizedEmail, normalizeNZPhone, formatFullName, formatNZDate } from "../util/util.js";
import {
  sendInquiryToBusiness,
  sendInquiryToClient
} from "../lib/email/index.js";

import InquiryReply from "../models/InquiryReply.js";

// export const createInquiryReply = async (req, res) => {
//   try {
//     const { uuid } = req.params;
//     const { reply_message, recipient_email, services } = req.body;

//     if (!uuid) {
//       return res.status(400).json({ error: "Inquiry uuid is required" });
//     }

//     if (!reply_message || !reply_message.trim()) {
//       return res.status(400).json({ error: "Reply message is required" });
//     }

//     const existingInquiry = await Inquiry.findByUUID(uuid);

//     if (!existingInquiry) {
//       return res.status(404).json({ error: "Inquiry not found" });
//     }

//     const finalRecipientEmail =
//       recipient_email?.trim()?.toLowerCase() || existingInquiry.email;

//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     if (!finalRecipientEmail || !emailRegex.test(finalRecipientEmail)) {
//       return res.status(400).json({ error: "Valid recipient email is required" });
//     }

//     const finalSubject = `Re: [${existingInquiry.uuid}] ${formatFullName(existingInquiry.first_name, existingInquiry.last_name, false)}`;

//     let replyUuid;
//     let exists;

//     do {
//       replyUuid = generatePrefixedId("RIQ", 6);
//       exists = await InquiryReply.findByUUID(replyUuid);
//     } while (exists);

//     const emailResult = await sendInquiryToClient({
//       to: finalRecipientEmail,
//       subject: finalSubject,
//       data: {  
//         inquiryUuid: existingInquiry.uuid,
//         firstName: existingInquiry.first_name,
//         lastName: existingInquiry.last_name,
//         email: finalRecipientEmail,
//         phone: existingInquiry.phone ?? null,
//         services: finalSubject,
//         message: reply_message.trim(),
//       }
//     });

//     const createdReply = await InquiryReply.create({
//       uuid: replyUuid,
//       inquiry_uuid: existingInquiry.uuid,
//       sender_user_uuid: req.user?.uuid || null,
//       recipient_email: finalRecipientEmail,
//       subject: finalSubject,
//       message: reply_message.trim(),
//       sent_at: new Date().toISOString(),
//     });

//     await Inquiry.updateByUUID(existingInquiry.uuid, {
//       status: "contacted",
//     });

//     const updatedInquiry = await Inquiry.findByUUID(existingInquiry.uuid);

//     return res.status(201).json({
//       message: "Inquiry reply created, email sent, and inquiry updated successfully",
//       data: updatedInquiry,
//       inquiryReply: createdReply,
//       email: emailResult || null,
//     });
//   } catch (error) {
//     console.error("createInquiryReply error:", error);
//     return res.status(500).json({
//       error: "Failed to create inquiry reply",
//       details: error?.message || "Unknown error",
//     });
//   }
// };

export const createInquiryReply = async (req, res) => {
  try {
    const { uuid } = req.params;
    const { reply_message, recipient_email } = req.body;

    if (!uuid) {
      return res.status(400).json({ error: "Inquiry uuid is required" });
    }

    if (!reply_message || !reply_message.trim()) {
      return res.status(400).json({ error: "Reply message is required" });
    }

    const existingInquiry = await Inquiry.findByUUID(uuid);

    if (!existingInquiry) {
      return res.status(404).json({ error: "Inquiry not found" });
    }

    const finalRecipientEmail =
      recipient_email?.trim()?.toLowerCase() || existingInquiry.email;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!finalRecipientEmail || !emailRegex.test(finalRecipientEmail)) {
      return res.status(400).json({ error: "Valid recipient email is required" });
    }

    const finalSubject = `Re: [${existingInquiry.uuid}] ${formatFullName(
      existingInquiry.first_name,
      existingInquiry.last_name,
      false
    )}`;

    let replyUuid;
    let exists;

    do {
      replyUuid = generatePrefixedId("RIQ", 6);
      exists = await InquiryReply.findByUUID(replyUuid);
    } while (exists);

    const inquiryLink = `${process.env.CLIENT_URL}/employee/inquiry/${existingInquiry.uuid}`;

    const emailResult = await sendInquiryToClient({
      to: finalRecipientEmail,
      subject: finalSubject,
      data: {
        inquiryUuid: existingInquiry.uuid,
        firstName: existingInquiry.first_name,
        lastName: existingInquiry.last_name,
        email: finalRecipientEmail,
        phone: existingInquiry.phone ?? null,
        services: existingInquiry.services || [],
        message: reply_message.trim(),
        inquiryLink,
      },
    });

    const createdReply = await InquiryReply.create({
      uuid: replyUuid,
      inquiry_uuid: existingInquiry.uuid,
      sender_user_uuid: req.user?.uuid || null,
      recipient_email: finalRecipientEmail,
      subject: finalSubject,
      message: reply_message.trim(),
      sent_at: new Date().toISOString(),
    });

    const updatedInquiry = await Inquiry.updateByUUID(existingInquiry.uuid, {
      status: "contacted",
    });

    return res.status(201).json({
      message: "Inquiry reply created, email sent, and inquiry updated successfully",
      data: updatedInquiry,
      inquiryReply: createdReply,
      email: emailResult || null,
    });
  } catch (error) {
    console.error("createInquiryReply error:", error);
    return res.status(500).json({
      error: "Failed to create inquiry reply",
      details: error?.message || "Unknown error",
    });
  }
};

export const createInquiry = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, message, services } = req.body;
    console.log({services})
    console.log(req.body)
    if (!firstName?.trim()) {
      return res.status(400).json({ error: "First name is required" });
    }

    if (!lastName?.trim()) {
      return res.status(400).json({ error: "Last name is required" });
    }

    const emailToValidate = normalizedEmail(email);

    if (!emailToValidate) {
      return res.status(400).json({ error: "Valid email is required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(emailToValidate)) {
      return res.status(400).json({ error: "Valid email is required" });
    }

    if (!message?.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    // ✅ CLEAN SERVICES ARRAY
    const cleanedServices = Array.isArray(services)
      ? services
          .filter((s) => typeof s === "string" && s.trim())
          .map((s) => s.trim())
      : [];
    const normalizedPhone = normalizeNZPhone(phone?.trim() || "");
    const details = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: emailToValidate,
      phone: normalizedPhone || null,
      message: message.trim(),
      services: cleanedServices.length ? cleanedServices : null, // ✅ JSONB
    };
  

    let uuid;
    let exists;

    do {
      uuid = generatePrefixedId("INQ", 6);
      exists = await Inquiry.findByUUID(uuid);
    } while (exists);

    let customer_uuid = null;

    if (req.user?.customer_uuid) {
      customer_uuid = req.user.customer_uuid;
    } else {
      const existingCustomer = await Customer.findByEmail(emailToValidate);
      if (existingCustomer) {
        customer_uuid = existingCustomer.uuid;
      }
    }

    const inquiry = await Inquiry.create({
      uuid,
      customer_uuid,
      ...details,
      status: "new",
    });

    const inquiryLink = `${process.env.CLIENT_URL}/employee/inquiry/${inquiry.uuid}`;

    await sendInquiryToBusiness({
      to:  process.env.SEND_TO_INQUIRY || "inquiries@happyproperty.co.nz",
      subject: `[${inquiry.uuid}] ${formatFullName(inquiry.first_name, inquiry.last_name, false)} — New Inquiry`,
      data: {
      inquiryUuid: inquiry.uuid,
      firstName: inquiry.first_name,
      lastName: inquiry.last_name,
      email: inquiry.email,
      phone: inquiry.phone ?? null,
      message: inquiry.message,
      services: cleanedServices, // ✅ now array
      inquiryLink,
      created_at: formatNZDate(inquiry.created_at),
      }
    });

    return res.status(201).json({
      message: "Inquiry created successfully",
      data: inquiry,
    });
  } catch (error) {
    console.error("createInquiry error:", error);
    return res.status(500).json({
      error: "Failed to create inquiry",
      details: error?.message || "Unknown error",
    });
  }
};

export const getAllInquiries = async (req, res) => {
  try {
    const inquiries = await Inquiry.getAll();

    return res.status(200).json({
      message: "Inquiries fetched successfully",
      data: inquiries,
    });
  } catch (error) {
    console.error("getAllInquiries error:", error);
    return res.status(500).json({
      error: "Failed to fetch inquiries",
      details: error?.message || "Unknown error",
    });
  }
};

export const getInquiryByUUID = async (req, res) => {
  try {
    const { uuid } = req.params;

    if (!uuid) {
      return res.status(400).json({ error: "Inquiry uuid is required" });
    }

    const inquiry = await Inquiry.findByUUID(uuid);

    if (!inquiry) {
      return res.status(404).json({ error: "Inquiry not found" });
    }

    return res.status(200).json({
      message: "Inquiry fetched successfully",
      data: inquiry,
    });
  } catch (error) {
    console.error("getInquiryByUUID error:", error);
    return res.status(500).json({
      error: "Failed to fetch inquiry",
      details: error?.message || "Unknown error",
    });
  }
};

// export const updateInquiryByUUID = async (req, res) => {
//   try {
//     console.log("1")
//     const { uuid } = req.params;
//     const {
//       first_name,
//       last_name,
//       email,
//       phone,
//       message,
//       status,
//       reply_message,
//       reply_subject,
//       recipient_email,
//     } = req.body;

//     if (!uuid) {
//       return res.status(400).json({ error: "Inquiry uuid is required" });
//     }
//     console.log("2")
//     const existingInquiry = await Inquiry.findByUUID(uuid);

//     if (!existingInquiry) {
//       return res.status(404).json({ error: "Inquiry not found" });
//     }
//     console.log("3")
//     const updates = {};

//     if (first_name !== undefined) updates.first_name = first_name?.trim();
//     if (last_name !== undefined) updates.last_name = last_name?.trim() || null;
//     if (email !== undefined) updates.email = email?.trim().toLowerCase();
//     if (phone !== undefined) updates.phone = phone?.trim() || null;
//     if (message !== undefined) updates.message = message?.trim();
//     if (status !== undefined) updates.status = status;

//     if (updates.email) {
//       const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//       if (!emailRegex.test(updates.email)) {
//         return res.status(400).json({ error: "Valid email is required" });
//       }
//     }

//     const updatedInquiry = await Inquiry.updateByUUID(uuid, updates);
//     console.log("4")
//     let createdReply = null;
//     let emailResult = null;

//     if (reply_message !== undefined && reply_message?.trim()) {
//       const finalRecipientEmail =
//         recipient_email?.trim()?.toLowerCase() ||
//         updates.email ||
//         existingInquiry.email;

//       const finalSubject =
//         reply_subject?.trim() || `Re: Inquiry ${existingInquiry.uuid} - ${formatFullName(existingInquiry.first_name, existingInquiry.last_name, false)}`;

//       const finalPhone =
//         updatedInquiry.phone ?? existingInquiry.phone ?? null;

//       let replyUuid;
//       let exists;

//       do {
//         replyUuid = generatePrefixedId("RIQ", 6);
//         exists = await InquiryReply.findByUUID(replyUuid);
//       } while (exists);
//       console.log("5")
//       emailResult = await sendInquiryToClient({
//         inquiryUuid: existingInquiry.uuid,
//         firstName: updatedInquiry.first_name || existingInquiry.first_name,
//         lastName: updatedInquiry.last_name || existingInquiry.last_name,
//         email: finalRecipientEmail,
//         phone: finalPhone,
//         subject: finalSubject,
//         message: reply_message.trim(),
//       });
// console.log("6")
//       createdReply = await InquiryReply.create({
//         uuid: replyUuid,
//         inquiry_uuid: existingInquiry.uuid,
//         sender_user_uuid: req.user?.uuid || null,
//         recipient_email: finalRecipientEmail,
//         subject: finalSubject,
//         message: reply_message.trim(),
//         sent_at: new Date().toISOString(),
//       });
// console.log("7")
//       if (status === undefined && updatedInquiry.status !== "contacted") {
//         await Inquiry.updateByUUID(existingInquiry.uuid, {
//           status: "contacted",
//         });
//         updatedInquiry.status = "contacted";
//       }
//     }

//     return res.status(200).json({
//       message: createdReply
//         ? "Inquiry updated, reply created, and email sent successfully"
//         : "Inquiry updated successfully",
//       data: updatedInquiry,
//       inquiryReply: createdReply,
//       email: emailResult || null,
//     });
//   } catch (error) {
//     console.error("updateInquiryByUUID error:", error);
//     return res.status(500).json({
//       error: "Failed to update inquiry",
//       details: error?.message || "Unknown error",
//     });
//   }
// };
export const updateInquiryByUUID = async (req, res) => {
  try {
    console.log("updateInquiryByUUID: 1 start");
    const { uuid } = req.params;
    const {
      first_name,
      last_name,
      email,
      phone,
      message,
      status,
      reply_message,
      reply_subject,
      recipient_email,
    } = req.body;

    console.log("updateInquiryByUUID: 2 params/body", {
      uuid,
      hasReplyMessage: !!reply_message?.trim(),
      status,
      recipient_email,
      email,
    });

    if (!uuid) {
      console.log("updateInquiryByUUID: 2.1 missing uuid");
      return res.status(400).json({ error: "Inquiry uuid is required" });
    }

    console.log("updateInquiryByUUID: 3 before Inquiry.findByUUID");
    const existingInquiry = await Inquiry.findByUUID(uuid);
    console.log("updateInquiryByUUID: 4 after Inquiry.findByUUID", {
      found: !!existingInquiry,
      inquiryUuid: existingInquiry?.uuid || null,
      inquiryStatus: existingInquiry?.status || null,
      inquiryEmail: existingInquiry?.email || null,
    });

    if (!existingInquiry) {
      console.log("updateInquiryByUUID: 4.1 inquiry not found");
      return res.status(404).json({ error: "Inquiry not found" });
    }

    const updates = {};

    if (first_name !== undefined) updates.first_name = first_name?.trim();
    if (last_name !== undefined) updates.last_name = last_name?.trim() || null;
    if (email !== undefined) updates.email = email?.trim().toLowerCase();
    if (phone !== undefined) updates.phone = phone?.trim() || null;
    if (message !== undefined) updates.message = message?.trim();
    if (status !== undefined) updates.status = status;

    console.log("updateInquiryByUUID: 5 built updates", updates);

    if (updates.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updates.email)) {
        console.log("updateInquiryByUUID: 5.1 invalid email", updates.email);
        return res.status(400).json({ error: "Valid email is required" });
      }
    }

    console.log("updateInquiryByUUID: 6 before Inquiry.updateByUUID");
    const updatedInquiry = await Inquiry.updateByUUID(uuid, updates);
    console.log("updateInquiryByUUID: 7 after Inquiry.updateByUUID", {
      updated: !!updatedInquiry,
      inquiryUuid: updatedInquiry?.uuid || null,
      inquiryStatus: updatedInquiry?.status || null,
      inquiryEmail: updatedInquiry?.email || null,
    });

    if (!updatedInquiry) {
      console.log("updateInquiryByUUID: 7.1 update returned null");
      return res.status(404).json({ error: "Inquiry not found while updating" });
    }

    let createdReply = null;
    let emailResult = null;

    if (reply_message !== undefined && reply_message?.trim()) {
      console.log("updateInquiryByUUID: 8 entering reply flow");

      const finalRecipientEmail =
        recipient_email?.trim()?.toLowerCase() ||
        updates.email ||
        existingInquiry.email;

      const finalSubject =
        reply_subject?.trim() ||
        `Re: Inquiry ${existingInquiry.uuid} - ${formatFullName(
          existingInquiry.first_name,
          existingInquiry.last_name,
          false
        )}`;

      const finalPhone = updatedInquiry.phone ?? existingInquiry.phone ?? null;

      console.log("updateInquiryByUUID: 9 reply payload prepared", {
        finalRecipientEmail,
        finalSubject,
        finalPhone,
      });

      let replyUuid;
      let exists;
      let loopCount = 0;

      do {
        loopCount += 1;
        replyUuid = generatePrefixedId("RIQ", 6);
        console.log("updateInquiryByUUID: 10 before InquiryReply.findByUUID", {
          loopCount,
          replyUuid,
        });

        exists = await InquiryReply.findByUUID(replyUuid);

        console.log("updateInquiryByUUID: 11 after InquiryReply.findByUUID", {
          loopCount,
          replyUuid,
          exists: !!exists,
        });
      } while (exists);

      console.log("updateInquiryByUUID: 12 final replyUuid chosen", { replyUuid });

      console.log("updateInquiryByUUID: 13 before sendInquiryToClient");
      emailResult = await sendInquiryToClient({
        inquiryUuid: existingInquiry.uuid,
        firstName: updatedInquiry.first_name || existingInquiry.first_name,
        lastName: updatedInquiry.last_name || existingInquiry.last_name,
        email: finalRecipientEmail,
        phone: finalPhone,
        subject: finalSubject,
        message: reply_message.trim(),
      });
      console.log("updateInquiryByUUID: 14 after sendInquiryToClient", {
        emailResult,
      });

      console.log("updateInquiryByUUID: 15 before InquiryReply.create");
      createdReply = await InquiryReply.create({
        uuid: replyUuid,
        inquiry_uuid: existingInquiry.uuid,
        sender_user_uuid: req.user?.uuid || null,
        recipient_email: finalRecipientEmail,
        subject: finalSubject,
        message: reply_message.trim(),
        sent_at: new Date().toISOString(),
      });
      console.log("updateInquiryByUUID: 16 after InquiryReply.create", {
        createdReplyUuid: createdReply?.uuid || null,
      });

      if (status === undefined && updatedInquiry.status !== "contacted") {
        console.log("updateInquiryByUUID: 17 before auto-status update to contacted");
        const contactedInquiry = await Inquiry.updateByUUID(existingInquiry.uuid, {
          status: "contacted",
        });
        console.log("updateInquiryByUUID: 18 after auto-status update", {
          contacted: !!contactedInquiry,
          status: contactedInquiry?.status || null,
        });

        updatedInquiry.status = "contacted";
      }
    } else {
      console.log("updateInquiryByUUID: 8 no reply flow triggered");
    }

    console.log("updateInquiryByUUID: 19 success response");
    return res.status(200).json({
      message: createdReply
        ? "Inquiry updated, reply created, and email sent successfully"
        : "Inquiry updated successfully",
      data: updatedInquiry,
      inquiryReply: createdReply,
      email: emailResult || null,
    });
  } catch (error) {
    console.error("updateInquiryByUUID error FULL:", error);
    console.error("updateInquiryByUUID error details:", {
      message: error?.message || null,
      code: error?.code || null,
      details: error?.details || null,
      hint: error?.hint || null,
      stack: error?.stack || null,
    });

    return res.status(500).json({
      error: "Failed to update inquiry",
      details: error?.message || "Unknown error",
      code: error?.code || null,
    });
  }
};

export const deleteInquiryByUUID = async (req, res) => {
  try {
    const { uuid } = req.params;

    if (!uuid) {
      return res.status(400).json({ error: "Inquiry uuid is required" });
    }

    const existingInquiry = await Inquiry.findByUUID(uuid);

    if (!existingInquiry) {
      return res.status(404).json({ error: "Inquiry not found" });
    }

    await Inquiry.deleteByUUID(uuid);

    return res.status(200).json({
      message: "Inquiry deleted successfully",
    });
  } catch (error) {
    console.error("deleteInquiryByUUID error:", error);
    return res.status(500).json({
      error: "Failed to delete inquiry",
      details: error?.message || "Unknown error",
    });
  }
};

export const getMyInquiries = async (req, res) => {
  try {
    if (!req.user?.customer_uuid) {
      return res.status(403).json({
        error: "Customer account not found for this user",
      });
    }

    const inquiries = await Inquiry.getAllByCustomerUUID(req.user.customer_uuid);

    return res.status(200).json({
      message: "Customer inquiries fetched successfully",
      data: inquiries,
    });
  } catch (error) {
    console.error("getMyInquiries error:", error);
    return res.status(500).json({
      error: "Failed to fetch inquiries",
      details: error?.message || "Unknown error",
    });
  }
};

export const getMyInquiryByUUID = async (req, res) => {
  try {
    const { uuid } = req.params;

    if (!uuid) {
      return res.status(400).json({ error: "Inquiry uuid is required" });
    }

    if (!req.user?.customer_uuid) {
      return res.status(403).json({
        error: "Customer account not found for this user",
      });
    }

    const inquiry = await Inquiry.findCustomerInquiryByUUID(
      req.user.customer_uuid,
      uuid
    );

    if (!inquiry) {
      return res.status(404).json({ error: "Inquiry not found" });
    }

    return res.status(200).json({
      message: "Customer inquiry fetched successfully",
      data: inquiry,
    });
  } catch (error) {
    console.error("getMyInquiryByUUID error:", error);
    return res.status(500).json({
      error: "Failed to fetch inquiry",
      details: error?.message || "Unknown error",
    });
  }
};