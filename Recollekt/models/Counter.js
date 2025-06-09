const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  seq: { type: Number, required: true },
});

const Counter = mongoose.model('Counter', counterSchema);

module.exports = Counter;
