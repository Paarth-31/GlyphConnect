// Check if required packages are available
const packages = ['otpauth', 'nodemailer', 'bcryptjs', 'jsonwebtoken'];
packages.forEach(pkg => {
  try {
    require(pkg);
    console.log('✅', pkg, 'installed');
  } catch (e) {
    console.log('❌', pkg, 'MISSING');
  }
});
