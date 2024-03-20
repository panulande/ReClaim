const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

const app = express();
app.use(express.static(__dirname + '/public')); // Update the path to your static files


// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/Reclaim', { useNewUrlParser: true, useUnifiedTopology: true });

// Set up User model
const User = mongoose.model('User', {
  user_id: String,
  password: String,
  email: String,
  name: String,
  address: String,
  phone: String,
  lost_Items: Array,
  found_Items: Array,
  claimed_Items: Array,
});

// Body Parser Middleware
app.use(bodyParser.urlencoded({ extended: true }));

// Express Session Middleware
app.use(session({
  secret: 'secret',
  resave: true,
  saveUninitialized: true
}));

// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

// Passport Local Strategy
passport.use(new LocalStrategy(
  function (username, password, done) {
    User.findOne({ user_id: username }, function (err, user) {
      if (err) { return done(err); }
      if (!user) {
        return done(null, false, { message: 'Incorrect username.' });
      }
      if (user.password !== password) {
        return done(null, false, { message: 'Incorrect password.' });
      }
      return done(null, user);
    });
  }
));

// Serialize User
passport.serializeUser(function (user, done) {
  done(null, user.id);
});

// Deserialize User
passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});

// Serve login.html
app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/login.html'); // Update the path accordingly
});

// Login Route
app.post('/login', passport.authenticate('local', {
  successRedirect: '/', // Redirect to home on successful login
  failureRedirect: '/login', // Redirect to login page on failure
}));

// Logout Route
app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/login');
});

// Protecting routes with authentication
app.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    res.send('Home Page');
  } else {
    res.redirect('/login');
  }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
