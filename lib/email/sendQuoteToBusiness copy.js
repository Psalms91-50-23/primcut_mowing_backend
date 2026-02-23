import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export default async function sendQuoteToBusiness ({
  quoteUuid,
  firstName,
  lastName,
  mobile,
  landline,
  email,
  message,
  services = [],
  images = [],
  employeeLink,
}){

 const servicesHtml = (services || [])
  .map((service) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">
        ${service.label || service.value || JSON.stringify(service)}
      </td>
    </tr>
  `)
  .join("");

  const imagesHtml = (images || [])
    .map((img) => {
      const url = img.url || img;

      return `
        <div style="padding: 8px;">
          <a href="${url}" target="_blank" style="text-decoration: none;">
            <img
              src="${url}"
              alt="Quote image"
              style="
                width: 100%;
                height: auto;
                max-width: 250px;
                max-height: 250px;
                border-radius: 8px;
                border: 1px solid #ddd;
                display: block;
              "
            />
          </a>
        </div>
      `;
    })
    .join("");

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.SEND_TO,
    subject: "New Quote Request",
    html: `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 700px; margin: auto;">

      <div style="background: #14532D; padding: 20px 16px; border-radius: 10px 10px 0 0; display: flex; align-items: center;">
        <h1 style="margin: 0; font-weight: bold; font-size: 28px; color: #fff; display: flex; align-items: center;">
        <span style="font-size: 36px; margin: 0;">H</span>
        <img
          src="https://${process.env.FRONTEND_URL_HAPPY_LAWNS}/images/happy-house-1.png"
          alt="Happy Property Logo"
          style="
            width: 64px;
            height: 64px;
            display: block;
            margin: 0;
            padding: 0;
          "
        />
        <span style="font-size: 36px; margin: 0;">ppy Lawns</span>
      </h1>
      </div>

        <!-- CONTENT -->
        <div style="background: #fff; padding: 20px 16px; border-radius: 0 0 10px 10px; border: 1px solid #eee; border-top: none;">

          <h2 style="margin-top: 0; color: #064e3b;">New Quote Request</h2>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
            <tbody>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Quote UUID</td>
                <td style="padding: 8px;">${quoteUuid}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Full Name</td>
                <td style="padding: 8px;">${firstName || ""} ${lastName || ""}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Mobile</td>
                <td style="padding: 8px;">${mobile || "—"}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Landline</td>
                <td style="padding: 8px;">${landline || "—"}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Email</td>
                <td style="padding: 8px;">${email || "—"}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Message</td>
                <td style="padding: 8px;">${message || "—"}</td>
              </tr>
            </tbody>
          </table>

          <h3 style="margin-bottom: 8px;">Services</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
            <tbody>
              ${servicesHtml}
            </tbody>
          </table>

          <h3 style="margin-bottom: 8px;">Images</h3>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
            ${imagesHtml}
          </div>

          <div style="margin-top: 20px;">
            <strong>Admin link:</strong>
            <a href="${employeeLink}" style="color: #064e3b;">${employeeLink}</a>
          </div>

        </div>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};
