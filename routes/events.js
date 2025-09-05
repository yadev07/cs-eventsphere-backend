const express = require('express');
const { body, validationResult } = require('express-validator');
const Event = require('../models/Event');
const User = require('../models/User');
const { 
  auth, 
  requireFaculty, 
  requirePermission, 
  requireOwnershipOrAdmin,
  canParticipateInEvent,
  isRegisteredForEvent,
  rateLimit 
} = require('../middleware/auth');
const router = express.Router();

// @route   GET /api/events
// @desc    Get all published events with filtering and pagination
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { 
      category, 
      status, 
      search, 
      page = 1, 
      limit = 10,
      sortBy = 'startDate',
      sortOrder = 'asc'
    } = req.query;

    const skip = (page - 1) * limit;
  // Show all events with new status values by default
  let query = { isActive: true };

    // Apply filters
    if (category) query.category = category;
    if (status && status !== 'all') {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    let events = await Event.find(query)
      .populate('createdBy', 'fullName department')
      .populate('organizers', 'fullName department')
      .skip(skip)
      .limit(parseInt(limit))
      .sort(sort);

    // Categorize and update status based on real time date
    const now = new Date();
    events = events.map(event => {
      let newStatus = event.status;
      if (event.endDate < now) {
        newStatus = 'Past';
      } else if (event.startDate > now) {
        newStatus = 'Upcoming';
      } else if (event.startDate <= now && event.endDate >= now) {
        newStatus = 'Live';
      }
      // Only update if status is different
      if (event.status !== newStatus) {
        event.status = newStatus;
        event.save();
      }
      // Attach computed status for frontend
      return { ...event.toObject(), computedStatus: newStatus };
    });

    const total = await Event.countDocuments(query);

    res.json({
      success: true,
      events,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalEvents: total,
        eventsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting events'
    });
  }
});

// @route   GET /api/events/featured/current
// @desc    Get a curated list of featured current/upcoming events
// @access  Public
router.get('/featured/current', async (req, res) => {
  try {
    const now = new Date();
    // Featured logic: upcoming or ongoing, active, and either popular or recently created
    const query = {
      isActive: true,
      status: { $in: ['published', 'ongoing', 'upcoming'] },
      endDate: { $gte: now }
    };

    const featuredEvents = await Event.find(query)
      .populate('createdBy', 'fullName department')
      .sort({ registrations: -1, views: -1, createdAt: -1 })
      .limit(6);

    return res.json({ success: true, featuredEvents });
  } catch (error) {
    console.error('Get featured events error:', error);
    return res.status(500).json({ success: false, message: 'Server error getting featured events' });
  }
});

// @route   GET /api/events/upcoming
// @desc    Get upcoming events
// @access  Public
router.get('/upcoming', async (req, res) => {
  try {
    const events = await Event.findUpcoming()
      .populate('createdBy', 'fullName department')
      .limit(10);

    res.json({
      success: true,
      events
    });
  } catch (error) {
    console.error('Get upcoming events error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting upcoming events'
    });
  }
});

// @route   GET /api/events/ongoing
// @desc    Get ongoing events
// @access  Public
router.get('/ongoing', async (req, res) => {
  try {
    const events = await Event.findOngoing()
      .populate('createdBy', 'fullName department');

    res.json({
      success: true,
      events
    });
  } catch (error) {
    console.error('Get ongoing events error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting ongoing events'
    });
  }
});

// @route   GET /api/events/completed
// @desc    Get completed events
// @access  Public
router.get('/completed', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const events = await Event.findCompleted()
      .populate('createdBy', 'fullName department')
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Event.countDocuments({ 
      endDate: { $lt: new Date() }, 
      status: { $in: ['published', 'completed'] }, 
      isActive: true 
    });

    res.json({
      success: true,
      events,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalEvents: total,
        eventsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get completed events error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting completed events'
    });
  }
});

// @route   GET /api/events/my-events
// @desc    Get events created by current user
// @access  Private (Faculty/Admin/Coordinator)
router.get('/my-events', auth, requirePermission('create:events'), async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    let query = { createdBy: req.user._id, isActive: true };
    if (status && status !== 'all') query.status = status;

    const events = await Event.find(query)
      .populate('organizers', 'fullName department')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Event.countDocuments(query);

    res.json({
      success: true,
      events,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalEvents: total,
        eventsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get my events error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting your events'
    });
  }
});

// @route   GET /api/events/:id
// @desc    Get event by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('createdBy', 'fullName department email')
      .populate('organizers', 'fullName department')
      .populate('moderators', 'fullName department')
      .populate('participants.userId', 'fullName department email');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    if (!event.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Increment view count
    event.views++;
    await event.save();

    res.json({
      success: true,
      event
    });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting event'
    });
  }
});

// @route   POST /api/events
// @desc    Create new event
// @access  Private (Faculty/Admin/Coordinator)
router.post('/', [
  auth,
  requirePermission('create:events'),
  body('title').trim().isLength({ min: 5 }).withMessage('Title must be at least 5 characters'),
  body('description').trim().isLength({ min: 20 }).withMessage('Description must be at least 20 characters'),
  body('shortDescription').trim().isLength({ min: 10, max: 200 }).withMessage('Short description must be between 10 and 200 characters'),
  body('category').isIn(['Technical', 'Cultural', 'Sports', 'Academic', 'Workshop', 'Seminar', 'Competition', 'Other']).withMessage('Invalid category'),
  body('startDate').isISO8601().withMessage('Valid start date required'),
  body('endDate').isISO8601().withMessage('Valid end date required'),
  body('startTime').notEmpty().withMessage('Start time required'),
  body('endTime').notEmpty().withMessage('End time required'),
  body('venue').trim().notEmpty().withMessage('Venue required'),
  body('maxParticipants').optional().isInt({ min: 0 }).withMessage('Max participants must be a positive number'),
  body('registrationDeadline').isISO8601().withMessage('Valid registration deadline required'),
  body('eventType').isIn(['offline', 'online', 'hybrid']).withMessage('Invalid event type'),
  body('tags').optional().isArray().withMessage('Tags must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const eventData = {
    ...req.body,
    createdBy: req.user._id,
    organizers: [req.user._id]
    };

    const event = new Event(eventData);
    await event.save();

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      event
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating event'
    });
  }
});

// @route   PUT /api/events/:id
// @desc    Update event
// @access  Private (Event owner or Admin)
router.put('/:id', [
  auth,
  requireOwnershipOrAdmin(Event, 'id'),
  body('title').optional().trim().isLength({ min: 5 }).withMessage('Title must be at least 5 characters'),
  body('description').optional().trim().isLength({ min: 20 }).withMessage('Description must be at least 20 characters'),
  body('shortDescription').optional().trim().isLength({ min: 10, max: 200 }).withMessage('Short description must be between 10 and 200 characters'),
  body('category').optional().isIn(['Technical', 'Cultural', 'Sports', 'Academic', 'Workshop', 'Seminar', 'Competition', 'Other']).withMessage('Invalid category'),
  body('startDate').optional().isISO8601().withMessage('Valid start date required'),
  body('endDate').optional().isISO8601().withMessage('Valid end date required'),
  body('startTime').optional().notEmpty().withMessage('Start time required'),
  body('endTime').optional().notEmpty().withMessage('End time required'),
  body('venue').optional().trim().notEmpty().withMessage('Venue required'),
  body('maxParticipants').optional().isInt({ min: 0 }).withMessage('Max participants must be a positive number'),
  body('registrationDeadline').optional().isISO8601().withMessage('Valid registration deadline required'),
  body('eventType').optional().isIn(['offline', 'online', 'hybrid']).withMessage('Invalid event type'),
  body('tags').optional().isArray().withMessage('Tags must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    res.json({
      success: true,
      message: 'Event updated successfully',
      event
    });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating event'
    });
  }
});

// @route   DELETE /api/events/:id
// @desc    Delete event
// @access  Private (Event owner or Admin)
router.delete('/:id', auth, requireOwnershipOrAdmin(Event, 'id'), async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    res.json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting event'
    });
  }
});

// @route   POST /api/events/:id/publish
// @desc    Publish event
// @access  Private (Event owner or Admin)
router.post('/:id/publish', auth, requireOwnershipOrAdmin(Event, 'id'), async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    if (event.status === 'published') {
      return res.status(400).json({
        success: false,
        message: 'Event is already published'
      });
    }

    event.status = 'published';
    await event.save();

    res.json({
      success: true,
      message: 'Event published successfully',
      event
    });
  } catch (error) {
    console.error('Publish event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error publishing event'
    });
  }
});

// @route   POST /api/events/:id/register
// @desc    Register for event
// @access  Private (Authenticated users)
router.post('/:id/register', auth, canParticipateInEvent, async (req, res) => {
  try {
    const event = req.event;
    
    // Register user for event
    await event.registerUser(req.user._id);

    // Update user's participated events
    await User.findByIdAndUpdate(req.user._id, {
      $push: {
        participatedEvents: {
          eventId: event._id,
          status: 'registered'
        }
      }
    });

    res.json({
      success: true,
      message: 'Successfully registered for event',
      event: {
        id: event._id,
        title: event.title,
        startDate: event.startDate,
        venue: event.venue
      }
    });
  } catch (error) {
    console.error('Event registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during event registration'
    });
  }
});

// @route   POST /api/events/:id/unregister
// @desc    Unregister from event
// @access  Private (Registered users)
router.post('/:id/unregister', auth, isRegisteredForEvent, async (req, res) => {
  try {
    const event = req.event;
    const participant = req.participant;

    // Remove user from event participants
    event.participants = event.participants.filter(p => p.userId.toString() !== req.user._id.toString());
    event.currentParticipants--;
    event.registrations--;
    await event.save();

    // Remove event from user's participated events
    await User.findByIdAndUpdate(req.user._id, {
      $pull: {
        participatedEvents: { eventId: event._id }
      }
    });

    res.json({
      success: true,
      message: 'Successfully unregistered from event'
    });
  } catch (error) {
    console.error('Event unregistration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during event unregistration'
    });
  }
});

// @route   POST /api/events/:id/attendance
// @desc    Mark attendance for event
// @access  Private (Event organizers or Admin)
router.post('/:id/attendance', auth, requireOwnershipOrAdmin(Event, 'id'), async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID required'
      });
    }

    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Mark attendance
    await event.markAttendance(userId);

    res.json({
      success: true,
      message: 'Attendance marked successfully'
    });
  } catch (error) {
    console.error('Mark attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error marking attendance'
    });
  }
});

// @route   GET /api/events/:id/participants
// @desc    Get event participants
// @access  Private (Event organizers or Admin)
router.get('/:id/participants', auth, requireOwnershipOrAdmin(Event, 'id'), async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('participants.userId', 'fullName email department year semester');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    res.json({
      success: true,
      participants: event.participants
    });
  } catch (error) {
    console.error('Get participants error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting participants'
    });
  }
});

// @route   GET /api/events/:id/related
// @desc    Get related events
// @access  Public
router.get('/:id/related', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Find related events based on category and tags
    const relatedEvents = await Event.find({
      _id: { $ne: req.params.id },
      isActive: true,
      $or: [
        { category: event.category },
        { tags: { $in: event.tags || [] } }
      ]
    })
    .populate('createdBy', 'fullName department')
    .limit(4)
    .sort({ startDate: 1 });

    res.json({
      success: true,
      relatedEvents
    });
  } catch (error) {
    console.error('Get related events error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting related events'
    });
  }
});

// @route   POST /api/events/:id/like
// @desc    Like/Unlike event
// @access  Private (Authenticated users)
router.post('/:id/like', auth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    if (!event.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const userId = req.user._id;
    const isLiked = event.likes && event.likes.includes(userId);

    if (isLiked) {
      // Unlike the event
      event.likes = event.likes.filter(id => id.toString() !== userId.toString());
      event.likeCount = Math.max(0, (event.likeCount || 0) - 1);
    } else {
      // Like the event
      if (!event.likes) event.likes = [];
      event.likes.push(userId);
      event.likeCount = (event.likeCount || 0) + 1;
    }

    await event.save();

    res.json({
      success: true,
      isLiked: !isLiked,
      likeCount: event.likeCount
    });
  } catch (error) {
    console.error('Like event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating like status'
    });
  }
});

// @route   GET /api/events/:id/statistics
// @desc    Get event statistics
// @access  Private (Event organizers or Admin)
router.get('/:id/statistics', auth, requireOwnershipOrAdmin(Event, 'id'), async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const statistics = event.getStatistics();

    res.json({
      success: true,
      statistics
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting statistics'
    });
  }
});

module.exports = router;
