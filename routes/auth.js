// routes/auth.js

const express = require('express');
const router = express.Router();
const passport = require('passport');
const User = require('../models/User');

// Login Route
router.post('/login', passport.authenticate('local', {
  successRedirect: '/', // Redirect to home on successful login
  failureRedirect: '/login', // Redirect to login page on failure
}));

// Logout Route
router.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/login');
});

module.exports = router;
