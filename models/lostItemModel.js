const mongoose = require('mongoose');

const lostItemSchema = new mongoose.Schema({
  itemName: { type: String, required: true },
  date: { type: Date, required: true },
  place: { type: String, required: true },
  description: { type: String, required: true },
  photo: { data: Buffer, contentType: String }, // Store the photo as a buffer and content type
  document: { data: Buffer, contentType: String }, // Store the document as a buffer and content type
  status: { type: String, required: true }, // Status of the lost item
  report_uploaded: { type: Boolean, default: false } // Indicates if the report has been uploaded
});

const LostItem = mongoose.model('lost_items', lostItemSchema);

module.exports = LostItem;
