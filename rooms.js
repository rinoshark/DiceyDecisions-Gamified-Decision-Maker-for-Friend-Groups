 
const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const Option = require('../models/Option');
const Vote = require('../models/Vote');
const mongoose = require('mongoose');

// Utility to generate unique 6-char uppercase room codes
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for(let i=0; i<6; i++) {
    code+=chars.charAt(Math.floor(Math.random()*chars.length));
  }
  return code;
}

// Create room
router.post('/', async (req, res) => {
  try {
    const { title, description = '', maxParticipants=0 } = req.body;
    if(!title) return res.status(400).json({message:'Title is required'});

    // Generate unique code
    let code;
    let exists;
    do {
      code = generateRoomCode();
      exists = await Room.findOne({ code });
    } while (exists);

    const room = new Room({
      title,
      description,
      maxParticipants,
      code,
      creatorId: req.user.id,
      participants: [req.user.id],
    });
    await room.save();
    res.status(201).json({
      message:'Room created',
      roomCode: code,
      inviteLink: `${req.protocol}://${req.get('host')}/join/${code}`,
      roomId: room._id,
    });
  } catch(err) {
    res.status(500).json({message:'Server error: '+err.message});
  }
});

// Join room by code
router.post('/join', async (req, res) => {
  try {
    const { code } = req.body;
    if(!code) return res.status(400).json({message:'Room code required'});
    const room = await Room.findOne({ code: code.toUpperCase() });
    if(!room) return res.status(404).json({message: 'Room not found'});
    if(room.maxParticipants > 0 && room.participants.length >= room.maxParticipants){
      return res.status(400).json({message: 'Room full'});
    }

    if(!room.participants.includes(req.user.id)) {
      room.participants.push(req.user.id);
      await room.save();
    }
    res.json({ message: 'Joined room', roomId: room._id });
  } catch(err) {
    res.status(500).json({message:'Server error: '+err.message});
  }
});

// Fetch user rooms (created or participated)
router.get('/', async (req, res) => {
  try {
    const rooms = await Room.find({
      participants: req.user.id
    }).sort({createdAt: -1});
    res.json(rooms);
  } catch(err) {
    res.status(500).json({message:'Server error: '+err.message});
  }
});

// Get room info with options list (no votes)
router.get('/:id', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if(!room) return res.status(404).json({message:'Room not found'});
    if(!room.participants.includes(req.user.id)) {
      return res.status(403).json({ message: 'Not authorized for this room' });
    }
    const options = await Option.find({ roomId: room._id });
    res.json({ room, options });
  } catch(err) {
    res.status(500).json({message:'Server error: '+err.message});
  }
});

// Submit option to room (only before voting opens)
router.post('/:id/options', async (req, res) => {
  try {
    const { text } = req.body;
    if(!text) return res.status(400).json({message:'Option text required'});

    const room = await Room.findById(req.params.id);
    if(!room) return res.status(404).json({message:'Room not found'});
    if(!room.participants.includes(req.user.id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    if(room.votingOpen) return res.status(400).json({message:'Cannot add options after voting opened'});

    // Allow multiple options per participant (per your spec)
    const option = new Option({
      roomId: room._id,
      text,
      submittedBy: req.user.id,
    });
    await option.save();
    res.status(201).json({ message:'Option added', option });
  } catch(err) {
    res.status(500).json({message:'Server error: '+err.message});
  }
});

// Open voting (only creator)
router.post('/:id/openvoting', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if(!room) return res.status(404).json({message:'Room not found'});
    if(room.creatorId.toString() !== req.user.id) return res.status(403).json({message:'Only creator can open voting'});
    if(room.votingOpen) return res.status(400).json({message:'Voting already opened'});
    room.votingOpen = true;
    await room.save();
    res.json({ message:'Voting opened' });
  } catch(err) {
    res.status(500).json({message:'Server error: '+err.message});
  }
});

// Vote (only once per participant)
router.post('/:id/vote', async (req, res) => {
  try {
    const { optionId } = req.body;
    if(!optionId) return res.status(400).json({message:'optionId required'});
    const room = await Room.findById(req.params.id);
    if(!room) return res.status(404).json({message:'Room not found'});
    if(!room.votingOpen) return res.status(400).json({message:'Voting is not open'});
    if(!room.participants.includes(req.user.id)) return res.status(403).json({message:'Not authorized'});

    // Check if user already voted
    const existingVote = await Vote.findOne({ roomId: room._id, votedBy: req.user.id });
    if(existingVote) return res.status(400).json({message:'User already voted in this room'});

    // Check user not voting for their own option more than once
    const option = await Option.findById(optionId);
    if(!option) return res.status(404).json({message:'Option not found'});
    if(option.roomId.toString() !== room._id.toString()) return res.status(400).json({message:'Option does not belong to room'});

    if(option.submittedBy.toString() === req.user.id) {
      // They can’t vote on their own option more than once, meaning here voting once total, so allowed once vote per room suffices
      // Already restricted by one vote per room, so no extra needed here
    }

    const vote = new Vote({
      roomId: room._id,
      optionId,
      votedBy: req.user.id,
    });
    await vote.save();
    res.json({ message:'Vote cast' });
  } catch(err) {
    res.status(500).json({message:'Server error: '+err.message});
  }
});

// Close voting
router.post('/:id/closevoting', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if(!room) return res.status(404).json({message:'Room not found'});
    if(room.creatorId.toString() !== req.user.id) return res.status(403).json({message:'Only creator can close voting'});
    if(!room.votingOpen) return res.status(400).json({message:'Voting not open'});

    room.votingOpen = false;
    room.votingClosed = true;
    await room.save();
    res.json({ message: 'Voting closed' });
  } catch(err) {
    res.status(500).json({message:'Server error: '+err.message});
  }
});

// Get results (only after voting closed)
router.get('/:id/results', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if(!room) return res.status(404).json({message:'Room not found'});
    if(!room.votingClosed) return res.status(400).json({message:'Voting not closed yet'});
    if(!room.participants.includes(req.user.id)) return res.status(403).json({message:'Not authorized'});

    // Aggregate votes per option
    const agg = await Vote.aggregate([
      { $match: { roomId: mongoose.Types.ObjectId(room._id) }},
      { $group: { _id: '$optionId', votes: { $sum: 1 } } },
      { $sort: { votes: -1 } }
    ]);
    // Load option text for each
    const results = await Promise.all(agg.map(async (a) => {
      const opt = await Option.findById(a._id);
      return {
        optionId: a._id,
        text: opt ? opt.text : 'Deleted option',
        votes: a.votes,
      };
    }));

    // Find if tie: check if top votes count multiple options share same count
    let tiebreakerUsed = room.tiebreakerUsed || null;
    let finalOption = room.finalOption || null;

    res.json({ results, tiebreakerUsed, finalOption });
  } catch(err) {
    res.status(500).json({message:'Server error: '+err.message});
  }
});

// Trigger tiebreaker (creator selects and backend does random pick)
router.post('/:id/tiebreaker', async (req, res) => {
  try {
    const { method } = req.body; // 'dice', 'spinner', 'coin'
    const room = await Room.findById(req.params.id);
    if(!room) return res.status(404).json({message:'Room not found'});
    if(room.creatorId.toString() !== req.user.id) return res.status(403).json({message:'Only creator can trigger tiebreaker'});
    if(!room.votingClosed) return res.status(400).json({message:'Voting must be closed'});

    // Aggregate votes as before
    const agg = await Vote.aggregate([
      { $match: { roomId: mongoose.Types.ObjectId(room._id) }},
      { $group: { _id: '$optionId', votes: { $sum: 1 } } },
      { $sort: { votes: -1 } }
    ]);
    if(agg.length === 0) return res.status(400).json({message: 'No votes found'});

    // Find max votes
    let maxVotes = agg[0].votes;
    // Find tied options (with max votes)
    let tiedOptionIds = agg.filter(a => a.votes === maxVotes).map(a => a._id.toString());
    if(tiedOptionIds.length < 2) return res.status(400).json({message:'No tie to break'});

    // Randomly pick winner from tied options
    const winnerId = tiedOptionIds[Math.floor(Math.random() * tiedOptionIds.length)];
    const winnerOpt = await Option.findById(winnerId);

    room.finalOption = winnerOpt ? winnerOpt.text : null;
    room.tiebreakerUsed = method || 'random';
    await room.save();

    res.json({ 
      message: 'Tiebreaker completed',
      winner: room.finalOption,
      method: room.tiebreakerUsed
    });
  } catch(err) {
    res.status(500).json({message:'Server error: '+err.message});
  }
});

// Delete room (creator only)
router.delete('/:id', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if(!room) return res.status(404).json({message:'Room not found'});
    if(room.creatorId.toString() !== req.user.id) return res.status(403).json({message:'Only creator can delete room'});

    // Delete related options and votes
    await Option.deleteMany({ roomId: room._id });
    await Vote.deleteMany({ roomId: room._id });
    await room.deleteOne();

    res.json({ message: 'Room deleted' });
  } catch(err) {
    res.status(500).json({message:'Server error: '+err.message});
  }
});

module.exports = router;
