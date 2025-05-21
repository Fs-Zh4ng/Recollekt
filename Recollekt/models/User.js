const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profileImage: { type: String, default: '/Users/Ferdinand/NoName/Recollekt/assets/images/DefProfile.webp'}, // Default profile image
  friends: { type: [String], default: [] }, // List of friend usernames
  pendingRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
  sharedAlbums: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Album' }], // Reference to shared albums
  // Reference to User model
});

const User = mongoose.model('User', userSchema);

module.exports = User;