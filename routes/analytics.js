const express = require('express');
const { query, validationResult } = require('express-validator');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Feedback = require('../models/Feedback');
const User = require('../models/User');
const { auth, requireFaculty } = require('../middleware/auth');
const router = express.Router();

// @route   GET /api/analytics/dashboard
// @desc    Get dashboard analytics (Faculty/Admin only)
// @access  Private (Faculty/Admin)
router.get('/dashboard', [auth, requireFaculty], async (req, res) => {
  try {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    // Get current month's events
    const currentMonthEvents = await Event.countDocuments({
      isActive: true,
      date: {
        $gte: new Date(currentYear, currentMonth, 1),
        $lt: new Date(currentYear, currentMonth + 1, 1)
      }
    });

    // Get total upcoming events
    const upcomingEvents = await Event.countDocuments({
      isActive: true,
      date: { $gte: currentDate },
      status: { $in: ['upcoming', 'ongoing'] }
    });

    // Get total registrations this month
    const currentMonthRegistrations = await Registration.countDocuments({
      isActive: true,
      registrationDate: {
        $gte: new Date(currentYear, currentMonth, 1),
        $lt: new Date(currentYear, currentMonth + 1, 1)
      }
    });

    // Get total feedback this month
    const currentMonthFeedback = await Feedback.countDocuments({
      isApproved: true,
      submittedAt: {
        $gte: new Date(currentYear, currentMonth, 1),
        $lt: new Date(currentYear, currentMonth + 1, 1)
      }
    });

    // Get average rating this month
    const avgRating = await Feedback.aggregate([
      {
        $match: {
          isApproved: true,
          submittedAt: {
            $gte: new Date(currentYear, currentMonth, 1),
            $lt: new Date(currentYear, currentMonth + 1, 1)
          }
        }
      },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' }
        }
      }
    ]);

    const totalEvents = await Event.countDocuments({ isActive: true });
    const totalRegistrations = await Registration.countDocuments({ isActive: true });
    const totalFeedback = await Feedback.countDocuments({ isApproved: true });
    const totalUsers = await User.countDocuments({ isActive: true });
    // Calculate average rating for all feedback
    const allAvgRatingAgg = await Feedback.aggregate([
      { $match: { isApproved: true } },
      { $group: { _id: null, avgRating: { $avg: '$rating' } } }
    ]);
    const averageRating = allAvgRatingAgg[0]?.avgRating || 0;

    const dashboardData = {
      currentMonth: {
        events: currentMonthEvents,
        registrations: currentMonthRegistrations,
        feedback: currentMonthFeedback,
        avgRating: avgRating[0]?.avgRating || 0
      },
      upcomingEvents,
      totalEvents,
      totalRegistrations,
      totalFeedback,
      totalUsers,
      averageRating
    };

    res.json(dashboardData);
  } catch (error) {
    console.error('Get dashboard analytics error:', error);
    res.status(500).json({ message: 'Server error getting dashboard analytics' });
  }
});

// @route   GET /api/analytics/events/trends
// @desc    Get event trends over time (Faculty/Admin only)
// @access  Private (Faculty/Admin)
router.get('/events/trends', [
  auth,
  requireFaculty,
  query('period').isIn(['week', 'month', 'quarter', 'year']).withMessage('Invalid period'),
  query('startDate').optional().isISO8601().withMessage('Invalid start date'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { period = 'month', startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    } else {
      // Default to last 12 months
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - 12);
      dateFilter = { date: { $gte: start, $lte: end } };
    }

    // Get events by period
    const eventsByPeriod = await Event.aggregate([
      { $match: { isActive: true, ...dateFilter } },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            week: { $week: '$date' }
          },
          count: { $sum: 1 },
          registrations: { $sum: '$currentParticipants' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.week': 1 } }
    ]);

    // Get event categories distribution
    const categoryDistribution = await Event.aggregate([
      { $match: { isActive: true, ...dateFilter } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get event types distribution
    const typeDistribution = await Event.aggregate([
      { $match: { isActive: true, ...dateFilter } },
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      eventsByPeriod,
      categoryDistribution,
      typeDistribution
    });
  } catch (error) {
    console.error('Get event trends error:', error);
    res.status(500).json({ message: 'Server error getting event trends' });
  }
});

// @route   GET /api/analytics/registrations/trends
// @desc    Get registration trends over time (Faculty/Admin only)
// @access  Private (Faculty/Admin)
router.get('/registrations/trends', [
  auth,
  requireFaculty,
  query('period').isIn(['week', 'month', 'quarter', 'year']).withMessage('Invalid period'),
  query('startDate').optional().isISO8601().withMessage('Invalid start date'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { period = 'month', startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        registrationDate: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    } else {
      // Default to last 12 months
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - 12);
      dateFilter = { registrationDate: { $gte: start, $lte: end } };
    }

    // Get registrations by period
    const registrationsByPeriod = await Registration.aggregate([
      { $match: { isActive: true, ...dateFilter } },
      {
        $group: {
          _id: {
            year: { $year: '$registrationDate' },
            month: { $month: '$registrationDate' },
            week: { $week: '$registrationDate' }
          },
          count: { $sum: 1 },
          confirmed: {
            $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
          },
          pending: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.week': 1 } }
    ]);

    // Get registration status distribution
    const statusDistribution = await Registration.aggregate([
      { $match: { isActive: true, ...dateFilter } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get registration type distribution
    const typeDistribution = await Registration.aggregate([
      { $match: { isActive: true, ...dateFilter } },
      {
        $group: {
          _id: '$registrationType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get department distribution
    const departmentDistribution = await Registration.aggregate([
      { $match: { isActive: true, ...dateFilter } },
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

    res.json({
      registrationsByPeriod,
      statusDistribution,
      typeDistribution,
      departmentDistribution
    });
  } catch (error) {
    console.error('Get registration trends error:', error);
    res.status(500).json({ message: 'Server error getting registration trends' });
  }
});

// @route   GET /api/analytics/feedback/trends
// @desc    Get feedback trends over time (Faculty/Admin only)
// @access  Private (Faculty/Admin)
router.get('/feedback/trends', [
  auth,
  requireFaculty,
  query('period').isIn(['week', 'month', 'quarter', 'year']).withMessage('Invalid period'),
  query('startDate').optional().isISO8601().withMessage('Invalid start date'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { period = 'month', startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        submittedAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    } else {
      // Default to last 12 months
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - 12);
      dateFilter = { submittedAt: { $gte: start, $lte: end } };
    }

    // Get feedback by period
    const feedbackByPeriod = await Feedback.aggregate([
      { $match: { isApproved: true, isPublic: true, ...dateFilter } },
      {
        $group: {
          _id: {
            year: { $year: '$submittedAt' },
            month: { $month: '$submittedAt' },
            week: { $week: '$submittedAt' }
          },
          count: { $sum: 1 },
          avgRating: { $avg: '$rating' },
          avgContent: { $avg: '$categories.content' },
          avgOrganization: { $avg: '$categories.organization' },
          avgVenue: { $avg: '$categories.venue' },
          avgOverall: { $avg: '$categories.overall' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.week': 1 } }
    ]);

    // Get rating distribution
    const ratingDistribution = await Feedback.aggregate([
      { $match: { isApproved: true, isPublic: true, ...dateFilter } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get category ratings
    const categoryRatings = await Feedback.aggregate([
      { $match: { isApproved: true, isPublic: true, ...dateFilter } },
      {
        $group: {
          _id: null,
          avgContent: { $avg: '$categories.content' },
          avgOrganization: { $avg: '$categories.organization' },
          avgVenue: { $avg: '$categories.venue' },
          avgOverall: { $avg: '$categories.overall' }
        }
      }
    ]);

    res.json({
      feedbackByPeriod,
      ratingDistribution,
      categoryRatings: categoryRatings[0] || {
        avgContent: 0,
        avgOrganization: 0,
        avgVenue: 0,
        avgOverall: 0
      }
    });
  } catch (error) {
    console.error('Get feedback trends error:', error);
    res.status(500).json({ message: 'Server error getting feedback trends' });
  }
});

// @route   GET /api/analytics/events/:eventId
// @desc    Get detailed analytics for a specific event (Faculty/Admin only)
// @access  Private (Faculty/Admin)
router.get('/events/:eventId', [auth, requireFaculty], async (req, res) => {
  try {
    const { eventId } = req.params;

    // Check if user can access this event's analytics
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view this event\'s analytics' });
    }

    // Get registration statistics
    const registrationStats = await Registration.aggregate([
      { $match: { event: event._id, isActive: true } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get registration timeline
    const registrationTimeline = await Registration.aggregate([
      { $match: { event: event._id, isActive: true } },
      {
        $group: {
          _id: {
            year: { $year: '$registrationDate' },
            month: { $month: '$registrationDate' },
            day: { $dayOfMonth: '$registrationDate' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Get department distribution
    const departmentDistribution = await Registration.aggregate([
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

    // Get year/semester distribution
    const yearDistribution = await Registration.aggregate([
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
          _id: {
            year: '$participant.year',
            semester: '$participant.semester'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get feedback statistics
    const feedbackStats = await Feedback.aggregate([
      { $match: { event: event._id, isApproved: true, isPublic: true } },
      {
        $group: {
          _id: null,
          totalFeedback: { $sum: 1 },
          avgRating: { $avg: '$rating' },
          avgContent: { $avg: '$categories.content' },
          avgOrganization: { $avg: '$categories.organization' },
          avgVenue: { $avg: '$categories.venue' },
          avgOverall: { $avg: '$categories.overall' }
        }
      }
    ]);

    const eventAnalytics = {
      event: {
        title: event.title,
        date: event.date,
        venue: event.venue,
        maxParticipants: event.maxParticipants,
        currentParticipants: event.currentParticipants
      },
      registrations: {
        stats: registrationStats,
        timeline: registrationTimeline,
        departmentDistribution,
        yearDistribution
      },
      feedback: feedbackStats[0] || {
        totalFeedback: 0,
        avgRating: 0,
        avgContent: 0,
        avgOrganization: 0,
        avgVenue: 0,
        avgOverall: 0
      }
    };

    res.json(eventAnalytics);
  } catch (error) {
    console.error('Get event analytics error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.status(500).json({ message: 'Server error getting event analytics' });
  }
});

// @route   GET /api/analytics/users/insights
// @desc    Get user insights and demographics (Faculty/Admin only)
// @access  Private (Faculty/Admin)
router.get('/users/insights', [auth, requireFaculty], async (req, res) => {
  try {
    // Get user role distribution
    const roleDistribution = await User.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get department distribution
    const departmentDistribution = await User.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get year distribution
    const yearDistribution = await User.aggregate([
      { $match: { isActive: true, year: { $exists: true } } },
      {
        $group: {
          _id: '$year',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get age distribution
    const ageDistribution = await User.aggregate([
      { $match: { isActive: true, age: { $exists: true } } },
      {
        $bucket: {
          groupBy: '$age',
          boundaries: [0, 18, 20, 22, 24, 26, 28, 30, 100],
          default: '30+',
          output: {
            count: { $sum: 1 }
          }
        }
      }
    ]);

    // Get user activity (last login) using $facet for efficiency and reliability
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const [activityCounts] = await User.aggregate([
      { $match: { isActive: true, lastLogin: { $exists: true } } },
      {
        $facet: {
          'last7Days': [
            { $match: { lastLogin: { $gte: sevenDaysAgo } } },
            { $count: 'count' }
          ],
          'last30Days': [
            { $match: { lastLogin: { $gte: thirtyDaysAgo, $lt: sevenDaysAgo } } },
            { $count: 'count' }
          ],
          'last90Days': [
            { $match: { lastLogin: { $gte: ninetyDaysAgo, $lt: thirtyDaysAgo } } },
            { $count: 'count' }
          ],
          'older': [
            { $match: { lastLogin: { $lt: ninetyDaysAgo } } },
            { $count: 'count' }
          ]
        }
      }
    ]);

    const userActivity = [
      { range: 'Last 7 days', count: activityCounts.last7Days[0]?.count || 0 },
      { range: '7-30 days', count: activityCounts.last30Days[0]?.count || 0 },
      { range: '30-90 days', count: activityCounts.last90Days[0]?.count || 0 },
      { range: '90+ days', count: activityCounts.older[0]?.count || 0 }
    ];

    const userInsights = {
      roleDistribution,
      departmentDistribution,
      yearDistribution,
      ageDistribution,
      userActivity,
      totalUsers: await User.countDocuments({ isActive: true }),
      activeUsers: await User.countDocuments({
        isActive: true,
        lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      })
    };

    res.json(userInsights);
  } catch (error) {
    console.error('Get user insights error:', error);
    res.status(500).json({ message: 'Server error getting user insights' });
  }
});

module.exports = router;
