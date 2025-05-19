const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Counter = require('./models/Counter'); // Counter model for unique userId
const User = require('./models/User'); // User model
const Album = require('./models/Album');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const ExifParser = require('exif-parser');


const app = express();
app.use(express.json());
app.use(bodyParser.json());

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

const extractExifTimestamp = (filePath) => {
  try {
    const buffer = fs.readFileSync(filePath); // Read the image file
    const parser = ExifParser.create(buffer);
    const result = parser.parse();

    // Return the EXIF DateTimeOriginal or null if not available
    return result.tags.DateTimeOriginal
      ? new Date(result.tags.DateTimeOriginal * 1000) // Convert EXIF timestamp to JavaScript Date
      : null;
  } catch (error) {
    console.error(`Error extracting EXIF metadata for file ${filePath}:`, error);
    return null; // Return null if EXIF metadata cannot be extracted
  }
};

app.get('/friends/pending', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decodedToken = jwt.verify(token, 'your_jwt_secret'); // Replace with your JWT secret
    const userId = decodedToken.id;

    const user = await User.findById(userId).populate('pendingRequests', 'username'); // Populate usernames
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Extract usernames from the populated pendingRequests
    const pendingRequests = user.pendingRequests.map((requester) => requester.username);

    res.status(200).json({ pendingRequests });
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    res.status(500).json({ error: 'Failed to fetch pending requests' });
  }
});

app.post('/friends/request', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { username: targetUsername } = req.body;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!targetUsername) {
    return res.status(400).json({ error: 'Target username is required' });
  }

  try {
    const decodedToken = jwt.verify(token, 'your_jwt_secret'); // Replace with your JWT secret
    const userId = decodedToken.id;

    const targetUser = await User.findOne({ username: targetUsername });
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    // Add the friend request to the target user's pendingRequests
    if (!targetUser.pendingRequests.includes(userId)) {
      targetUser.pendingRequests.push(userId);
      await targetUser.save();
    }

    res.status(200).json({ message: `Friend request sent to ${targetUsername}` });
  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

// Approve Friend Request
app.post('/friends/approve', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { username: requesterUsername } = req.body;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!requesterUsername) {
    return res.status(400).json({ error: 'Requester username is required' });
  }

  try {
    const decodedToken = jwt.verify(token, 'your_jwt_secret'); // Replace with your JWT secret
    const userId = decodedToken.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const requester = await User.findOne({ username: requesterUsername });
    if (!requester) {
      return res.status(404).json({ error: 'Requester not found' });
    }

    // Check if the requester is in the user's pendingRequests
    if (!user.pendingRequests.includes(requester._id.toString())) {
      return res.status(400).json({ error: 'No pending request from this user' });
    }

    // Approve the friend request
    user.friends.push(requester.username);
    requester.friends.push(user.username);

    // Remove the request from pendingRequests
    user.pendingRequests = user.pendingRequests.filter(
      (requestId) => requestId !== requester._id.toString()
    );

    await user.save();
    await requester.save();

    res.status(200).json({ message: `Friend request from ${requesterUsername} approved` });
  } catch (error) {
    console.error('Error approving friend request:', error);
    res.status(500).json({ error: 'Failed to approve friend request' });
  }
});



app.put('/edit-album', async (req, res) => {
  const { id, title, coverImage, images } = req.body;

  const updatedImages = images.map((image) => ({
    url: image.url || image, // Handle cases where only the URL is provided
    timestamp: image.timestamp || new Date(), // Add a timestamp if not provided
  }));

  try {
    const album = await Album.findByIdAndUpdate(
      id,
      { title, coverImage, images: updatedImages },
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
});

app.delete('/albums/:id', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1]; // Extract the token from the Authorization header
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' }); // Return 401 if no token is provided
  }

  try {
    // Verify the token
    const decodedToken = jwt.verify(token, 'your_jwt_secret'); // Replace 'your_jwt_secret' with your actual JWT secret
    const userId = decodedToken.id; // Extract the user ID from the token

    // Find the album by ID and ensure it belongs to the authenticated user
    const album = await Album.findOneAndDelete({ _id: req.params.id, creatorId: userId });
    if (!album) {
      return res.status(404).json({ error: 'Album not found' }); // Return 404 if the album is not found
    }

    res.status(200).json({ message: 'Album deleted successfully' });
  } catch (error) {
    console.error('Error deleting album:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' }); // Return 401 if the token is invalid
    }
    res.status(500).json({ error: 'Failed to delete album' }); // Return 500 for other errors
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
    // Add a timestamp to each image
    const imagesWithTimestamps = (images || []).map((image) => {
      const filePath = (typeof image === 'string' ? image : image.url).replace('file://', ''); // Handle string or object
      const exifTimestamp = extractExifTimestamp(filePath); // Extract EXIF metadata
      return {
        url: typeof image === 'string' ? image : image.url, // Use the string directly if it's not an object
        timestamp: exifTimestamp || new Date(), // Use EXIF timestamp or fallback to current date
      };
    });

    // Create a new album in the database
    const album = new Album({
      title,
      coverImage,
      images: imagesWithTimestamps,
      creatorId,
    });

    await album.save(); // Save the album to the database

    res.status(201).json({ message: 'Album created successfully', album });
  } catch (error) {
    console.error('Error creating album:', error);
    res.status(500).json({ error: 'Failed to create album' });
  }
});

// 1. User Registration
app.post('/signup', async (req, res) => {
  const { username, password, profileImage, friends } = req.body;

  // Validate the request body
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    // Assign default values if not provided
    const defaultProfileImage = '/Users/Ferdinand/NoName/Recollekt/assets/images/DefProfile.webp'; // Replace with your default image URL
    const userProfileImage = profileImage || defaultProfileImage;
    const userFriends = friends || []; // Use an empty array if no friends are provided

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user in the database
    const user = new User({
      username,
      password: hashedPassword,
      profileImage: userProfileImage,
      friends: userFriends,
    });

    await user.save(); // Save the user to the database

    res.status(201).json({ message: 'User registered successfully', user });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
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

  res.status(200).json({
    token,
    username: user.username,
    friends: user.friends || [], // Default to an empty array if no friends
    profileImage: user.profileImage || '', // Default to an empty string if no profile image
  });
});

// Start the server
app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});