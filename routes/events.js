const express = require('express');
const router = express.Router();
const { Event, EventParticipant, User } = require('../models');
const auth = require('../middleware/authMiddleware');

// Create Event
router.post('/', auth, async (req, res) => {
  try {
    const event = await Event.create({ ...req.body, organizer_id: req.user.id });
    res.json(event);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get All Events
router.get('/', async (req, res) => {
  try {
    const events = await Event.findAll({ include: User });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Event by ID
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findByPk(req.params.id, { include: [User] });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Event
router.put('/:id', auth, async (req, res) => {
  try {
    const [updated] = await Event.update(req.body, { where: { id: req.params.id, organizer_id: req.user.id } });
    if (!updated) return res.status(403).json({ error: 'Unauthorized or event not found' });
    const event = await Event.findByPk(req.params.id);
    res.json(event);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete Event
router.delete('/:id', auth, async (req, res) => {
  try {
    const deleted = await Event.destroy({ where: { id: req.params.id, organizer_id: req.user.id } });
    if (!deleted) return res.status(403).json({ error: 'Unauthorized or event not found' });
    res.json({ message: 'Event deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Join Event
router.post('/:id/join', auth, async (req, res) => {
  try {
    const participation = await EventParticipant.create({ event_id: req.params.id, user_id: req.user.id, status: 'joined' });
    res.json(participation);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;