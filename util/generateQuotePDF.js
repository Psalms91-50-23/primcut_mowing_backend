import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { capitalize, formatMoney, formatTermsForPDF, cleanTermsForPDF } from "../util/util.js";

export const generateQuotePDF = async (quote, customer = null) => {
  
  const headerImagePath = path.join(
    process.cwd(),
    "assets/happy-house-header.png"
  );

  let headerBuffer = null;

  try {
    headerBuffer = await fs.promises.readFile(headerImagePath);
  } catch (err) {
    console.error("Header asset load failed:", err.message);
  }

  const formatRecurrenceLabel = (value) => {
    switch (value) {
      case "weekly":
        return "Weekly";
      case "fortnightly":
        return "Fortnightly";
      case "monthly":
        return "Monthly";
      case "one_off":
      default:
        return "One-off";
    }
  };

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 50,
        lineGap: 3,
      });

      const pageLeft = doc.page.margins.left;
      const pageRight = doc.page.width - doc.page.margins.right;
      const contentWidth = pageRight - pageLeft;

      const chunks = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const customerName = `${capitalize(quote.contact_first_name) || ""} ${
        capitalize(quote.contact_last_name) || ""
      }`.trim();

      const safeSubtotal = Number(quote.subtotal_amount || 0);
      const safeGST = Number(quote.gst_amount || 0);
      const safeTotal = Number(quote.total_amount || 0);
      const safeUrgentFee =
        quote.has_urgent_fee && Number.isFinite(Number(quote.urgent_fee_amount))
          ? Number(quote.urgent_fee_amount || 0)
          : 0;

      const servicesOnlySubtotal = Number(
        (quote.services || []).reduce((sum, service) => {
          const qty = Number(service.quantity || 1);
          const unit = Number(service.unit_price || 0);
          return sum + qty * unit;
        }, 0)
      );

      // ======================================================
      // HEADER IMAGE
      // ======================================================

      const HEADER_HEIGHT = 70;

      if (headerBuffer) {
        doc.image(headerBuffer, 0, 0, {
          width: doc.page.width,
          height: HEADER_HEIGHT,
        });
      }

      doc.y = HEADER_HEIGHT + 20;

      // ======================================================
      // TITLE SECTION (LEFT)
      // ======================================================

      doc.fontSize(14).fillColor("black");
      doc.text(`Quote Confirmation`, pageLeft, doc.y, { align: "left" });

      doc.fontSize(11).fillColor("black");
      doc.text(`Quote Number: ${quote.uuid || "-"}`, pageLeft, doc.y, {
        align: "left",
      });

      doc.text(
        `Date Issued: ${
          quote.created_at
            ? new Date(quote.created_at).toLocaleDateString()
            : "-"
        }`,
        pageLeft,
        doc.y,
        { align: "left" }
      );

      if (quote.responded_at) {
        doc.text(
          `Date Accepted: ${new Date(quote.responded_at).toLocaleDateString()}`,
          pageLeft,
          doc.y,
          { align: "left" }
        );
      }

      doc.moveDown(1.5);

      // ======================================================
      // TWO COLUMN LAYOUT
      // ======================================================

      const gap = 20;
      const leftColWidth = Math.floor(contentWidth * 0.58);
      const rightColWidth = contentWidth - leftColWidth - gap;

      const leftX = pageLeft;
      const rightX = leftX + leftColWidth + gap;

      const blockTopY = doc.y;

      // RIGHT COLUMN
      doc.fontSize(13).fillColor("black");
      doc.text(`Business Details`, rightX, blockTopY, {
        width: rightColWidth,
        align: "right",
      });

      doc.moveDown(0.5);

      doc.fontSize(11).fillColor("black");
      doc.text(`Phone: ${process.env.CONTACT_NUM || "-"}`, {
        width: rightColWidth,
        align: "right",
      });

      doc.text(`Email: ${process.env.QUOTES_EMAIL || "-"}`, {
        width: rightColWidth,
        align: "right",
      });

      doc.text(`Address: ${process.env.CONTACT_ADDRESS || "-"}`, {
        width: rightColWidth,
        align: "right",
      });

      const rightBottomY = doc.y;

      // LEFT COLUMN
      doc.y = blockTopY;

      doc.fontSize(13).fillColor("black").text("Client Details", leftX, doc.y, {
        width: leftColWidth,
      });

      doc.moveDown(0.5);

      doc.fontSize(11);
      doc.text(`Name: ${customerName || "-"}`, leftX, doc.y, {
        width: leftColWidth,
      });

      doc.text(`Email: ${quote.contact_email || "-"}`, {
        width: leftColWidth,
      });

      doc.text(`Mobile: ${quote.contact_mobile || "-"}`, {
        width: leftColWidth,
      });

      doc.text(`Landline: ${quote.contact_landline || "-"}`, {
        width: leftColWidth,
      });

      doc.text(
        `Service Frequency: ${formatRecurrenceLabel(
          quote.recurrence_frequency || "one_off"
        )}`,
        {
          width: leftColWidth,
        }
      );

      doc.moveDown(1);

      doc.fontSize(13).text("Service Address", leftX, doc.y, {
        width: leftColWidth,
      });

      doc.moveDown(0.3);

      doc.fontSize(11).text(quote.address || "-", leftX, doc.y, {
        width: leftColWidth,
      });

      const leftBottomY = doc.y;

      doc.y = Math.max(leftBottomY, rightBottomY);

      doc.moveDown(1);

      doc.moveTo(pageLeft, doc.y).lineTo(pageRight, doc.y).stroke();
      doc.moveDown(1);

      // ======================================================
      // SCOPE TABLE
      // ======================================================

      doc.fontSize(13).fillColor("black").text("Scope of Work");
      doc.moveDown(0.6);

      const tableStartY = doc.y + 10;

      const MONEY_COL_WIDTH = 110;
      const MONEY_COL_X = pageRight - MONEY_COL_WIDTH;

      const QTY_COL_WIDTH = 50;
      const UNIT_COL_WIDTH = 90;

      const colServiceX = pageLeft;
      const colQtyX = MONEY_COL_X - UNIT_COL_WIDTH - QTY_COL_WIDTH - 20;
      const colUnitPriceX = MONEY_COL_X - UNIT_COL_WIDTH - 10;

      doc.rect(pageLeft, tableStartY, contentWidth, 22).fill("#f0fdf4");

      doc.fillColor("black").fontSize(12);

      doc.text("Service", colServiceX, tableStartY + 6, {
        width: colQtyX - colServiceX - 10,
        align: "left",
      });

      doc.text("Qty", colQtyX, tableStartY + 6, {
        width: QTY_COL_WIDTH,
        align: "right",
      });

      doc.text("Unit Price", colUnitPriceX, tableStartY + 6, {
        width: UNIT_COL_WIDTH,
        align: "right",
      });

      doc.text("Line Total", MONEY_COL_X, tableStartY + 6, {
        width: MONEY_COL_WIDTH,
        align: "right",
      });

      let y = tableStartY + 28;

      quote.services?.forEach((service) => {
        const qty = Number(service.quantity || 1);
        const unit = Number(service.unit_price || 0);
        const lineTotal = qty * unit;

        doc.fontSize(10).fillColor("black");

        doc.text(service.label || service.description || "Service", colServiceX, y, {
          width: colQtyX - colServiceX - 10,
          align: "left",
        });

        doc.text(qty.toString(), colQtyX, y, {
          width: QTY_COL_WIDTH,
          align: "right",
        });

        doc.text(`$${unit.toFixed(2)}`, colUnitPriceX, y, {
          width: UNIT_COL_WIDTH,
          align: "right",
        });

        doc.text(`$${formatMoney(lineTotal)}`, MONEY_COL_X, y, {
          width: MONEY_COL_WIDTH,
          align: "right",
        });

        y += 22;
      });

      // ======================================================
      // PRICING SUMMARY
      // ======================================================

      doc.y = y + 14;

      const LABEL_WIDTH = 140;
      const LABEL_X = MONEY_COL_X - LABEL_WIDTH;

      doc.fontSize(11).fillColor("black");

      doc.text("Services Subtotal:", LABEL_X, doc.y, {
        width: LABEL_WIDTH,
        align: "right",
      });
      doc.text(`$${formatMoney(servicesOnlySubtotal)}`, MONEY_COL_X, doc.y - 15, {
        width: MONEY_COL_WIDTH,
        align: "right",
      });

      if (safeUrgentFee > 0) {
        doc.moveDown(0.5);
        doc.fillColor("#991b1b");
        doc.text("Urgent Fee:", LABEL_X, doc.y, {
          width: LABEL_WIDTH,
          align: "right",
        });
       doc.text(`$${formatMoney(safeUrgentFee)}`, MONEY_COL_X, doc.y - 15, {
          width: MONEY_COL_WIDTH,
          align: "right",
        });
        doc.fillColor("black");
      }

      doc.moveDown(0.5);
      doc.text("Subtotal:", LABEL_X, doc.y, { width: LABEL_WIDTH, align: "right" });
      doc.text(`$${formatMoney(safeSubtotal)}`, MONEY_COL_X, doc.y - 15, {
        width: MONEY_COL_WIDTH,
        align: "right",
      });

      doc.moveDown(0.5);
      doc.text("GST (15%):", LABEL_X, doc.y, { width: LABEL_WIDTH, align: "right" });
      doc.text(`$${formatMoney(safeGST)}`, MONEY_COL_X, doc.y - 15, {
        width: MONEY_COL_WIDTH,
        align: "right",
      });

      doc.moveDown(0.6);
      doc.fontSize(12).font("Helvetica-Bold");
      doc.text("TOTAL:", LABEL_X, doc.y, { width: LABEL_WIDTH, align: "right" });
      doc.text(`$${formatMoney(safeTotal)}`, MONEY_COL_X, doc.y - 15, {
        width: MONEY_COL_WIDTH,
        align: "right",
      });
      doc.font("Helvetica");

      doc.moveDown(1);

      // ======================================================
      // FOOTER
      // ======================================================

      const FOOTER_Y = doc.page.height - 80;

      doc.fontSize(10).fillColor("black");

      doc.text("Thank you for choosing Happy Property", pageLeft, FOOTER_Y, {
        align: "center",
        width: contentWidth,
      });

      doc.text(
        "For enquiries please contact support@happyproperty.co.nz | 021 XXX XXXX",
        pageLeft,
        FOOTER_Y + 15,
        {
          align: "center",
          width: contentWidth,
        }
      );

      const GREEN_900 = "#14532d";
      const BAR_HEIGHT = 5;

      doc.save();
      doc
        .fillColor(GREEN_900)
        .rect(0, doc.page.height - BAR_HEIGHT, doc.page.width, BAR_HEIGHT)
        .fill();
      doc.restore();

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};