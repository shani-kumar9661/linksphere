const nodemailer = require('nodemailer');
const logger = require('../config/logger');

const sendEmail = async (options) => {
  // Check if SMTP is configured (ignoring the default 'your_smtp_username' placeholders)
  const isSMTPConfigured = 
    process.env.EMAIL_HOST && 
    process.env.EMAIL_USER && 
    process.env.EMAIL_USER !== 'your_smtp_username' &&
    process.env.EMAIL_PASS &&
    process.env.EMAIL_PASS !== 'your_smtp_password';
  
  if (!isSMTPConfigured) {
    logger.warn('SMTP configuration is incomplete or uses placeholder values. Simulating email send:');
    logger.info(`[SIMULATED EMAIL] To: ${options.to}`);
    logger.info(`[SIMULATED EMAIL] Subject: ${options.subject}`);
    logger.info(`[SIMULATED EMAIL] Text Content:\n${options.text}`);
    return { simulated: true, ...options };
  }

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT, 10) || 2525,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  // Define email options
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@linksphere.com',
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html
  };

  // Send the email
  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent successfully: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error(`Error sending email: ${error.message}`);
    throw error;
  }
};

const sendVerificationEmail = async (user, token) => {
  const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email/${token}`;
  
  const text = `Hi ${user.username},\n\nWelcome to LinkSphere! Please verify your email by clicking the link below:\n\n${verifyUrl}\n\nThis link is valid for 24 hours.\n\nBest regards,\nLinkSphere Team`;
  
  const html = `
    <div style="font-family: sans-serif; padding: 20px; color: #333;">
      <h2>Welcome to LinkSphere!</h2>
      <p>Hi ${user.username},</p>
      <p>Please click the button below to verify your email address:</p>
      <a href="${verifyUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 15px 0;">Verify Email</a>
      <p>If the button doesn't work, copy and paste this URL into your browser:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <br>
      <p>This link is valid for 24 hours.</p>
      <p>Best regards,<br>LinkSphere Team</p>
    </div>
  `;

  return await sendEmail({
    to: user.email,
    subject: 'Welcome to LinkSphere - Verify Your Email',
    text,
    html
  });
};

const sendPasswordResetEmail = async (user, token) => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${token}`;
  
  const text = `Hi ${user.username},\n\nYou requested a password reset. Please click the link below to reset your password:\n\n${resetUrl}\n\nThis link is only valid for 10 minutes.\n\nIf you did not request this, please ignore this email.\n\nBest regards,\nLinkSphere Team`;
  
  const html = `
    <div style="font-family: sans-serif; padding: 20px; color: #333;">
      <h2>Reset Your Password</h2>
      <p>Hi ${user.username},</p>
      <p>We received a request to reset the password for your LinkSphere account. Click the button below to reset it:</p>
      <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #e11d48; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 15px 0;">Reset Password</a>
      <p>If the button doesn't work, copy and paste this URL into your browser:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <br>
      <p>This link is only valid for 10 minutes. If you did not request this, you can safely ignore this email.</p>
      <p>Best regards,<br>LinkSphere Team</p>
    </div>
  `;

  return await sendEmail({
    to: user.email,
    subject: 'LinkSphere - Reset Password Request',
    text,
    html
  });
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail
};
