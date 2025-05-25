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
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const os = require('os');
const bonjour = require('bonjour')();
const multer = require('multer');
const storage = multer.memoryStorage();
require('dotenv').config();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fieldSize: 25 * 1024 * 1024, // 25 MB per field
  },
});
const { Buffer } = require('buffer');
const AWS = require('aws-sdk');

// Set FFmpeg and FFprobe paths
ffmpeg.setFfmpegPath('/opt/homebrew/bin/ffmpeg'); // Update this path as needed
ffmpeg.setFfprobePath('/opt/homebrew/bin/ffprobe'); // Update this path as needed

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// Configure S3 client
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.json({limit: '100mb'}));
app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));

bonjour.publish({
  name: 'Recollekt Backend',
  type: 'http',
  port: 3000,
  host: 'recollekt.local', // Use the dynamic IP detection function
});

const PORT = 3000;


console.log('Bonjour service published for Recollekt Backend');



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

const uploadToS3 = async (base64Image, fileName) => {
  const buffer = Buffer.from(base64Image, 'base64');
  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: fileName,
    Body: buffer,
    ContentType: 'image/jpeg',
    ACL: 'public-read',
  };

  const command = new PutObjectCommand(params);
  const uploadResult = await s3.send(command);
  return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
};

app.post('/albums', upload.none(), async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
 // Debugging log
  console.log('Received request body:', req.body); // Debugging log

  try {
    const decodedToken = jwt.verify(token, 'your_jwt_secret');
    console.log('Decoded token:', decodedToken); // Debugging log
    const userId = decodedToken.id;

    const { title, coverImage } = req.body;
    const images = req.body.images; 
    const timestamps = req.body.timestamps;// Use the correct field name for timestamps
    console.log('Received images:', req.body.images); // Debugging log
    console.log('Received cover image:', req.body.coverImage); // Debugging log
    console.log('Received title:', req.body.title); // Debugging log
    console.log('Received timestamps:', req.body.timestamps); // Debugging log

    // Helper function to upload Base64 image to S3
    const uploadToS3 = async (base64Image, fileName) => {
      const buffer = Buffer.from(base64Image, 'base64');
      const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: fileName,
        Body: buffer,
        ContentType: 'image/jpeg',
      };

      try {
        const command = new PutObjectCommand(params);
        const response = await s3.send(command);
        console.log('Upload successful:', response);
        return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
      } catch (error) {
        console.error('Error uploading to S3:', error);
        throw error;
      }
    };

    // Upload cover image
    const coverImageUrl = await uploadToS3(coverImage, `albums/${userId}/cover.jpg`);

    // Upload album images
    const imageUrls = [];
    const imageArray = Array.isArray(images) ? images : [images]; // Handle single or multiple images
    const timestampArray = Array.isArray(timestamps) ? timestamps : [timestamps]; // Handle single or multiple timestamps

    for (const [index, image] of imageArray.entries()) {
      const imageUrl = await uploadToS3(image, `albums/${userId}/image_${index}.jpg`);
      const time = new Date(timestampArray[index]);
      imageUrls.push({
        url: imageUrl,
        timestamp: timestampArray[index] || new Date(), // Use provided timestamp or fallback to current date
      });
    }



    // Save album to MongoDB
    const album = new Album({
      title,
      coverImage: coverImageUrl,
      images: imageUrls,
      creatorId: userId,
    });

    await album.save();

    res.status(201).json({ message: 'Album created successfully', album });
  } catch (error) {
    console.error('Error creating album:', error);
    res.status(500).json({ error: 'Failed to create album' });
  }
});

app.post('/generate-video', async (req, res) => {
  try {
    const { albums } = req.body;

    if (!albums || albums.length === 0) {
      return res.status(400).json({ error: 'No albums provided' });
    }

    // Flatten all image URLs from the albums
    const imageUrls = albums.flatMap((album) => album.images);
    console.log('Image URLs:', imageUrls); // Debugging log

    if (imageUrls.length === 0) {
      return res.status(400).json({ error: 'No images found in albums' });
    }

    // Create a temporary directory for downloaded images
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    // Download images to the temp directory
    const downloadedImages = [];
    for (let i = 0; i < albums.length; i++) {
      const album = albums[i];
    
      // Add the cover image
      if (album.coverImage) {
        const coverImagePath = path.join(tempDir, `image_${downloadedImages.length}.jpg`);
        await downloadImage(album.coverImage, coverImagePath);
        downloadedImages.push(coverImagePath);
      }
    
      // Add album images
      for (let j = 0; j < album.images.length; j++) {
        const imageUrl = album.images[j];
        const imagePath = path.join(tempDir, `image_${downloadedImages.length}.jpg`);
        await downloadImage(imageUrl, imagePath);
        downloadedImages.push(imagePath);
      }
    }

    // Generate video from images
    const outputVideoPath = path.join(__dirname, 'output', `video_${Date.now()}.mp4`);
    if (!fs.existsSync(path.dirname(outputVideoPath))) {
      fs.mkdirSync(path.dirname(outputVideoPath));
    }

    await createVideoFromImages(downloadedImages, outputVideoPath);

    // Clean up temporary images
    downloadedImages.forEach((filePath) => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      } else {
        console.warn(`File not found during cleanup: ${filePath}`);
      }
    });

    // Respond with the video URL
    const videoUrl = `http://recollekt.local:${PORT}/videos/${path.basename(outputVideoPath)}`;
    res.json({ videoUrl });
  } catch (error) {
    console.error('Error generating video:', error);
    res.status(500).json({ error: 'Failed to generate video' });
  }
});


// Helper function to download an image
const downloadImage = (url, dest) => {
  return new Promise((resolve, reject) => {
    if (url.startsWith('file://')) {
      // Handle local file paths
      const localPath = url.replace('file://', ''); // Remove the "file://" prefix
      fs.copyFile(localPath, dest, (err) => {
        if (err) return reject(err);
        resolve();
      });
    } else if (url.startsWith('http://') || url.startsWith('https://')) {
      // Handle remote URLs
      const https = require('https');
      const file = fs.createWriteStream(dest);
      https
        .get(url, (response) => {
          response.pipe(file);
          file.on('finish', () => {
            file.close(resolve);
          });
        })
        .on('error', (err) => {
          fs.unlink(dest, () => reject(err));
        });
    } else {
      reject(new Error(`Unsupported URL protocol: ${url}`));
    }
  });
};
const createVideoFromImages = (images, outputPath) => {
  return new Promise((resolve, reject) => {
    const command = ffmpeg();

    // Use a frame pattern if images are named sequentially
    command.input(path.join(path.dirname(images[0]), 'image_%d.jpg'))
      .inputOptions('-framerate 1'); // Display each image for 1 second

    command
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .outputOptions([
        '-c:v libx264', // Use H.264 codec
        '-r 30',        // Set frame rate to 30 FPS
        '-pix_fmt yuv420p', // Set pixel format
      ])
      .save(outputPath);
  });
};
// Serve generated videos
app.use('/videos', express.static(path.join(__dirname, 'output')));

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




app.post('/albums/:id/share', async (req, res) => {
  const { id } = req.params;
  const { sharedWith } = req.body;
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decodedToken = jwt.verify(token, 'your_jwt_secret'); // Replace with your JWT secret
    const userId = decodedToken.id;

    // Validate the album ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid album ID' });
    }

    // Find the album to share
    const album = await Album.findById(id);
    if (!album) {
      console.error('Album not found:', id);
      return res.status(404).json({ error: 'Album not found' });
    }
    console.log('Album found:', album);

    // Find the user to share the album with
    const sharedUser = await User.findOne({ $or: [{ email: sharedWith }, { username: sharedWith }] });
    if (!sharedUser) {
      console.error('User to share with not found:', sharedWith);
      return res.status(404).json({ error: 'User to share with not found' });
    }
    console.log('User to share with found:', sharedUser);

    // Add the album to the shared user's sharedAlbums array
    if (!sharedUser.sharedAlbums.includes(id)) {
      sharedUser.sharedAlbums.push(id);
      await sharedUser.save();
      console.log('Album added to sharedAlbums:', sharedUser.sharedAlbums);
    } else {
      console.log('Album already shared with this user');
    }

    res.status(200).json({ message: `Album shared successfully with ${sharedWith}` });
  } catch (error) {
    console.error('Error sharing album:', error);
    res.status(500).json({ error: 'Failed to share album' });
  }
});
app.get('/albums/shared', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decodedToken = jwt.verify(token, 'your_jwt_secret'); // Replace with your JWT secret
    const userId = decodedToken.id;

    // Find the user and populate the sharedAlbums field
    const user = await User.findById(userId).populate('sharedAlbums');
    if (!user) {
      console.error('User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('Shared albums:', user.sharedAlbums); // Debugging log
    res.status(200).json({ sharedAlbums: user.sharedAlbums });
  } catch (error) {
    console.error('Error fetching shared albums:', error);
    res.status(500).json({ error: 'Failed to fetch shared albums' });
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

 // Use multer's memory storage

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
const HOSTNAME = 'recollekt.local'; // Replace with your desired hostname
app.listen(PORT, HOSTNAME, () => {
  console.log(`Server is running on http://${HOSTNAME}:${PORT}`);
});