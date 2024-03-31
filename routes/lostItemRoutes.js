const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const Grid = require('gridfs-stream');
const { GridFsStorage } = require('multer-gridfs-storage');
const LostItem = require('../models/lostItemModel');

// Create storage engine
const storage = new GridFsStorage({
  url: 'mongodb://localhost:27017/ReClaim',
  file: (req, file) => {
    return {
      filename: file.originalname,
      bucketName: 'lost_items' // Store files in the lostItems collection
    };
  }
});
const upload = multer({ storage });

// Route to handle submission of lost item report
router.post('/submit-lost', upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'document', maxCount: 1 }]), async (req, res) => {
  try {
    const { itemName, date, place, description, status } = req.body;
    const photo = req.files['photo'][0]; // Get the uploaded photo file
    const document = req.files['document'][0]; // Get the uploaded document file

    // Create a new LostItem document
    const newLostItem = new LostItem({
      itemName,
      date,
      place,
      description,
      photo: { data: fs.readFileSync(photo.path), contentType: photo.mimetype },
      document: { data: fs.readFileSync(document.path), contentType: document.mimetype },
      status,
      report_uploaded: true // Set report_uploaded to true since report is uploaded
    });

    // Save the LostItem document to the database
    await newLostItem.save();

    // Delete the temporary files from the server
    fs.unlinkSync(photo.path);
    fs.unlinkSync(document.path);

    res.status(200).send('Lost item report submitted successfully');
  } catch (error) {
    console.error('Error submitting lost item report:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
