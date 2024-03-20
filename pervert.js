// app.js

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

const app = express();
app.use(express.static(__dirname + '/public'));

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/ReClaim', { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;

// Check for MongoDB connection errors
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});


const userSchema = new mongoose.Schema({
  user_id: { type: String, required: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String },  // Make email optional
  address: { type: String },  // Make address optional
  phone: { type: String },  // Make phone optional
  lost_Items: { type: Array, default: [] },
  found_Items: { type: Array, default: [] },
  claimed_Items: { type: Array, default: [] },
});

const User = mongoose.model('users', userSchema);

module.exports = User;


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

// Serve HTML files
app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/login.html');
});

app.get('/register', (req, res) => {
  res.sendFile(__dirname + '/register.html');
});

// Login Route
app.post('/login', passport.authenticate('local', {
  successRedirect: '/', // Redirect to home on successful login
  failureRedirect: '/login', // Redirect to login page on failure
}));

// Registration Route
app.post('/register', async (req, res) => {
  try {
    const { name, username, password } = req.body;

    // Assuming you have the necessary fields in the registration form
    const newUser = new User({
      user_id: username,
      password: password,
      name: name,
      // Add other fields as needed
    });

    // Save the user to the database
    await newUser.save();

    // Redirect to the login page after successful registration
    res.redirect('/login');
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Internal Server Error');
  }
});

// Logout Route
app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/login');
});

// Home Route (protected)
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
