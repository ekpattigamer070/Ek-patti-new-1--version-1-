const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  displayName: { type: String, required: true, trim: true },
  bits: { type: Number, default: 5000 },
  wins: { type: Number, default: 0 },
  gamesPlayed: { type: Number, default: 0 },
  currentStreak: { type: Number, default: 0 },
  lastLoginDate: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

userSchema.pre('save', async function () {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', userSchema);
