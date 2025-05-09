const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

router.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    if(!email || !password) return res.status(400).json({message: 'Email and password required'});
    let user = await User.findOne({ email });
    if(user) return res.status(400).json({ message: 'Email already registered' });
    user = new User({ email, password });
    await user.save();
    res.status(201).json({ message: 'User created' });
  } catch(err) {
    res.status(500).json({message: 'Server error: '+err.message});
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if(!email || !password) return res.status(400).json({message: 'Email and password required'});
    const user = await User.findOne({ email });
    if(!user) return res.status(400).json({ message: 'Invalid credentials' });
    const isMatch = await user.comparePassword(password);
    if(!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token });
  } catch(err) {
    res.status(500).json({message:'Server error: '+err.message});
  }
});

module.exports = router;

