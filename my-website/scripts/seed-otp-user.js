import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/greencart';

const normalizePhone = (value) => String(value || '').replace(/[^\d+]/g, '');

const run = async () => {
  const phoneArg = process.argv[2] || '+918790082897';
  const phone = normalizePhone(phoneArg);

  if (!phone || phone.length < 8) {
    console.error('Invalid phone number. Usage: npm run seed:otp-user -- "+919876543210"');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI, { bufferCommands: false });

  const UserSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    role: { type: String, default: 'customer' },
    phone: String,
    isActive: { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: true },
  }, { timestamps: true });

  const User = mongoose.models.User || mongoose.model('User', UserSchema);

  const safePhonePart = phone.replace(/[^\d]/g, '').slice(-10) || 'user';
  const email = `otp${safePhonePart}@local.dev`;
  const hashedPassword = await bcrypt.hash('otp-login-disabled', 10);

  const user = await User.findOneAndUpdate(
    { phone },
    {
      $set: {
        name: 'OTP User',
        email,
        password: hashedPassword,
        role: 'customer',
        phone,
        isActive: true,
        emailVerified: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log('Seeded OTP user successfully');
  console.log(`Phone: ${user.phone}`);
  console.log(`Email: ${user.email}`);

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error('Failed to seed OTP user:', error?.message || error);
  try {
    await mongoose.disconnect();
  } catch {
    // Ignore disconnect errors.
  }
  process.exit(1);
});