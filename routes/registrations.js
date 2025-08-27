const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Registration = require('../models/Registration');
const Event = require('../models/Event');
const User = require('../models/User');
const { auth, requireFaculty } = require('../middleware/auth');
const router = express.Router();

// @route   POST /api/registrations
// @desc    Register for an event
// @access  Private
router.post('/', [
  auth,
  body('eventId').isMongoId().withMessage('Valid event ID is required'),
  body('registrationType').isIn(['participant', 'coordinator']).withMessage('Invalid registration type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { eventId, registrationType } = req.body;
    const userId = req.user._id;

    // Check if event exists and is active
    const event = await Event.findById(eventId);
    if (!event || !event.isActive) {
      return res.status(404).json({ message: 'Event not found or inactive' });
    }

    // Check if event is full
    if (event.maxParticipants > 0 && event.currentParticipants >= event.maxParticipants) {
      return res.status(400).json({ message: 'Event is full' });
    }

    // Check if registration deadline has passed
    if (new Date() > event.registrationDeadline) {
      return res.status(400).json({ message: 'Registration deadline has passed' });
    }

    // Check if user is already registered
    const existingRegistration = await Registration.findOne({
      event: eventId,
      participant: userId
    });

    if (existingRegistration) {
      return res.status(400).json({ message: 'Already registered for this event' });
    }

    // Create registration
    const registration = new Registration({
      event: eventId,
      participant: userId,
      registrationType,
      status: 'pending'
    });

    await registration.save();

    // Update event participant count
    event.currentParticipants += 1;
    await event.save();

    // Populate event details for response
    await registration.populate([
      { path: 'event', select: 'title date venue' },
      { path: 'participant', select: 'fullName email' }
    ]);

    res.status(201).json({
      message: 'Registration successful',
      registration
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// @route   GET /api/registrations/my
// @desc    Get user's registrations
// @access  Private
router.get('/my', auth, async (req, res) => {
  try {
    const registrations = await Registration.find({ participant: req.user._id })
      .populate('event', 'title date venue poster status')
      .sort({ registrationDate: -1 });

    res.json({ registrations });
  } catch (error) {
    console.error('Get my registrations error:', error);
    res.status(500).json({ message: 'Server error getting registrations' });
  }
});

// @route   GET /api/registrations/event/:eventId
// @desc    Get all registrations for an event (Faculty/Admin only)
// @access  Private (Faculty/Admin)
router.get('/event/:eventId', [auth, requireFaculty], async (req, res) => {
  try {
    const { eventId } = req.params;
    const { page = 1, limit = 20, status } = req.query;

    // Check if user can access this event's registrations
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view this event\'s registrations' });
    }

    // Build filter
    const filter = { event: eventId };
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const registrations = await Registration.find(filter)
      .populate('participant', 'fullName email department year semester phoneNumber')
      .sort({ registrationDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Registration.countDocuments(filter);

    res.json({
      registrations,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalRegistrations: total,
        hasNext: skip + registrations.length < total,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Get event registrations error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.status(500).json({ message: 'Server error getting registrations' });
  }
});

// @route   PUT /api/registrations/:id/status
// @desc    Update registration status (Faculty/Admin only)
// @access  Private (Faculty/Admin)
router.put('/:id/status', [
  auth,
  requireFaculty,
  body('status').isIn(['pending', 'confirmed', 'rejected', 'cancelled']).withMessage('Invalid status'),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { status, notes } = req.body;

    const registration = await Registration.findById(id).populate('event');
    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    // Check if user can update this registration
    if (registration.event.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this registration' });
    }

    const oldStatus = registration.status;
    registration.status = status;
    if (notes) registration.coordinatorNotes = notes;

    await registration.save();

    // Update event participant count if status changed
    if (oldStatus !== status) {
      const event = await Event.findById(registration.event._id);
      if (event) {
        if (oldStatus === 'confirmed' && status !== 'confirmed') {
          event.currentParticipants = Math.max(0, event.currentParticipants - 1);
        } else if (oldStatus !== 'confirmed' && status === 'confirmed') {
          event.currentParticipants += 1;
        }
        await event.save();
      }
    }

    await registration.populate([
      { path: 'event', select: 'title date venue' },
      { path: 'participant', select: 'fullName email department' }
    ]);

    res.json({
      message: 'Registration status updated successfully',
      registration
    });
  } catch (error) {
    console.error('Update registration status error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Registration not found' });
    }
    res.status(500).json({ message: 'Server error updating registration status' });
  }
});

// @route   DELETE /api/registrations/:id
// @desc    Cancel registration
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const registration = await Registration.findById(id).populate('event');
    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    // Check if user can cancel this registration
    if (registration.participant.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to cancel this registration' });
    }

    // Check if event has already started
    if (new Date() >= registration.event.date) {
      return res.status(400).json({ message: 'Cannot cancel registration for an event that has already started' });
    }

    // Update event participant count
    if (registration.status === 'confirmed') {
      const event = await Event.findById(registration.event._id);
      if (event) {
        event.currentParticipants = Math.max(0, event.currentParticipants - 1);
        await event.save();
      }
    }

    // Soft delete registration
    registration.isActive = false;
    await registration.save();

    res.json({ message: 'Registration cancelled successfully' });
  } catch (error) {
    console.error('Cancel registration error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Registration not found' });
    }
    res.status(500).json({ message: 'Server error cancelling registration' });
  }
});

// @route   GET /api/registrations/stats/event/:eventId
// @desc    Get registration statistics for an event (Faculty/Admin only)
// @access  Private (Faculty/Admin)
router.get('/stats/event/:eventId', [auth, requireFaculty], async (req, res) => {
  try {
    const { eventId } = req.params;

    // Check if user can access this event's stats
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view this event\'s statistics' });
    }

    // Get registration statistics
    const stats = await Registration.aggregate([
      { $match: { event: event._id, isActive: true } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get registration type statistics
    const typeStats = await Registration.aggregate([
      { $match: { event: event._id, isActive: true } },
      {
        $group: {
          _id: '$registrationType',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get department statistics
    const deptStats = await Registration.aggregate([
      { $match: { event: event._id, isActive: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'participant',
          foreignField: '_id',
          as: 'participant'
        }
      },
      { $unwind: '$participant' },
      {
        $group: {
          _id: '$participant.department',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const response = {
      totalRegistrations: stats.reduce((sum, stat) => sum + stat.count, 0),
      statusBreakdown: stats,
      typeBreakdown: typeStats,
      departmentBreakdown: deptStats,
      event: {
        title: event.title,
        maxParticipants: event.maxParticipants,
        currentParticipants: event.currentParticipants
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Get registration stats error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.status(500).json({ message: 'Server error getting registration statistics' });
  }
});

module.exports = router;
