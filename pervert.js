// Import required modules
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const moment = require('moment'); // Import moment.js library
const flash = require('connect-flash');

// Add the flash middleware


// Create Express app
const app = express();
app.use(express.static(__dirname + '/public'));
app.use(flash());


// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/ReClaim', { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;

// Check for MongoDB connection errors
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

// Define user schema
const userSchema = new mongoose.Schema({
  user_id: { type: String, required: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  dob: { type: Date, required: true },
  address: { type: String },
  phone: { type: String },
  lost_Items: { type: Array, default: [] },
  found_Items: { type: Array, default: [] },
  claimed_Items: { type: Array, default: [] },
});

// Create User model
const User = mongoose.model('users', userSchema);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'secret',
  resave: true,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

// Passport local strategy for user authentication
passport.use(new LocalStrategy(
  function(username, password, done) {
    User.findOne({ user_id: username })
      .then(user => {
        if (!user) {
          return done(null, false, { message: 'Incorrect username.' });
        }
        if (user.password !== password) {
          return done(null, false, { message: 'Incorrect password.' });
        }
        return done(null, user);
      })
      .catch(err => done(err));
  }
));

// Serialize and deserialize user
passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(async function (id, done) {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});


// Routes
app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/login.html');
});

app.get('/register', (req, res) => {
  res.sendFile(__dirname + '/register.html');
});

// Login route
app.post('/login', passport.authenticate('local', {
  successRedirect: '/dashboard',
  failureRedirect: '/login',
  failureFlash: true
}));

// Dashboard route
app.get('/dashboard', (req, res) => {
  res.sendFile(__dirname + '/dashboard.html');
});

// Registration route
app.post('/register', async (req, res) => {
  try {
    const { name, username, password, email, dob } = req.body;
    const parsedDob = moment(dob, 'DD/MM/YYYY').toDate();

    const newUser = new User({
      user_id: username,
      password: password,
      name: name,
      email: email,
      dob: parsedDob,
    });

    await newUser.save();

    res.redirect('/login');
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/login');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
