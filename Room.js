const mongoose = require('mongoose');
const RoomSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  maxParticipants: { type: Number, default: 0 },
  code: { type: String, required: true, unique: true },
  creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now },
  isOpen: { type: Boolean, default: true },
  votingOpen: { type: Boolean, default: false },
  votingClosed: { type: Boolean, default: false },
  votesReveal: { type: Boolean, default: false },
  finalOption: { type: String, default: null },
  tiebreakerUsed: { type: String, default: null },
});
module.exports = mongoose.model('Room', RoomSchema); 
