const mongoose = require('mongoose');

const albumSchema = new mongoose.Schema({
  title: { type: String, required: true },
  coverImage: { type: String }, // Store the S3 URL for the cover image
  images: [
    {
      url: { type: String, required: true }, // S3 URL for the image
      contentType: String, // MIME type of the image
      timestamp: { type: String, required: true }, // Timestamp for when the image was taken
    },
  ],
  creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
});

const Album = mongoose.model('Album', albumSchema);

module.exports = Album;