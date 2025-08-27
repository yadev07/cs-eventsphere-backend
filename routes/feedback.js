const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Feedback = require('../models/Feedback');
const Registration = require('../models/Registration');
const Event = require('../models/Event');
const { auth, requireFaculty } = require('../middleware/auth');
const router = express.Router();

// @route   POST /api/feedback
// @desc    Submit feedback for an event
// @access  Private
router.post('/', [
  auth,
  body('eventId').isMongoId().withMessage('Valid event ID is required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comments').trim().isLength({ min: 10, max: 1000 }).withMessage('Comments must be between 10 and 1000 characters'),
  body('categories.content').isInt({ min: 1, max: 5 }).withMessage('Content rating must be between 1 and 5'),
  body('categories.organization').isInt({ min: 1, max: 5 }).withMessage('Organization rating must be between 1 and 5'),
  body('categories.venue').isInt({ min: 1, max: 5 }).withMessage('Venue rating must be between 1 and 5'),
  body('categories.overall').isInt({ min: 1, max: 5 }).withMessage('Overall rating must be between 1 and 5'),
  body('suggestions').optional().trim().isLength({ max: 500 }).withMessage('Suggestions must not exceed 500 characters'),
  body('isAnonymous').optional().isBoolean().withMessage('isAnonymous must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      eventId,
      rating,
      comments,
      categories,
      suggestions,
      isAnonymous = false
    } = req.body;
    const userId = req.user._id;

    // Check if event exists and is completed
    const event = await Event.findById(eventId);
    if (!event || !event.isActive) {
      return res.status(404).json({ message: 'Event not found or inactive' });
    }

    if (event.status !== 'completed') {
      return res.status(400).json({ message: 'Feedback can only be submitted for completed events' });
    }

    // Check if user attended the event
    const registration = await Registration.findOne({
      event: eventId,
      participant: userId,
      status: 'confirmed',
      attended: true
    });

    if (!registration) {
      return res.status(400).json({ message: 'You must attend the event to submit feedback' });
    }

    // Check if user already submitted feedback
    const existingFeedback = await Feedback.findOne({
      event: eventId,
      participant: userId
    });

    if (existingFeedback) {
      return res.status(400).json({ message: 'You have already submitted feedback for this event' });
    }

    // Create feedback
    const feedback = new Feedback({
      event: eventId,
      participant: userId,
      registration: registration._id,
      rating,
      comments,
      categories,
      suggestions,
      isAnonymous,
      isApproved: false, // Requires admin/faculty approval
      isPublic: true
    });

    await feedback.save();

    // Populate event details for response
    await feedback.populate([
      { path: 'event', select: 'title date' },
      { path: 'participant', select: 'fullName' }
    ]);

    res.status(201).json({
      message: 'Feedback submitted successfully and pending approval',
      feedback
    });
  } catch (error) {
    console.error('Submit feedback error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.status(500).json({ message: 'Server error submitting feedback' });
  }
});

// @route   GET /api/feedback/event/:eventId
// @desc    Get all approved feedback for an event
// @access  Public
router.get('/event/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Check if event exists
    const event = await Event.findById(eventId);
    if (!event || !event.isActive) {
      return res.status(404).json({ message: 'Event not found or inactive' });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const feedback = await Feedback.find({
      event: eventId,
      isApproved: true,
      isPublic: true
    })
    .populate('participant', 'fullName')
    .sort({ submittedAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    const total = await Feedback.countDocuments({
      event: eventId,
      isApproved: true,
      isPublic: true
    });

    // Calculate average ratings
    const avgRatings = await Feedback.aggregate([
      { $match: { event: event._id, isApproved: true, isPublic: true } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          avgContent: { $avg: '$categories.content' },
          avgOrganization: { $avg: '$categories.organization' },
          avgVenue: { $avg: '$categories.venue' },
          avgOverall: { $avg: '$categories.overall' },
          totalFeedback: { $sum: 1 }
        }
      }
    ]);

    res.json({
      feedback,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalFeedback: total,
        hasNext: skip + feedback.length < total,
        hasPrev: parseInt(page) > 1
      },
      averageRatings: avgRatings[0] || {
        avgRating: 0,
        avgContent: 0,
        avgOrganization: 0,
        avgVenue: 0,
        avgOverall: 0,
        totalFeedback: 0
      }
    });
  } catch (error) {
    console.error('Get event feedback error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.status(500).json({ message: 'Server error getting feedback' });
  }
});

// @route   GET /api/feedback/my
// @desc    Get user's feedback submissions
// @access  Private
router.get('/my', auth, async (req, res) => {
  try {
    const feedback = await Feedback.find({ participant: req.user._id })
      .populate('event', 'title date poster')
      .sort({ submittedAt: -1 });

    res.json({ feedback });
  } catch (error) {
    console.error('Get my feedback error:', error);
    res.status(500).json({ message: 'Server error getting feedback' });
  }
});

// @route   GET /api/feedback/pending
// @desc    Get pending feedback for approval (Faculty/Admin only)
// @access  Private (Faculty/Admin)
router.get('/pending', [auth, requireFaculty], async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const pendingFeedback = await Feedback.find({
      isApproved: false,
      isPublic: true
    })
    .populate([
      { path: 'event', select: 'title date venue' },
      { path: 'participant', select: 'fullName email department' }
    ])
    .sort({ submittedAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    const total = await Feedback.countDocuments({
      isApproved: false,
      isPublic: true
    });

    res.json({
      pendingFeedback,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalFeedback: total,
        hasNext: skip + pendingFeedback.length < total,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Get pending feedback error:', error);
    res.status(500).json({ message: 'Server error getting pending feedback' });
  }
});

// @route   PUT /api/feedback/:id/approve
// @desc    Approve or reject feedback (Faculty/Admin only)
// @access  Private (Faculty/Admin)
router.put('/:id/approve', [
  auth,
  requireFaculty,
  body('isApproved').isBoolean().withMessage('isApproved must be a boolean'),
  body('adminNotes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { isApproved, adminNotes } = req.body;

    const feedback = await Feedback.findById(id).populate('event');
    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found' });
    }

    // Check if user can approve this feedback
    if (feedback.event.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to approve this feedback' });
    }

    feedback.isApproved = isApproved;
    if (adminNotes) feedback.adminNotes = adminNotes;

    await feedback.save();

    await feedback.populate([
      { path: 'event', select: 'title date' },
      { path: 'participant', select: 'fullName email' }
    ]);

    res.json({
      message: `Feedback ${isApproved ? 'approved' : 'rejected'} successfully`,
      feedback
    });
  } catch (error) {
    console.error('Approve feedback error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Feedback not found' });
    }
    res.status(500).json({ message: 'Server error approving feedback' });
  }
});

// @route   PUT /api/feedback/:id
// @desc    Update feedback (Owner only)
// @access  Private
router.put('/:id', [
  auth,
  body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comments').optional().trim().isLength({ min: 10, max: 1000 }).withMessage('Comments must be between 10 and 1000 characters'),
  body('suggestions').optional().trim().isLength({ max: 500 }).withMessage('Suggestions must not exceed 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updates = req.body;
    const userId = req.user._id;

    const feedback = await Feedback.findById(id);
    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found' });
    }

    // Check if user can edit this feedback
    if (feedback.participant.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to edit this feedback' });
    }

    // Check if feedback is already approved
    if (feedback.isApproved) {
      return res.status(400).json({ message: 'Cannot edit approved feedback' });
    }

    // Update fields
    Object.keys(updates).forEach(key => {
      if (key !== 'event' && key !== 'participant' && key !== 'registration') {
        feedback[key] = updates[key];
      }
    });

    // Reset approval status when feedback is modified
    feedback.isApproved = false;

    await feedback.save();

    await feedback.populate([
      { path: 'event', select: 'title date' },
      { path: 'participant', select: 'fullName' }
    ]);

    res.json({
      message: 'Feedback updated successfully and pending approval',
      feedback
    });
  } catch (error) {
    console.error('Update feedback error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Feedback not found' });
    }
    res.status(500).json({ message: 'Server error updating feedback' });
  }
});

// @route   DELETE /api/feedback/:id
// @desc    Delete feedback (Owner or Faculty/Admin)
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const feedback = await Feedback.findById(id).populate('event');
    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found' });
    }

    // Check if user can delete this feedback
    const canDelete = feedback.participant.toString() === userId.toString() ||
                     feedback.event.createdBy.toString() === userId.toString() ||
                     req.user.role === 'admin';

    if (!canDelete) {
      return res.status(403).json({ message: 'Not authorized to delete this feedback' });
    }

    await Feedback.findByIdAndDelete(id);

    res.json({ message: 'Feedback deleted successfully' });
  } catch (error) {
    console.error('Delete feedback error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Feedback not found' });
    }
    res.status(500).json({ message: 'Server error deleting feedback' });
  }
});

module.exports = router;
