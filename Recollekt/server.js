const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json()); // Middleware to parse JSON requests

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/recollekt', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// MongoDB User Schema and Model
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const User = mongoose.model('User', userSchema);

// API Endpoints
// Define a route for the root path
app.get('/', (req, res) => {
  res.send('Welcome to the Recollekt API!');
});

// 1. User Registration
app.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  console.log('Received sign-up request:', req.body);

  // Check if username already exists
  const existingUser = await User.findOne({ username });
  if (existingUser) {
    return res.status(400).json({ error: 'Username already exists' });
  } else if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/.test(password)) {
    return res.status(400).json({ error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' });
  } else if (!/^[a-zA-Z0-9]+$/.test(username)) {
    return res.status(400).json({ error: 'Username can only contain alphanumeric characters' });
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create a new user
  const user = new User({ username, password: hashedPassword });
  await user.save();

  res.status(201).json({ message: 'User registered successfully' });
});

// 2. User Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  console.log('Received login request:', req.body);

  // Find the user by username
  const user = await User.findOne({ username });
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  // Compare the password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  // Generate a JWT token
  const token = jwt.sign({ id: user._id }, 'your_jwt_secret', { expiresIn: '1h' });

  res.json({ token });
});

// Start the server
app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});