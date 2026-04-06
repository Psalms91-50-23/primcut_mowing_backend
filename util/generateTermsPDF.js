import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
/**
 * Generate a Terms & Conditions PDF
 * @param {string} content - full terms text
 * @param {string} version - version string
 * @returns {Promise<Buffer>} - PDF buffer
 */

export const generateTermsPDF = async (content, version) => {
  if (typeof content !== "string") {
    throw new Error("generateTermsPDF requires content to be a string");
  }

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

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 50,
        lineGap: 3,
      });

      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const pageLeft = doc.page.margins.left;
      const pageRight = doc.page.width - doc.page.margins.right;
      const contentWidth = pageRight - pageLeft;

      const HEADER_HEIGHT = 70;
      if (headerBuffer) {
        doc.image(headerBuffer, 0, 0, {
          width: doc.page.width,
          height: HEADER_HEIGHT,
        });
      }
      doc.y = HEADER_HEIGHT + 20;

      doc.fontSize(18).fillColor("black").font("Helvetica-Bold");
      doc.text("Terms & Conditions", pageLeft, doc.y, {
        align: "center",
        width: contentWidth,
      });

      if (version) {
        doc.moveDown(0.5);
        doc.fontSize(12).font("Helvetica").text(`Version: ${version}`, pageLeft, doc.y, {
          align: "center",
          width: contentWidth,
        });
      }

      doc.moveDown(1.5);

      doc.fontSize(11).font("Helvetica").fillColor("black");
      const paragraphs = content.split("\n\n");
      paragraphs.forEach((para) => {
        const trimmed = para.trim();
        if (!trimmed) return;
        doc.text(trimmed, { width: contentWidth, align: "justify" });
        doc.moveDown(0.8);
      });

      const FOOTER_Y = doc.page.height - 80;
      doc.fontSize(10).fillColor("black");
      doc.text("Happy Property", pageLeft, FOOTER_Y, {
        align: "center",
        width: contentWidth,
      });
      doc.text(
        "For enquiries: inquiry@happyproperty.co.nz | 021 XXX XXXX",
        pageLeft,
        FOOTER_Y + 15,
        { align: "center", width: contentWidth }
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