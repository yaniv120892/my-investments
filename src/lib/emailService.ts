import nodemailer from "nodemailer";

const EMAIL_HOST = process.env.EMAIL_HOST || "smtp.gmail.com";
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || "587");
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: false,
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
    });
  }
  return transporter;
}

export async function sendVerificationCode(
  email: string,
  code: string
): Promise<boolean> {
  if (!EMAIL_USER || !EMAIL_PASS) {
    console.error("Email credentials not configured");
    return false;
  }

  try {
    const mailOptions = {
      from: EMAIL_USER,
      to: email,
      subject: "Investment Tracker - Verification Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Investment Tracker</h2>
          <p>Your verification code is:</p>
          <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <h1 style="color: #2563eb; font-size: 32px; margin: 0; letter-spacing: 4px;">${code}</h1>
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
        </div>
      `,
    };

    await getTransporter().sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Error sending verification email:", error);
    return false;
  }
}

export async function sendWelcomeEmail(email: string): Promise<boolean> {
  if (!EMAIL_USER || !EMAIL_PASS) {
    console.error("Email credentials not configured");
    return false;
  }

  try {
    const mailOptions = {
      from: EMAIL_USER,
      to: email,
      subject: "Welcome to Investment Tracker!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Welcome to Investment Tracker!</h2>
          <p>Thank you for creating your account. You can now:</p>
          <ul>
            <li>Add and track your investments</li>
            <li>Monitor real-time market data</li>
            <li>View your portfolio performance</li>
            <li>Receive performance snapshots</li>
          </ul>
          <p>Start by adding your first investment to your portfolio!</p>
        </div>
      `,
    };

    await getTransporter().sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Error sending welcome email:", error);
    return false;
  }
}
