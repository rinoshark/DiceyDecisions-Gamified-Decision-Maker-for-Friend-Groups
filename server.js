require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const { authenticateJWT } = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json());

// Log the MongoDB URI for debugging
console.log('MongoDB URI:', process.env.MONGODB_URI); // Ensure this matches your .env variable

app.use('/api/auth', authRoutes);
app.use('/api/rooms', authenticateJWT, roomRoutes);

const PORT = process.env.PORT || 5000;

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });
