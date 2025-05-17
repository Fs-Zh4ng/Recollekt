const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Counter = require('./models/Counter'); // Counter model for unique userId
const User = require('./models/User'); // User model
const Album = require('./models/Album'); 

const app = express();
app.use(express.json());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/recollekt', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

mongoose.connection.on('connected', () => {
  console.log('Connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('Error connecting to MongoDB:', err);
});

app.get('/albums', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decodedToken = jwt.verify(token, 'your_jwt_secret'); // Replace with your JWT secret
    const userId = decodedToken.id;

    const albums = await Album.find({ creatorId: userId }); // Fetch albums for the current user
    res.status(200).json({ albums });
  } catch (error) {
    console.error('Error fetching albums:', error);
    res.status(500).json({ error: 'Failed to fetch albums' });
  }
});

app.post('/albums', async (req, res) => {
  const { title, coverImage, images, creatorId } = req.body;
  console.log('Received album creation request:', req.body);

  // Validate the request body
  if (!title || !coverImage || !creatorId) {
    return res.status(400).json({ error: 'Title, cover image, and creator ID are required' });
  }

  try {
    // Create a new album in the database
    const album = new Album({
      title,
      coverImage,
      images,
      creatorId,
    });
    await album.save();
    res.status(201).json({ message: 'Album created successfully', album });
  } catch (error) {
    console.error('Error creating album:', error);
    res.status(500).json({ error: 'Failed to create album' });
  }
});

// 1. User Registration
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  // Validate username and password
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  } else if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/.test(password)) {
    return res.status(400).json({ error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' });
  } else if (!/^[a-zA-Z0-9]+$/.test(username)) {
    return res.status(400).json({ error: 'Username can only contain alphanumeric characters' });
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Get the next userId from the Counter collection
  let userId;
  try {
    const counter = await Counter.findOneAndUpdate(
      { name: 'userId' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true } // Create the counter if it doesn't exist
    );
    userId = counter.seq;
  } catch (error) {
    return res.status(500).json({ error: 'Failed to generate user ID' });
  }

  // Create a new user
  const user = new User({ username, password: hashedPassword, userId });
  await user.save();

  res.status(201).json({ message: 'User registered successfully', userId });
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
  console.log(user._id);
  // Generate a JWT token
  const token = jwt.sign({ id: user._id }, 'your_jwt_secret', { expiresIn: '24h' });

  res.json({ token });
});

// Start the server
app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});