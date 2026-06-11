// Quick SMTP test — run from signaling-server directory
require('dotenv').config({ path: __dirname + '/signaling-server/.env' });
const nm = require(__dirname + '/signaling-server/node_modules/nodemailer');

const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
console.log('SMTP_USER:', user);
console.log('SMTP_PASS length:', (pass || '').length, 'chars');
console.log('SMTP_HOST:', process.env.SMTP_HOST);
console.log('SMTP_PORT:', process.env.SMTP_PORT);

const t = nm.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: { user, pass },
});

console.log('\nConnecting to Google SMTP...');
t.verify()
  .then(() => {
    console.log('✅ SMTP CONNECTION SUCCESSFUL! Google accepted the credentials.');
    process.exit(0);
  })
  .catch((e) => {
    console.error('❌ SMTP FAILED:', e.message);
    process.exit(1);
  });
