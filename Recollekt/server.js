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

app.put('/edit-album', async (req, res) => {
  const { id, title, coverImage, images } = req.body;
  console.log('Received album edit request:', req.body);

  // Validate the request body
  if (!title || !coverImage || !images) {
    return res.status(400).json({ error: 'Album ID, title, cover image, and images are required' });
  }

  try {
    // Find the album by ID and update it
    const album = await Album.findByIdAndUpdate(
      id,
      { title, coverImage, images },
      { new: true }
    );

    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }

    res.status(200).json({ message: 'Album updated successfully', album });
  } catch (error) {
    console.error('Error updating album:', error);
    res.status(500).json({ error: 'Failed to update album' });
  }
}
);

app.get('/albums/:id', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1]; // Extract the token from the Authorization header
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' }); // Return 401 if no token is provided
  }

  try {
    // Verify the token
    const decodedToken = jwt.verify(token, 'your_jwt_secret'); // Replace 'your_jwt_secret' with your actual JWT secret
    const userId = decodedToken.id; // Extract the user ID from the token

    // Find the album by ID and ensure it belongs to the authenticated user
    const album = await Album.findOne({ _id: req.params.id, creatorId: userId });
    if (!album) {
      return res.status(404).json({ error: 'Album not found' }); // Return 404 if the album is not found
    }

    // Return the album details
    res.status(200).json({
      id: album._id,
      title: album.title,
      coverImage: album.coverImage,
      images: album.images,
      creatorId: album.creatorId,
    });
  } catch (error) {
    console.error('Error fetching album:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' }); // Return 401 if the token is invalid
    }
    res.status(500).json({ error: 'Failed to fetch album' }); // Return 500 for other errors
  }
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
      id: album._id, // Use the generated ID from MongoDB
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