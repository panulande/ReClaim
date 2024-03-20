// app.js

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('./controllers/authController.js');
const authMiddleware = require('./middleware/authMiddleware.js');
const authRoutes = require('./routes/auth.js');

const app = express();

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/ReClaim', { useNewUrlParser: true, useUnifiedTopology: true });

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

// Routes
app.use('/auth', authRoutes); // Auth routes

// Protecting routes with authentication
app.get('/', authMiddleware.isAuthenticated, (req, res) => {
  res.send('Home Page');
});

// ...

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
