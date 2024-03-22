const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

const app = express();

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/ReClaim', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', function() {
  console.log('Connected to MongoDB');
});

// Define User schema and model
const userSchema = new mongoose.Schema({
  user_id: String,
  password: String,
  name: String,
  email: String,
  dob: Date
});

const User = mongoose.model('users', userSchema);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false
}));

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/login.html');
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ user_id: username, password: password }).exec();
    console.log("User:", user); // Add this line
    if (user) {
      req.session.user = user;
      res.redirect('/dashboard');
    } else {
      console.log("User not found"); // Add this line
      res.redirect('/');
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});


app.get('/dashboard', (req, res) => {
  if (req.session.user) {
    res.sendFile(__dirname + '/dashboard.html');
  } else {
    res.redirect('/');
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
