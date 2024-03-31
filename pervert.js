// Import required modules
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const moment = require('moment'); // Import moment.js library
const flash = require('connect-flash');
const multer = require('multer');
const path = require('path');


// Create Express app
const app = express();
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'ejs');
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

const adminSchema = new mongoose.Schema({
  admin_id: { type: String, required: true },
  password: { type: String, required: true },
  email: { type: String, required: true },
  admin_username: { type: String, required: true }
});

const lostItemSchema = new mongoose.Schema({
  itemName: String,
  date: Date,
  place: String,
  description: String,
  photo: Buffer, // Store file data as Buffer
  document: Buffer, // Store file data as Buffer
  status: { type: String, default: 'reported' }, // Default value 'reported' for status
  reportedItems: { type: String, default: 'active' } // Default value 'active' for reportedItems
});



// Create User model
const User = mongoose.model('users', userSchema);
const Admin = mongoose.model('admins', adminSchema);
const LostItem = mongoose.model('lost_items', lostItemSchema);

// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//       cb(null, './uploads');
//   },
//   filename: function (req, file, cb) {
//       cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
//   }
// });



const storage = multer.memoryStorage(); // Store file data in memory

const upload = multer({ storage: storage });


// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'secret',
  resave: true,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}


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

//admin

passport.use('admin', new LocalStrategy(
  function(username, password, done) {
    Admin.findOne({ admin_id: username, password: password })
      .then(admin => {
        if (!admin) {
          return done(null, false, { message: 'Incorrect admin credentials.' });
        }
        return done(null, admin);
      })
      .catch(err => done(err));
  }
));

// Serialize and deserialize admin
passport.serializeUser(function (user, done) {
  done(null, admin.admin_id); // Assuming user.admin_id is the correct field for the admin's ID
});


passport.deserializeUser(async function (id, done) {
  try {
    const admin = await Admin.findOne({ admin_id: id }); // Assuming admin_id is the correct field for the admin's ID
    done(null, admin);
  } catch (error) {
    done(error, null);
  }
});

// Routes
app.get('/adminLogin', (req, res) => {
  res.render('adminLogin');
});

app.post('/adminLogin', passport.authenticate('admin', {
  successRedirect: '/adminDashboard',
  failureRedirect: '/adminLogin',
  failureFlash: true
}));

app.get('/adminDashboard', (req, res) => {
  console.log(req.user); // Log the user object for debugging
  res.render('adminDashboard', { admin_id: req.user ? req.user.admin_id : null });
});





// Dashboard route
app.get('/dashboard', isAuthenticated, (req, res) => {
  res.render('dashboard', { username: req.user.user_id });
});




// Registration route
app.post('/register', async (req, res) => {
  try {
    const { name, username, password, email, dob } = req.body;
    const parsedDob = moment(dob, 'DD/MM/YYYY').toDate();

    // Check if the username already exists
    const existingUser = await User.findOne({ user_id: username });
    if (existingUser) {
      req.flash('error', 'Username already exists');
      return res.redirect('/register');
    }

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



// Define a route handler to render the profile page
app.get('/profile', async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      // User is not logged in, redirect to login page
      return res.redirect('/login');
    }

    // Fetch user details from the database based on user ID
    const user = await User.findById(req.user._id);

    // Render the profile page template and pass user data to it
    res.render('profile', { user });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/report', isAuthenticated, (req, res) => {
  res.render('report');
});

app.post('/submit-lost', upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'document', maxCount: 1 }]), async (req, res) => {
  try {
      const { itemName, date, place, description } = req.body;
      const photo = req.files['photo'][0].buffer; // Get file data from memory
      const document = req.files['document'][0].buffer; // Get file data from memory

      const newItem = new LostItem({
          itemName,
          date,
          place,
          description,
          photo,
          document
      });

      await newItem.save();
      res.status(200).send('Item reported successfully!');
  } catch (error) {
      console.error('Error reporting lost item:', error);
      res.status(500).send('An error occurred while reporting the lost item.');
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
