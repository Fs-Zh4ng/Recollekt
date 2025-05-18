const mongoose = require('mongoose');

const albumSchema = new mongoose.Schema({
  title: { type: String, required: true },
  coverImage: { type: String, required: true },
  images: [
    {
      url: { type: String, required: true }, // Image URL
      timestamp: { type: Date, required: true }, // Timestamp for when the image was taken
    },
  ],
  creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
});

const Album = mongoose.model('Album', albumSchema);

module.exports = Album;