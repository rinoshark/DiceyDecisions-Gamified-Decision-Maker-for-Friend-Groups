const mongoose = require('mongoose');

const VoteSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  optionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Option', required: true },
  votedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Vote', VoteSchema);
 
