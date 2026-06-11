require('dotenv').config({ path: './signaling-server/.env' });
const nodemailer = require('nodemailer');

console.log('Testing SMTP connection for:', process.env.SMTP_USER);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

transporter.verify(function(error, success) {
  if (error) {
    console.error('❌ CONNECTION FAILED:');
    console.error(error);
  } else {
    console.log('✅ CONNECTION SUCCESSFUL! Google accepted the password.');
  }
});
