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
const fs = require('fs');
const https = require('https');






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


const claimedItemSchema = new mongoose.Schema({
  user_id: { type: String, required: true }, // User ID
  name: { type: String, required: true }, // Name
  placeLost: { type: String, required: true }, // Place lost
  dateLost: { type: Date, required: true }, // Date lost
  document: { type: Buffer, required: true }, // Document
  photo: { type: Buffer }, // Optional photo
  found_item_id: { type: mongoose.Schema.Types.ObjectId, required: true } // Found item ID
});

const feedbackSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  viewed: { type: String, default: "no" } // Added field for viewed status with default value "no"
});




// Create User model
const User = mongoose.model('users', userSchema);
const Admin = mongoose.model('admins', adminSchema);
const LostItem = mongoose.model('lost_items', lostItemSchema);
const FoundItem = mongoose.model('found_items', foundItemSchema);
const ClaimedItem = mongoose.model('claimed_items', claimedItemSchema);
const Feedback = mongoose.model('feedback', feedbackSchema);




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

function isAdminAuthenticated(req, res, next) {
  if (req.isAuthenticated() && req.user && req.user.admin_id) {
    return next();
  }
  res.redirect('/adminLogin');
}
// Passport local strategy for user authentication
// passport.use('local', new LocalStrategy(
//   function(username, password, done) {
//     User.findOne({ user_id: username })
//       .then(user => {
//         if (!user) {
//           return done(null, false, { message: 'Incorrect username.' });
//         }
//         if (user.password !== password) {
//           return done(null, false, { message: 'Incorrect password.' });
//         }
//         return done(null, user);
//       })
//       .catch(err => done(err));
//   }
// ));

// // Serialize and deserialize user
// passport.serializeUser(function (user, done) {
//   done(null, user.id);
// });

// passport.deserializeUser(async function (id, done) {
//   try {
//     const user = await User.findById(id);
//     done(null, user);
//   } catch (error) {
//     done(error, null);
//   }
// });



// // Passport local strategy for admin authentication
// passport.use('admin', new LocalStrategy(
//   function(username, password, done) {
//     Admin.findOne({ admin_id: username, password: password })
//       .then(admin => {
//         if (!admin) {
//           return done(null, false, { message: 'Incorrect admin credentials.' });
//         }
//         return done(null, admin);
//       })
//       .catch(err => done(err));
//   }
// ));


//new 

// Serialize and deserialize user
passport.serializeUser(function (user, done) {
  if (user instanceof User) {
    done(null, { id: user.id, type: 'user' }); // Serialize user with type
  } else if (user instanceof Admin) {
    done(null, { id: user.id, type: 'admin' }); // Serialize admin with type
  } else {
    done(new Error('Invalid user type during serialization'), null);
  }
});

passport.deserializeUser(async function (serializedUser, done) {
  try {
    if (serializedUser.type === 'user') {
      const user = await User.findById(serializedUser.id);
      done(null, user);
    } else if (serializedUser.type === 'admin') {
      const admin = await Admin.findById(serializedUser.id);
      done(null, admin);
    } else {
      done(new Error('Invalid user type during deserialization'), null);
    }
  } catch (error) {
    done(error, null);
  }
});

// Passport local strategy for user authentication
passport.use('local', new LocalStrategy(
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

// Passport local strategy for admin authentication
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

// passport.use('admin', new LocalStrategy(
//   function(username, password, done) {
//     Admin.findOne({ admin_id: username, password: password })
//       .then(admin => {
//         if (!admin) {
//           return done(null, false, { message: 'Incorrect admin credentials.' });
//         }
//         return done(null, admin);
//       })
//       .catch(err => done(err));
//   }
// ));

// // Serialize and deserialize admin
// passport.serializeUser(function (user, done) {
//   done(null, admin.admin_id); // Assuming user.admin_id is the correct field for the admin's ID
// });


// passport.deserializeUser(async function (id, done) {
//   try {
//     const admin = await Admin.findOne({ admin_id: id }); // Assuming admin_id is the correct field for the admin's ID
//     done(null, admin);
//   } catch (error) {
//     done(error, null);
//   }
// });

// Routes
app.get('/adminLogin', (req, res) => {
  res.render('adminLogin'); // Render admin login form
});
app.get('/adminDashboard', isAdminAuthenticated, (req, res) => {
  res.render('adminDashboard', { admin_id: req.user ? req.user.admin_id : null });
});


app.post('/adminLogin', passport.authenticate('admin', {
  successRedirect: '/adminDashboard', // Redirect to admin dashboard on successful login
  failureRedirect: '/adminLogin', // Redirect back to admin login page on failure
  failureFlash: true // Enable flash messages for displaying error messages
}));


// Other admin routes...






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
      // Send a response with JavaScript code to show alert
      res.send('<script>alert("Item reported successfully!"); window.location.href = "/report";</script>');
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
      const username = req.user.user_id;

      const newFoundItem = new FoundItem({
          itemName,
          date,
          place,
          description,
          photo,
          user_id: username // Include username as user_id in the FoundItem document
      });

      await newFoundItem.save();
      // Send a response with JavaScript code to show alert
      res.send('<script>alert("Item found reported successfully!"); window.location.href = "/report";</script>');
  } catch (error) {
      console.error('Error reporting found item:', error);
      res.status(500).send('An error occurred while reporting the found item.');
  }
});


 // Define the number of items per page


// Route for displaying active lost items
app.get('/lost', isAdminAuthenticated, async (req, res) => {
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

// Route for displaying active found items
app.get('/found', isAdminAuthenticated, async (req, res) => {
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

// Route to display details of a specific lost item
app.get('/lost/:id', async (req, res) => {
  try {
    const itemId = req.params.id;
    const lostItem = await LostItem.findById(itemId);

    if (!lostItem) {
      // Item not found in the database
      return res.status(404).send('Item not found');
    }

    // Render the details page template and pass the item details to it
    res.render('lostItemDetails', { lostItem });
  } catch (error) {
    console.error('Error fetching item details:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/found/:id', async (req, res) => {
  try {
    const itemId = req.params.id;
    const foundItem = await FoundItem.findById(itemId);

    if (!foundItem) {
      // Item not found in the database
      return res.status(404).send('Item not found');
    }

    // Render the details page template and pass the item details to it
    res.render('foundItemDetails', { foundItem });
  } catch (error) {
    console.error('Error fetching item details:', error);
    res.status(500).send('Internal Server Error');
  }
});


app.post('/lost/:id/uploaded', async (req, res) => {
  try {
    const itemId = req.params.id;

    // Update the status of the lost item to 'uploaded'
    const updatedLostItem = await LostItem.findByIdAndUpdate(itemId, { status: 'uploaded' }, { new: true });

    if (!updatedLostItem) {
      // Item not found in the database
      return res.status(404).send('Item not found');
    }

    // Show alert message in the browser
    res.send('<script>alert("Lost item status updated to \'uploaded\' successfully"); window.location.href = "/";</script>');
  } catch (error) {
    console.error('Error updating lost item status:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Handle POST request to mark a lost item as verified
app.post('/lost/:id/verified', async (req, res) => {
  try {
    const itemId = req.params.id;

    // Update the status of the lost item to 'verified'
    const updatedLostItem = await LostItem.findByIdAndUpdate(itemId, { status: 'verified' }, { new: true });

    if (!updatedLostItem) {
      // Item not found in the database
      return res.status(404).send('Item not found');
    }

    // Show alert message in the browser
    res.send('<script>alert("Lost item status updated to \'verified\' successfully"); window.location.href = "/";</script>');
  } catch (error) {
    console.error('Error updating lost item status:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/found/:id/uploaded', async (req, res) => {
  try {
    const itemId = req.params.id;

    // Update the status of the found item to 'uploaded'
    const updatedFoundItem = await FoundItem.findByIdAndUpdate(itemId, { status: 'uploaded' }, { new: true });

    if (!updatedFoundItem) {
      // Item not found in the database
      return res.status(404).send('Item not found');
    }

    res.status(200).send('Found item status updated to "uploaded" successfully');
  } catch (error) {
    console.error('Error updating found item status:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Handle POST request to mark a found item as verified
app.post('/found/:id/verified', async (req, res) => {
  try {
    const itemId = req.params.id;

    // Update the status of the found item to 'verified'
    const updatedFoundItem = await FoundItem.findByIdAndUpdate(itemId, { status: 'verified' }, { new: true });

    if (!updatedFoundItem) {
      // Item not found in the database
      return res.status(404).send('Item not found');
    }

    res.status(200).send('Found item status updated to "verified" successfully');
  } catch (error) {
    console.error('Error updating found item status:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/userLost', async (req, res) => {
  try {
    // Fetch all lost items with status 'uploaded'
    const lostItems = await LostItem.find({ status: 'uploaded' });

    // Pagination logic
    const itemsPerPage = 6;
    const totalPages = Math.ceil(lostItems.length / itemsPerPage);
    const currentPage = parseInt(req.query.page) || 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage - 1, lostItems.length - 1);
    const currentLostItems = lostItems.slice(startIndex, endIndex + 1);

    // Render the template with lost items
    res.render('userLost', { userLostItems: currentLostItems, currentPage, totalPages, itemsPerPage });
  } catch (error) {
    console.error('Error fetching user lost items:', error);
    res.status(500).send('An error occurred while fetching user lost items.');
  }
});

app.get('/userFound', async (req, res) => {
  try {
      // Fetch all found items with status 'uploaded'
      const foundItems = await FoundItem.find({ status: 'uploaded' });

      // Pagination logic
      const itemsPerPage = 6;
      const totalPages = Math.ceil(foundItems.length / itemsPerPage);
      const currentPage = parseInt(req.query.page) || 1;
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = Math.min(startIndex + itemsPerPage - 1, foundItems.length - 1);
      const currentFoundItems = foundItems.slice(startIndex, endIndex + 1);

      // Render the template with found items
      res.render('userFound', { userFoundItems: currentFoundItems, currentPage, totalPages, itemsPerPage });
  } catch (error) {
      console.error('Error fetching user found items:', error);
      res.status(500).send('An error occurred while fetching user found items.');
  }
});



app.get('/userSearchLost', async (req, res) => {
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
          },
          status: 'uploaded' // Include only items with status 'uploaded'
      });

      // Pagination logic
      const itemsPerPage = 6; // Number of items per page
      const totalPages = Math.ceil(searchResults.length / itemsPerPage);
      const currentPage = parseInt(req.query.page) || 1;
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = Math.min(startIndex + itemsPerPage - 1, searchResults.length - 1);
      const currentSearchResults = searchResults.slice(startIndex, endIndex + 1);

      // Render the template with search results for lost items
      res.render('userPeachResults', { userLostItems: currentSearchResults, currentPage, totalPages, itemsPerPage });
  } catch (error) {
      console.error('Error searching lost items:', error);
      res.status(500).json({ error: 'An error occurred while searching lost items.' }); // Send error response
  }
});

app.get('/userSearchFound', async (req, res) => {
  try {
    const searchQuery = req.query.query; // Get the search query from the request

    // Perform a database query to search for found items with at least 50% match and status 'uploaded'
    const searchResults = await FoundItem.find({
      itemName: { $regex: searchQuery, $options: 'i' }, // Case-insensitive match for itemName
      $expr: {
        $gte: [
          { $strLenCP: "$itemName" }, // Length of itemName
          { $multiply: [{ $strLenCP: searchQuery }, 0.5] } // 50% of the length of the search query
        ]
      },
      status: 'uploaded' // Include only items with status 'uploaded'
    });

    // Pagination logic
    const itemsPerPage = 6; // Number of items per page
    const totalPages = Math.ceil(searchResults.length / itemsPerPage);
    const currentPage = parseInt(req.query.page) || 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage - 1, searchResults.length - 1);
    const currentSearchResults = searchResults.slice(startIndex, endIndex + 1);

    // Render the template with search results for found items
    res.render('userSearchResults', { userFoundItems: currentSearchResults, currentPage, totalPages, itemsPerPage });
  } catch (error) {
    console.error('Error searching found items:', error);
    res.status(500).json({ error: 'An error occurred while searching found items.' }); // Send error response
  }
});

app.get('/userLost/:id', async (req, res) => {
  try {
    const itemId = req.params.id;
    const lostItem = await LostItem.findById(itemId);

    if (!lostItem) {
      // Item not found in the database
      return res.status(404).send('Item not found');
    }

    // Render the details page template and pass the item details to it
    res.render('userLostItemDetails', { lostItem });
  } catch (error) {
    console.error('Error fetching item details:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/userFound/:id', async (req, res) => {
  try {
    const itemId = req.params.id;
    const foundItem = await FoundItem.findById(itemId);

    if (!foundItem) {
      // Item not found in the database
      return res.status(404).send('Item not found');
    }

    // Render the details page template and pass the item details to it
    res.render('userFoundItemDetails', { foundItem });
  } catch (error) {
    console.error('Error fetching item details:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/userSearchFound/:id', async (req, res) => {
  try {
    const itemId = req.params.id;
    const foundItem = await FoundItem.findById(itemId);

    if (!foundItem) {
      // Item not found in the database
      return res.status(404).send('Item not found');
    }

    // Render the details page template and pass the item details to it
    res.render('userFoundItemDetails', { foundItem });
  } catch (error) {
    console.error('Error fetching item details:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/aboutus',isAuthenticated,(req, res) => {
  res.render('aboutus');
});
app.get('/contactus',isAuthenticated,(req, res) => {
  res.render('cotactus');
});



app.get('/userSearchLost/:id', async (req, res) => {
  try {
    const itemId = req.params.id;
    const lostItem = await LostItem.findById(itemId);

    if (!lostItem) {
      // Item not found in the database
      return res.status(404).send('Item not found');
    }

    // Render the details page template and pass the item details to it
    res.render('userLostItemDetails', { lostItem });
  } catch (error) {
    console.error('Error fetching item details:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/userFound/:id/claim', async (req, res) => {
  try {
    const foundItemId = req.params.id;
    const foundItem = await FoundItem.findById(foundItemId);
    console.log(foundItemId);

    if (!foundItem) {
      // Item not found in the database
      return res.status(404).send('Item not found');
    }

    // Render the claim form template and pass the found item details to it
    res.render('claimForm', { foundItem });
  } catch (error) {
    console.error('Error fetching item details:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/userFound/:id/claim-submit', upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'document', maxCount: 1 }]), async (req, res) => {
  try {
    const foundItemId = req.params.id;
    const foundItem = await FoundItem.findById(foundItemId);

    if (!foundItem) {
      // Item not found in the database
      return res.status(404).send('Item not found');
    }

    // Extract data from the request body
    const { name, placeLost, dateLost } = req.body;
    const photo = req.files['photo'][0].buffer; // Get file data from memory
    const document = req.files['document'][0].buffer; // Get file data from memory

    // Assuming username is available in req.user.username
    const user_id = req.user.user_id;
    console.log(user_id);

    // Create a new claimed item with the extracted data
    const newClaimedItem = new ClaimedItem({
      user_id,
      name,
      placeLost,
      dateLost,
      document: photo,
      photo: document,
      found_item_id: foundItemId // Include the found item ID
    });

    // Save the new claimed item to the database
    await newClaimedItem.save();

    // Optionally, you can remove the found item from the database if needed
    // await foundItem.remove();

    // Send an alert and redirect the user to the dashboard
    res.send('<script>alert("Claimed item submitted successfully!"); window.location.href = "/dashboard";</script>');
  } catch (error) {
    console.error('Error submitting claimed item:', error);
    res.status(500).send('Internal Server Error');
  }
});



// Route for accessing claimed items
app.get('/claimed', async (req, res) => {
  try {
    // Find all distinct item IDs from the ClaimedItem collection
    const distinctItemIds = await ClaimedItem.distinct('found_item_id');

    // If no distinct item IDs are found, send a 404 response
    if (!distinctItemIds || distinctItemIds.length === 0) {
      return res.status(404).send("No claimed items found.");
    }

    // Calculate total number of pages based on the number of distinct item IDs
    const totalPages = Math.ceil(distinctItemIds.length / itemsPerPage);

    // Parse the current page number from the request query, default to page 1
    const currentPage = parseInt(req.query.page) || 1;

    // Calculate the start and end indices of the item IDs to be fetched for the current page
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage - 1, distinctItemIds.length - 1);

    // Extract the item IDs to be fetched for the current page
    const currentPageItemIds = distinctItemIds.slice(startIndex, endIndex + 1);

    // Fetch the details of each distinct item from the FoundItem collection
    const itemsDataPromises = currentPageItemIds.map(async (itemId) => {
      const foundItem = await FoundItem.findById(itemId);
      const claimedItem = await ClaimedItem.find({ found_item_id: itemId });
      return {
        item: foundItem.toObject(),
        claims: claimedItem.map(item => item.toObject())
      };
    });

    // Resolve all promises and render the claimed.ejs file with the data and pagination details
    const itemsData = await Promise.all(itemsDataPromises);
    res.render('claimed', { items: itemsData, currentPage, totalPages, itemsPerPage });
  } catch (err) {
    console.error("Error fetching claimed items:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.get('/claimed/:id', async (req, res) => {
  try {
      const foundItemId = req.params.id;

      // Fetch the claims associated with the specified found item ID
      const claims = await ClaimedItem.find({ found_item_id: foundItemId });

      // Render the claimedDetails.ejs view and pass the claims data to it
      res.render('claimedDetails', { claims });
  } catch (error) {
      console.error('Error fetching claims:', error);
      res.status(500).send('An error occurred while fetching claims.');
  }
});
// Define a route for downloading documents
// Define a route for downloading claimed item documents
// Handle document download


app.get('/download/document/:id', async (req, res) => {
  try {
    // Fetch the claimed item by its ID
    const claimedItem = await ClaimedItem.findById(req.params.id);

    if (!claimedItem) {
      // If the claimed item is not found, send a 404 response
      return res.status(404).send('Claimed item not found');
    }

    // Extract the URL from the claimed item data
    const documentUrl = claimedItem.documentUrl;

    // Make a GET request to download the document from the URL
    https.get(documentUrl, (response) => {
      const data = [];

      response.on('data', (chunk) => {
        data.push(chunk);
      }).on('end', () => {
        // Concatenate all received chunks into a single buffer
        const documentBuffer = Buffer.concat(data);

        // Set headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="document.pdf"`);

        // Send the document buffer as the response
        res.send(documentBuffer);
      });
    }).on('error', (err) => {
      console.log('Download error:', err);
      res.status(500).send('Download error: ' + err.message); // Log the error message
    });
  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/feedback', isAuthenticated, (req, res) => {
  res.render('feedback');
});

app.get('/feedback', isAuthenticated, (req, res) => {
  res.render('feedback');
});

app.post('/submit-feedback', isAuthenticated, async (req, res) => {
  try {
    const { name, email, message } = req.body;

    const newFeedback = new Feedback({
      name,
      email,
      message
    });

    // Save the feedback to the database
    await newFeedback.save();

    // Send a success response with JavaScript alert and redirection
    res.send('<script>alert("Feedback submitted successfully!"); window.location.href = "/dashboard";</script>');
  } catch (error) {
    // Handle errors
    console.error('Error submitting feedback:', error);
    res.status(500).send('An error occurred while submitting feedback.');
  }
});


// Route to access feedbacks with pagination
// Route to access feedbacks with pagination
app.get('/feedbacks', isAdminAuthenticated, async (req, res) => {
  try {
    // Fetch feedback items with attribute value 'viewed' as 'no'
    const feedbackItems = await Feedback.find({ viewed: 'no' });

    // Calculate the total number of pages based on the total number of feedback items
    const totalPages = Math.ceil(feedbackItems.length);

    // Parse the current page number from the request query, default to page 1
    const currentPage = parseInt(req.query.page) || 1;

    // Render the feedbacks view with filtered feedback data, pagination information, and current page
    res.render('feedbacks', { feedbackItems, totalPages, currentPage });
  } catch (error) {
    console.error('Error fetching feedbacks:', error);
    res.status(500).send('An error occurred while fetching feedbacks.');
  }
});

app.post('/feedbacks/:id/update-viewed', async (req, res) => {
  try {
      const feedbackId = req.params.id;
      const feedback = await Feedback.findByIdAndUpdate(feedbackId, { viewed: true }, { new: true });

      if (!feedback) {
          return res.status(404).send('Feedback not found');
      }

      res.status(200).send('Feedback marked as viewed successfully');
  } catch (error) {
      console.error('Error marking feedback as viewed:', error);
      res.status(500).send('Internal Server Error');
  }
});

app.get('/aboutus', isAuthenticated, (req, res) => {
  res.render('aboutus');
});

app.get('/searchStatus', async (req, res) => {
  try {
      const searchQuery = req.query.query; // Get the search query from the request

      // Perform a database query to search for status items with at least 50% match
      const searchResults = await StatusItem.find({
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

      // Render the template with search results for status items
      res.render('searchStatus', { statusItems: currentSearchResults, currentPage, totalPages, itemsPerPage });
  } catch (error) {
      console.error('Error searching status items:', error);
      res.status(500).json({ error: 'An error occurred while searching status items.' }); // Send error response
  }
});
app.get('/status', isAuthenticated, async (req, res) => {
  try {
    // Fetch items reported by the authenticated user from the database
    const userLostItems = await LostItem.find({ user_id: req.user.user_id });

    // Pagination logic
    const itemsPerPage = 6;
    const totalPages = Math.ceil(userLostItems.length / itemsPerPage);
    const currentPage = parseInt(req.query.page) || 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage - 1, userLostItems.length - 1);
    const currentLostItems = userLostItems.slice(startIndex, endIndex + 1);

    // Render the status template with the user's reported items
    res.render('status', { userLostItems: currentLostItems, currentPage, totalPages, itemsPerPage });
  } catch (error) {
    console.error('Error fetching user reported items:', error);
    res.status(500).send('An error occurred while fetching user reported items.');
  }
});



// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

