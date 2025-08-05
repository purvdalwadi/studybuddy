const nodemailer = require('nodemailer');
const ErrorResponse = require('./errorResponse');

// Create a transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USERNAME,
    pass: process.env.SMTP_PASSWORD,
  },
});

// Verify connection configuration
transporter.verify(function (error, success) {
  if (error) {
    console.error('SMTP connection error:', error);
  } else {
    console.log('Server is ready to take our messages');
  }
});

// Send email function
const sendEmail = async (options) => {
  try {
    // Support both 'email' and 'to' for the recipient's email address
    const to = options.email || options.to;
    
    if (!to) {
      throw new Error('No recipient email address provided');
    }

    console.log('Sending email with options:', {
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to,
      subject: options.subject,
      hasHtml: !!options.html,
      hasText: !!options.text
    });

    // Send mail with defined transport object
    const info = await transporter.sendMail({
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    console.log('Message sent successfully:', info.messageId);
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw new ErrorResponse('Email could not be sent', 500);
  }
};

// Email templates
const emailTemplates = {
  resetPassword: (user, resetUrl) => ({
    subject: 'Password Reset Request',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hello ${user.name},</h2>
        <p>You are receiving this email because you (or someone else) has requested a password reset for your account.</p>
        <p>Please click the following link to reset your password:</p>
        <p style="margin: 25px 0;">
          <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px;">
            Reset Password
          </a>
        </p>
        <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
        <p>This link will expire in 1 hour.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          This email was sent from ${process.env.FROM_EMAIL}
        </p>
      </div>
    `,
    text: `Hello ${user.name},\n\nYou are receiving this email because you (or someone else) has requested a password reset for your account.\n\nPlease click the following link to reset your password:\n\n${resetUrl}\n\nIf you did not request this, please ignore this email and your password will remain unchanged.\n\nThis link will expire in 1 hour.`,
  }),
  welcome: (user) => ({
    subject: 'Welcome to StudyBuddy!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to StudyBuddy, ${user.name}!</h2>
        <p>Thank you for signing up. We're excited to have you on board.</p>
        <p>Start exploring study groups, join discussions, and connect with fellow students.</p>
        <p style="margin: 25px 0;">
          <a href="${process.env.CLIENT_URL}/dashboard" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px;">
            Go to Dashboard
          </a>
        </p>
        <p>If you have any questions, feel free to reply to this email.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          This email was sent from ${process.env.FROM_EMAIL}
        </p>
      </div>
    `,
    text: `Welcome to StudyBuddy, ${user.name}!\n\nThank you for signing up. We're excited to have you on board.\n\nStart exploring study groups, join discussions, and connect with fellow students at ${process.env.CLIENT_URL}/dashboard\n\nIf you have any questions, feel free to reply to this email.`,
  }),
};

module.exports = { sendEmail, emailTemplates };
