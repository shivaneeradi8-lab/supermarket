// Run this once MongoDB is running:  node scripts/seed-seller-shivacharan.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/greencart';

const run = async () => {
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

  const email = process.env.SELLER_EMAIL || process.argv[2];
  const password = process.env.SELLER_PASSWORD || process.argv[3];
  const name = process.env.SELLER_NAME || process.argv[4] || 'shivacharan';

  if (!email || !password) {
    throw new Error('Provide SELLER_EMAIL and SELLER_PASSWORD env vars or pass email and password as args.');
  }

  const hash = await bcrypt.hash(password, 12);

  const user = await User.findOneAndUpdate(
    { email },
    {
      $set: {
        name,
        email,
        password: hash,
        role: 'seller',
        isActive: true,
        emailVerified: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log('✅ Seller account created/updated!');
  console.log(`   Name   : ${user.name}`);
  console.log(`   Email  : ${user.email}`);
  console.log(`   Role   : ${user.role}`);

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error('❌ Failed:', error?.message || error);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
