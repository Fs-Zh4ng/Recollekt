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
const { fileTypeFromBuffer } = require('file-type');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fieldSize: 25 * 1024 * 1024, // 25 MB per field
  },
});
const { Buffer } = require('buffer');
const AWS = require('aws-sdk');
const {getSignedUrl} = require('@aws-sdk/s3-request-presigner');
const axios = require('axios');
const sharp = require('sharp');
const up2 = multer({ dest:'uploads/' }); // Temporary storage for uploaded files

// Set FFmpeg and FFprobe paths
ffmpeg.setFfmpegPath('/opt/homebrew/bin/ffmpeg'); // Update this path as needed
ffmpeg.setFfprobePath('/opt/homebrew/bin/ffprobe'); // Update this path as needed

const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { get } = require('http');

// Configure S3 client
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const bucketName = process.env.AWS_S3_BUCKET_NAME;

const extractKeyFromUrl = (url) => {
  const urlObj = new URL(url);
  return urlObj.pathname.substring(1); // Remove the leading '/'
};





const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.json({limit: '100mb'}));
app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));

app.use('/videos', express.static(path.join(__dirname, 'public/videos')));

const editVideoRouter = require('/Users/Ferdinand/NoName/Recollekt/editVideo');
app.use('/api', editVideoRouter);

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

async function getSignedUrlForImage(bucketName, key) {
  const command = new GetObjectCommand({ Bucket: bucketName, Key: key });
  return await getSignedUrl(s3, command, { expiresIn: 3600 }); // URL valid for 1 hour
}


async function fetchAndSaveBase64Image(bucketName, key, filePath) {
  try {
    const signedUrl = await getSignedUrlForImage(bucketName, key);
    const response = await axios.get(signedUrl, { responseType: 'arraybuffer' });
    const buffer = await sharp(response.data).rotate().toBuffer(); // Normalize orientation
    fs.writeFileSync(filePath, buffer);
    console.log(`Image saved to ${filePath}`);
  } catch (error) {
    console.error(`Failed to fetch or save image from S3:`, error);
    throw error;
  }
}

const getBase64FromS3 = async (bucketName, key) => {
  const s3 = new S3Client({
    region: process.env.AWS_REGION, // Set your AWS region
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  console.log('Fetching image from S3:', bucketName, key); // Debugging log

  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const response = await s3.send(command);

    // Read the image data from the response stream
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Convert the buffer to Base64
    const base64 = buffer.toString('base64');
    const contentType = response.ContentType; // Get the content type (e.g., image/jpeg)

    return `data:${contentType};base64,${base64}`; // Return the Base64 string with the data URI prefix
  } catch (error) {
    console.error('Error fetching the image from S3:', error.message);
    throw error;
  }
};

app.post('/trim-video', up2.none(), (req, res) => {
  const { video, start, end } = req.body;
  console.log('Received startTime:', start, 'endTime:', end); // Debugging log
  console.log(req.body);
  
  const outputFileName = `trimmed-${Date.now()}.mp4`;
  const outputPath = path.join(__dirname, 'trimmed', outputFileName);

  ffmpeg(video) // Assuming 'video' is a valid file path or URL
    .setStartTime(start)
    .setDuration(end - start)
    .output(outputPath)
    .on('end', () => {
      res.json({ trimmedVideoUrl: `/trimmed/${outputFileName}` });
    })
    .on('error', (err) => {
      console.error('FFmpeg error:', err);
      res.status(500).json({ error: 'Failed to trim video' });
    })
    .run();
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

app.get('/user/profile', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decodedToken = jwt.verify(token, 'your_jwt_secret'); // Replace with your JWT secret
    const userId = decodedToken.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({user});
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

app.put('/user/profile-picture', upload.none(), async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decodedToken = jwt.verify(token, 'your_jwt_secret'); // Replace with your JWT secret
    const userId = decodedToken.id;

    const { profileImage } = req.body; // Expecting base64 image data

    if (!profileImage) {
      return res.status(400).json({ error: 'Profile image is required' });
    }

    // Helper function to upload Base64 image to S3
    const uploadToS3 = async (base64Image, fileName) => {
      const uniqueFileName = `${Date.now()}-${fileName}`;
      const buffer = Buffer.from(base64Image, 'base64');
      const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: uniqueFileName,
        Body: buffer,
        ContentType: 'image/jpeg',
      };

      try {
        const command = new PutObjectCommand(params);
        const response = await s3.send(command);
        console.log('Upload successful:', response);
        return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${uniqueFileName}`;
      } catch (error) {
        console.error('Error uploading to S3:', error);
        throw error;
      }
    };

    // Upload profile image
    const profileImageUrl = await uploadToS3(profileImage, `profile_pictures/${userId}.jpg`);

    // Update user profile picture URL in the database
    await User.findByIdAndUpdate(userId, { profileImage: profileImageUrl }, { new: true });

    res.status(200).json({ message: 'Profile picture updated successfully', profileImageUrl });
  } catch (error) {
    console.error('Error updating profile picture:', error);
    res.status(500).json({ error: 'Failed to update profile picture' });
  }
});

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
      const uniqueFileName = `${Date.now()}-${fileName}`;
      const buffer = Buffer.from(base64Image, 'base64');
      const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: uniqueFileName,
        Body: buffer,
        ContentType: 'image/jpeg',
      };

      try {
        const command = new PutObjectCommand(params);
        const response = await s3.send(command);
        console.log('Upload successful:', response);
        return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${uniqueFileName}`;
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

app.post('/generate-video', upload.none(), async (req, res) => {
  try {
    const albums = JSON.parse(req.body.albums);
    console.log('Received albums:', albums.length); // Debugging log 

    if (!albums || albums.length === 0) {
      return res.status(400).json({ error: 'No albums provided' });
    }
    if (!albums || !Array.isArray(albums)) {
      return res.status(400).json({ error: 'Invalid albums data' });
    }

    const images = [];

    // Flatten all image URLs from the albums
    for (const album of albums) {
      if (!album.images || !Array.isArray(album.images)) {
        console.error('Invalid album images:', album);
        return res.status(400).json({ error: 'Invalid album images' });
      }

      for (const image of album.images) {
        if (image.url) {
          images.push(image.url);
          console.log('Image URL:', image.url); // Debugging log
        }
      }
    }

    console.log('Images to process:', images); // Debugging log

    // Create a temporary directory for downloaded images
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    // Download images to the temp directory
    const downloadedImages = [];
    const normalizedImages = [];
    for (let i = 0; i < albums.length; i++) {
      const album = albums[i];
    
      // Add the cover image
      if (album.coverImage) {
        const base64Data = album.coverImage.replace('data:image/jpeg;base64,dataimage/jpegbase64', ''); 
        console.log('Base64 data (first 100 chars):', base64Data.substring(0, 100));
        const tempcoverImagePath = path.join(tempDir, `image_${downloadedImages.length}.jpg`);
        const buffer = Buffer.from(base64Data, 'base64');
        console.log('Cover image buffer size:', buffer); // Debugging log // Debugging log

        try {
          const image = sharp(buffer);
          console.log('image', image);
          const metadata = await image.metadata(); // validate format
          console.log('Detected format:', metadata.format);
      
          const normalized = await image.rotate().toBuffer();
          const outputPath = path.join(tempDir, `image_${downloadedImages.length}.jpg`);
          fs.writeFileSync(outputPath, normalized);
          downloadedImages.push(outputPath);
        } catch (err) {
          console.error('❌ Failed to process cover image:', err.message);
          return res.status(400).json({ error: 'Invalid cover image' });
        }
      }
    
      // Add other images in the album
      for (let j = 0; j < album.images.length; j++) {
        const tempimagePath = path.join(tempDir, `image_${downloadedImages.length}.jpg`);
        const key = extractKeyFromUrl(album.images[j].url);
        const data = getBase64FromS3(process.env.AWS_S3_BUCKET_NAME, key);
        console.log('Image URL:', (await data).substring(0,100)); // Debugging log
        const base64Data = (await data).replace('data:image/jpeg;base64,dataimage/jpegbase64', '');  // Remove the prefix
        const shrp = await sharp(Buffer.from(base64Data, 'base64')).rotate().toBuffer(); // Normalize orientation
        fs.writeFileSync(tempimagePath, shrp);
        downloadedImages.push(tempimagePath);// Store the original temp path for cleanup
      }

    }

    console.log('Downloaded images:', downloadedImages); // Debugging log
    console.log('Normalized images:', normalizedImages); // Debugging log
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

    const duration = await getVideoDuration(outputVideoPath);

    // Respond with the video URL
    const videoUrl = `http://recollekt.local:${PORT}/videos/${path.basename(outputVideoPath)}`;
    res.json({ videoUrl, outputVideoPath: outputVideoPath, duration });
  } catch (error) {
    console.error('Error generating video:', error);
    res.status(500).json({ error: 'Failed to generate video' });
  }
});

async function normalizeImageOrientation(inputPath, outputPath) {
  try {
    // Validate the image format
    const outPut = await sharp(inputPath).rotate().metadata();
    console.log('OUTPUT', outPut); // Debugging log
    // Normalize orientation
    console.log(`Normalized image saved to ${outPut}`);
  } catch (error) {
    console.error(`Failed to normalize image: ${inputPath}`, error);
    throw error;
  }
}


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

    // Assuming images are named as image_1.jpg, image_2.jpg, etc.
    command.input(path.join(path.dirname(images[0]), 'image_%d.jpg'))
      .inputOptions(['-framerate 1']) // Show each image for 1 second

      // Add a silent audio track to prevent iOS compatibility issues
      .input('silence.m4a')

      .outputOptions([
        '-c:v libx264',       // H.264 codec
        '-pix_fmt yuv420p',   // iOS-compatible pixel format
        '-c:a aac',           // AAC audio codec (iOS requirement)
        '-shortest',          // Match audio duration to video
        '-movflags +faststart', // iOS-friendly metadata layout
        '-r 30',              // Output at 30 FPS
      ])
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .save(outputPath);
  });
};
const getVideoDuration = (filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        return reject(err);
      }
      const duration = metadata.format.duration; // Duration in seconds
      resolve(duration);
    });
  });
};

function cleanupDirectory(directoryPath) {
  fs.readdir(directoryPath, (err, files) => {
    if (err) {
      console.error(`Failed to read directory ${directoryPath}:`, err);
      return;
    }
    for (const file of files) {
      fs.unlink(path.join(directoryPath, file), (err) => {
        if (err) console.error(`Failed to delete file ${file}:`, err);
      });
    }
  });
}
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
      (requestId) => requestId.toString() !== requester._id.toString()
    );
    console.log('Pending requests after approval:', user.pendingRequests); // Debugging log
    console.log('Requester ID:', requester._id.toString());

    await user.save();
    await requester.save();

    res.status(200).json({ message: `Friend request from ${requesterUsername} approved` });
  } catch (error) {
    console.error('Error approving friend request:', error);
    res.status(500).json({ error: 'Failed to approve friend request' });
  }
});


app.put('/edit-album', upload.none(), async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decodedToken = jwt.verify(token, 'your_jwt_secret'); // Replace with your JWT secret
    const userId = decodedToken.id;

    const { id, title, coverImage} = req.body;
    const images = req.body.images; // Expecting base64 image data
    const timestamps = req.body.timestamps; // Expecting timestamps for images

    // Validate the album ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid album ID' });
    }

    // Find the album to edit
    const album = await Album.findOne({ _id: id, creatorId: userId });
    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }

    const uploadToS3 = async (base64Image, fileName) => {
      const uniqueFileName = `${Date.now()}-${fileName}`;
      const buffer = Buffer.from(base64Image, 'base64');
      const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: uniqueFileName,
        Body: buffer,
        ContentType: 'image/jpeg',
      };

      try {
        const command = new PutObjectCommand(params);
        const response = await s3.send(command);
        console.log('Upload successful:', response);
        return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${uniqueFileName}`;
      } catch (error) {
        console.error('Error uploading to S3:', error);
        throw error;
      }
    };

    // Update album details
    if (title) album.title = title;
    if (coverImage != album.coverImage) album.coverImage = await uploadToS3(coverImage, `albums/${userId}/cover.jpg`);
    console.log(album.coverImage); // Debugging log
    console.log('title', album.title); // Debugging log
    console.log('id', album._id); // Debugging log
    album._id = id;
    
    // Handle images and timestamps
    const imageUrls = [];
    const b64IMGs = [];
    const imageArray = Array.isArray(images) ? images : [images]; // Handle single or multiple images
    const timestampArray = Array.isArray(timestamps) ? timestamps : [timestamps]; // Handle single or multiple timestamps

    for (const [index, image] of imageArray.entries()) {
      console.log('image', image); // Debugging log
      const imageUrl = await uploadToS3(image, `albums/${userId}/image_${index}.jpg`);
      console.log('Image URL:', imageUrl.substring(0, 100)); // Debugging log
      const time = new Date(timestampArray[index]);
      imageUrls.push({
        url: imageUrl,
        timestamp: timestampArray[index] || new Date(), // Use provided timestamp or fallback to current date
      });
      b64IMGs.push({
        url: image,
        timestamp: timestampArray[index] || new Date(), // Use provided timestamp or fallback to current date
      })
    }

    album.images = imageUrls; // Update images array


    await album.save();



    res.status(200).json({ message: 'Album updated successfully', album, base64CI: coverImage, images: b64IMGs });
  } catch (error) {
    console.error('Error updating album:', error);
    res.status(500).json({ error: 'Failed to update album' });
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

    

    console.log('Shared albums:', user.sharedAlbums);
    for (i = 0; i < user.sharedAlbums.length; i++) {
      const album = user.sharedAlbums[i];
      album.coverImage = await getBase64FromS3(process.env.AWS_S3_BUCKET_NAME, extractKeyFromUrl(album.coverImage));
    } // Debugging log

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

    const albums = await Album.find({ creatorId: userId });
    console.log('Fetched albums:', albums.length); // Debugging log
    for (i = 0; i < albums.length; i++) {
      const album = albums[i];
      album.coverImage = await getBase64FromS3(process.env.AWS_S3_BUCKET_NAME, extractKeyFromUrl(album.coverImage));
    }// Fetch albums for the current user
    res.status(200).json({ albums });
  } catch (error) {
    console.error('Error fetching albums:', error);
    res.status(500).json({ error: 'Failed to fetch albums' });
  }
});

app.get('/albums/:id', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decodedToken = jwt.verify(token, 'your_jwt_secret'); // Replace with your JWT secret
    const userId = decodedToken.id;

    // Validate the album ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid album ID' });
    }

    const album = await Album.findOne({ _id: req.params.id, creatorId: userId });
    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }

    // Fetch cover image and images from S3
    album.coverImage = await getBase64FromS3(process.env.AWS_S3_BUCKET_NAME, extractKeyFromUrl(album.coverImage));

    res.status(200).json({ album });
  } catch (error) {
    console.error('Error fetching album:', error);
    res.status(500).json({ error: 'Failed to fetch album' });
  }
});

app.get('/images', async (req, res) => {
  try {
    const image1 = req.query.url;
    console.log('Received image URL:', image1);
    const key = extractKeyFromUrl(image1);
    console.log('Extracted key:', key); // Debugging log
    const base64Image = await getBase64FromS3(process.env.AWS_S3_BUCKET_NAME, key);
    console.log('Base64 image:', base64Image.substring(0, 100)); // Debugging log
    res.status(200).json({ image: base64Image });
  } catch (error) {
    console.error('Error fetching image:', error);
    res.status(500).json({ error: 'Failed to fetch image' }); 
  }// Debugging log

});

app.delete('/albums/:id', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const album = await Album.findById(req.params.id);
    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }// Replace with your JWT secret
    await album.remove();
    res.status(200).json({ message: 'Album deleted successfully' });
  } catch (error) {
    console.error('Error deleting album:', error);
    res.status(500).json({ error: 'Failed to delete album' });
  }

});

app.post('/imges', upload.none(), async (req, res) => {
  const images = req.body.images;
  try {
    for (i = 0; i < images.length; i++) {
      const image = images[i].url;
      console.log('Image URL:', image); // Debugging log
      const key = extractKeyFromUrl(image);
      console.log('Extracted key:', key); // Debugging log
      const base64Image = await getBase64FromS3(process.env.AWS_S3_BUCKET_NAME, key);
      console.log('Base64 image:', base64Image.substring(0, 100)); // Debugging log
      images[i].url = base64Image;
    }
    res.status(200).json({ images });
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ error: 'Failed to fetch images' });
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