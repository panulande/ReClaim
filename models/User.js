// models/User.js

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  user_id: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true },
  name: { type: String, required: true },
  address: { type: String, required: true },
  phone: { type: String, required: true },
  lost_Items: [{
    lost_item_id: { type: String, required: true },
    item_name: { type: String, required: true },
    description: { type: String, required: true },
    image_url: { type: String, required: true },
    location: { type: String, required: true },
    status: { type: Number, required: true },
  }],
  found_Items: [{
    found_item_id: { type: String, required: true },
    item_name: { type: String, required: true },
    description: { type: String, required: true },
    image_url: { type: String, required: true },
    location: { type: String, required: true },
    found_date: { type: Date, required: true },
  }],
  claimed_Items: [{
    claim_id: { type: String, required: true },
    user_id: { type: String, required: true },
    item_id: { type: String, required: true },
    message: { type: String, required: true },
    recover_at: { type: String, required: true }, // Assuming it's a string, change it to the appropriate type
    date_claimed: { type: Date, required: true },
  }],
});

const User = mongoose.model('User', userSchema);

module.exports = User;
