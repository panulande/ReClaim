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
const Grid = require('gridfs-stream');
const { GridFSBucket } = require('mongodb');
const itemsPerPage = 6;




// Create Express app
const app = express();
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'ejs');
app.use(flash());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/ReClaim', { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;

let gfs;
mongoose.connection.once('open', () => {
    gfs = Grid(mongoose.connection.db, mongoose.mongo);
    gfs.collection('lost_items'); // Specify the GridFS collection
});


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
  reportedItems: { type: String, default: 'active' }, // Default value 'active' for reportedItems
  user_id: { type: String, ref: 'User' } // Reference to the 'User' model using username
});


lostItemSchema.pre('save', async function(next) {
  try {
    // Check if user ID is available in session details
    if (this.session && this.session.user_id) {
      this.user_id = this.session.user_id; // Assign user_id from session details
    }
    next();
  } catch (error) {
    next(error); // Pass error to the next middleware
  }
});


const foundItemSchema = new mongoose.Schema({
  itemName: String,
  date: Date,
  place: String,
  description: String,
  photo: Buffer, // Store file data as Buffer
  status: { type: String, default: 'reported' }, // Default value 'reported' for status
  reportedItems: { type: String, default: 'active' }, // Default value 'active' for reportedItems
  user_id: { type: String, ref: 'User' } // Reference to the 'User' model using username
});



// Create User model
const User = mongoose.model('users', userSchema);
const Admin = mongoose.model('admins', adminSchema);
const LostItem = mongoose.model('lost_items', lostItemSchema);
const FoundItem = mongoose.model('found_items', foundItemSchema);


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

      // Assuming username is available in req.user.username
      const username = req.user.user_id;

      const newItem = new LostItem({
          itemName,
          date,
          place,
          description,
          photo,
          document,
          user_id: username // Include username as user_id in the LostItem document
      });

      await newItem.save();
      res.status(200).send('Item reported successfully!');
  } catch (error) {
      console.error('Error reporting lost item:', error);
      res.status(500).send('An error occurred while reporting the lost item.');
  }
});


app.post('/submit-found', upload.fields([{ name: 'photo', maxCount: 1 }]), async (req, res) => {
  try {
      const { itemName, date, place, description } = req.body;
      const photo = req.files['photo'][0].buffer; // Get file data from memory

      // Assuming username is available in req.user.username
      const username = req.user.username;

      const newFoundItem = new FoundItem({
          itemName,
          date,
          place,
          description,
          photo,
          user_id: username // Include username as user_id in the FoundItem document
      });

      await newFoundItem.save();
      res.status(200).send('Item found reported successfully!');
  } catch (error) {
      console.error('Error reporting found item:', error);
      res.status(500).send('An error occurred while reporting the found item.');
  }
});

 // Define the number of items per page


app.get('/lost', isAuthenticated, async (req, res) => {
  try {
      const activeLostItems = await LostItem.find({ reportedItems: 'active' });
      const totalPages = Math.ceil(activeLostItems.length / itemsPerPage);
      const currentPage = parseInt(req.query.page) || 1;
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = Math.min(startIndex + itemsPerPage - 1, activeLostItems.length - 1);
      const currentLostItems = activeLostItems.slice(startIndex, endIndex + 1);
      res.render('index', { lostItems: currentLostItems, currentPage, totalPages, itemsPerPage });
  } catch (error) {
      console.error('Error fetching active lost items:', error);
      res.status(500).send('An error occurred while fetching active lost items.');
  }
});

app.get('/found', isAuthenticated, async (req, res) => {
  try {
      const activeFoundItems = await FoundItem.find({ reportedItems: 'active' });
      const totalPages = Math.ceil(activeFoundItems.length / itemsPerPage);
      const currentPage = parseInt(req.query.page) || 1;
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = Math.min(startIndex + itemsPerPage - 1, activeFoundItems.length - 1);
      const currentFoundItems = activeFoundItems.slice(startIndex, endIndex + 1);
      res.render('found', { foundItems: currentFoundItems, currentPage, totalPages, itemsPerPage });
  } catch (error) {
      console.error('Error fetching active found items:', error);
      res.status(500).send('An error occurred while fetching active found items.');
  }
});

// Backend route to handle search requests
// Backend route to handle search requests
// Route for searching found items
app.get('/searchFound', async (req, res) => {
  try {
      const searchQuery = req.query.query; // Get the search query from the request

      // Perform a database query to search for found items with at least 50% match
      const searchResults = await FoundItem.find({
          itemName: { $regex: searchQuery, $options: 'i' }, // Case-insensitive match for itemName
          $expr: {
              $gte: [
                  { $strLenCP: "$itemName" }, // Length of itemName
                  { $multiply: [{ $strLenCP: searchQuery }, 0.5] } // 50% of the length of the search query
              ]
          }
      });

      // Pagination logic
      const itemsPerPage = 6; // Number of items per page
      const totalPages = Math.ceil(searchResults.length / itemsPerPage);
      const currentPage = parseInt(req.query.page) || 1;
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = Math.min(startIndex + itemsPerPage - 1, searchResults.length - 1);
      const currentSearchResults = searchResults.slice(startIndex, endIndex + 1);

      // Render the template with search results for found items
      res.render('searchResults', { foundItems: currentSearchResults, currentPage, totalPages, itemsPerPage });
  } catch (error) {
      console.error('Error searching found items:', error);
      res.status(500).json({ error: 'An error occurred while searching found items.' }); // Send error response
  }
});

// Route for searching lost items
app.get('/searchLost', async (req, res) => {
  try {
      const searchQuery = req.query.query; // Get the search query from the request

      // Perform a database query to search for lost items with at least 50% match
      const searchResults = await LostItem.find({
          itemName: { $regex: searchQuery, $options: 'i' }, // Case-insensitive match for itemName
          $expr: {
              $gte: [
                  { $strLenCP: "$itemName" }, // Length of itemName
                  { $multiply: [{ $strLenCP: searchQuery }, 0.5] } // 50% of the length of the search query
              ]
          }
      });

      // Pagination logic
      const itemsPerPage = 6; // Number of items per page
      const totalPages = Math.ceil(searchResults.length / itemsPerPage);
      const currentPage = parseInt(req.query.page) || 1;
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = Math.min(startIndex + itemsPerPage - 1, searchResults.length - 1);
      const currentSearchResults = searchResults.slice(startIndex, endIndex + 1);

      // Render the template with search results for lost items
      res.render('peachResults', { lostItems: currentSearchResults, currentPage, totalPages, itemsPerPage });
  } catch (error) {
      console.error('Error searching lost items:', error);
      res.status(500).json({ error: 'An error occurred while searching lost items.' }); // Send error response
  }
});





// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

//End of code