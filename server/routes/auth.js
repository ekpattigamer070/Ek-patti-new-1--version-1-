const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const sign = (user) =>
  jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, password, displayName } = req.body;
    if (!username || !password || !displayName)
      return res.status(400).json({ error: 'username, password and displayName are required' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const user = await User.create({ username, password, displayName });
    res.json({ token: sign(user), user: publicProfile(user) });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Username already taken' });
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username: username?.toLowerCase() });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ error: 'Invalid username or password' });

    // Daily login bonus
    const now = new Date();
    const last = user.lastLoginDate ? new Date(user.lastLoginDate) : null;
    const hoursSinceLast = last ? (now - last) / 36e5 : Infinity;
    if (hoursSinceLast >= 24) {
      user.bits += 2000;
      user.currentStreak = hoursSinceLast < 48 ? user.currentStreak + 1 : 1;
      user.lastLoginDate = now;
      await user.save();
    }

    res.json({ token: sign(user), user: publicProfile(user) });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

function publicProfile(user) {
  return {
    id: user._id,
    username: user.username,
    displayName: user.displayName,
    bits: user.bits,
    wins: user.wins,
    gamesPlayed: user.gamesPlayed,
    currentStreak: user.currentStreak,
  };
}

module.exports = router;
