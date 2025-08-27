const express = require('express');
const { body, validationResult, query } = require('express-validator');
const User = require('../models/User');
const { auth, requireAdmin, requireFaculty } = require('../middleware/auth');
const router = express.Router();

// @route   GET /api/users
// @desc    Get all users with filtering and pagination (Admin/Faculty only)
// @access  Private (Admin/Faculty)
router.get('/', [
  auth,
  requireFaculty,
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('role').optional().isIn(['admin', 'faculty', 'participant', 'coordinator']),
  query('department').optional().trim(),
  query('search').optional().trim(),
  query('status').optional().isIn(['active', 'inactive'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      page = 1,
      limit = 20,
      role,
      department,
      search,
      status
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (role) filter.role = role;
    if (department) filter.department = department;
    if (status === 'active') filter.isActive = true;
    if (status === 'inactive') filter.isActive = false;
    
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { scholarNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get users with pagination
    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await User.countDocuments(filter);

    res.json({
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalUsers: total,
        hasNext: skip + users.length < total,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error getting users' });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID (Admin/Faculty or self)
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Check if user can view this profile
    if (id !== userId.toString() && req.user.role !== 'admin' && req.user.role !== 'faculty') {
      return res.status(403).json({ message: 'Not authorized to view this profile' });
    }

    const user = await User.findById(id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(500).json({ message: 'Server error getting user' });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user profile (Admin/Faculty or self)
// @access  Private
router.put('/:id', [
  auth,
  body('fullName').optional().trim().isLength({ min: 2 }).withMessage('Full name must be at least 2 characters'),
  body('department').optional().trim().notEmpty().withMessage('Department cannot be empty'),
  body('year').optional().isIn(['1st', '2nd', '3rd', '4th', 'Masters 1st', 'Masters 2nd']).withMessage('Invalid year'),
  body('semester').optional().isIn(['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']).withMessage('Invalid semester'),
  body('phoneNumber').optional().trim().notEmpty().withMessage('Phone number cannot be empty'),
  body('interests').optional().isArray().withMessage('Interests must be an array'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const userId = req.user._id;
    const updates = req.body;

    // Check if user can update this profile
    if (id !== userId.toString() && req.user.role !== 'admin' && req.user.role !== 'faculty') {
      return res.status(403).json({ message: 'Not authorized to update this profile' });
    }

    // Regular users cannot update certain fields
    if (req.user.role === 'participant' || req.user.role === 'coordinator') {
      delete updates.isActive;
      delete updates.role;
    }

    // Faculty cannot update admin fields
    if (req.user.role === 'faculty') {
      delete updates.role;
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update fields
    Object.keys(updates).forEach(key => {
      if (key !== 'password' && key !== 'email') {
        user[key] = updates[key];
      }
    });

    await user.save();

    res.json({
      message: 'User updated successfully',
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Update user error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(500).json({ message: 'Server error updating user' });
  }
});

// @route   DELETE /api/users/:id
// @desc    Deactivate user (Admin/Faculty only)
// @access  Private (Admin/Faculty)
router.delete('/:id', [auth, requireFaculty], async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Check if user can deactivate this user
    if (id === userId.toString()) {
      return res.status(400).json({ message: 'Cannot deactivate your own account' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Faculty cannot deactivate admin accounts
    if (req.user.role === 'faculty' && user.role === 'admin') {
      return res.status(403).json({ message: 'Faculty cannot deactivate admin accounts' });
    }

    // Soft delete - mark as inactive
    user.isActive = false;
    await user.save();

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Deactivate user error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(500).json({ message: 'Server error deactivating user' });
  }
});

// @route   POST /api/users/:id/reactivate
// @desc    Reactivate user (Admin only)
// @access  Private (Admin)
router.post('/:id/reactivate', [auth, requireAdmin], async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isActive = true;
    await user.save();

    res.json({ message: 'User reactivated successfully' });
  } catch (error) {
    console.error('Reactivate user error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(500).json({ message: 'Server error reactivating user' });
  }
});

// @route   GET /api/users/stats/overview
// @desc    Get user statistics overview (Admin/Faculty only)
// @access  Private (Admin/Faculty)
router.get('/stats/overview', [auth, requireFaculty], async (req, res) => {
  try {
    // Get total users by role
    const roleStats = await User.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get total users by department
    const departmentStats = await User.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get total users by year
    const yearStats = await User.aggregate([
      { $match: { isActive: true, year: { $exists: true } } },
      {
        $group: {
          _id: '$year',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get recent registrations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentRegistrations = await User.countDocuments({
      isActive: true,
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Get active users (logged in last 30 days)
    const activeUsers = await User.countDocuments({
      isActive: true,
      lastLogin: { $gte: thirtyDaysAgo }
    });

    const userStats = {
      roleStats,
      departmentStats,
      yearStats,
      totalUsers: await User.countDocuments({ isActive: true }),
      recentRegistrations,
      activeUsers
    };

    res.json(userStats);
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ message: 'Server error getting user statistics' });
  }
});

// @route   GET /api/users/search/suggestions
// @desc    Get user search suggestions (Admin/Faculty only)
// @access  Private (Admin/Faculty)
router.get('/search/suggestions', [
  auth,
  requireFaculty,
  query('q').trim().isLength({ min: 2 }).withMessage('Search query must be at least 2 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { q } = req.query;

    const suggestions = await User.find({
      isActive: true,
      $or: [
        { fullName: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { scholarNumber: { $regex: q, $options: 'i' } }
      ]
    })
    .select('fullName email scholarNumber department role')
    .limit(10)
    .sort({ fullName: 1 });

    res.json({ suggestions });
  } catch (error) {
    console.error('Get user suggestions error:', error);
    res.status(500).json({ message: 'Server error getting user suggestions' });
  }
});

// @route   POST /api/users/bulk/update-status
// @desc    Bulk update user status (Admin only)
// @access  Private (Admin)
router.post('/bulk/update-status', [
  auth,
  requireAdmin,
  body('userIds').isArray({ min: 1 }).withMessage('User IDs array is required'),
  body('isActive').isBoolean().withMessage('isActive must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userIds, isActive } = req.body;

    // Check if any of the users are admins (cannot deactivate admins)
    if (!isActive) {
      const adminUsers = await User.find({
        _id: { $in: userIds },
        role: 'admin'
      });

      if (adminUsers.length > 0) {
        return res.status(400).json({ 
          message: 'Cannot deactivate admin accounts',
          adminUsers: adminUsers.map(u => ({ id: u._id, fullName: u.fullName }))
        });
      }
    }

    // Update users
    const result = await User.updateMany(
      { _id: { $in: userIds } },
      { $set: { isActive } }
    );

    res.json({
      message: `Successfully ${isActive ? 'activated' : 'deactivated'} ${result.modifiedCount} users`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Bulk update user status error:', error);
    res.status(500).json({ message: 'Server error updating user status' });
  }
});

module.exports = router;
