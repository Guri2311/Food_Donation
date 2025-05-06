const nodemailer = require("nodemailer");

const sendEmail = async (...args) => {
  // Support both function styles
  let to, subject, text;

  if (args.length === 1 && typeof args[0] === "object") {
    // Object-style call: { to, subject, text }
    ({ to, subject, text } = args[0]);
  } else {
    // Separate arguments: (to, subject, text)
    [to, subject, text] = args;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "savingfood2003@gmail.com",
      pass: "isng ogua usil citc", // App password
    },
  });

  const mailOptions = {
    from: "savingfood2003@gmail.com",
    to,
    subject,
    text,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully to", to);
  } catch (error) {
    console.error("❌ Error sending email:", error);
  }
};

module.exports = sendEmail;
