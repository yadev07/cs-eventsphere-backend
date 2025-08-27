const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth, requireAdmin, requireFaculty } = require('../middleware/auth');
const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// @route   POST /api/auth/create-account
// @desc    Create any type of account (Admin only)
// @access  Private (Admin)
router.post('/create-account', [
  auth,
  requireAdmin,
  body('fullName').trim().isLength({ min: 2 }).withMessage('Full name must be at least 2 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('department').trim().notEmpty().withMessage('Department is required'),
  body('role').isIn(['admin', 'faculty', 'participant', 'coordinator']).withMessage('Invalid role'),
  body('year').optional().isIn(['1st', '2nd', '3rd', '4th', 'Masters 1st', 'Masters 2nd']).withMessage('Invalid year'),
  body('semester').optional().isIn(['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']).withMessage('Invalid semester'),
  body('dateOfBirth').optional().isISO8601().withMessage('Valid date of birth required'),
  body('phoneNumber').optional().trim().notEmpty().withMessage('Phone number cannot be empty'),
  body('scholarNumber').optional().trim().notEmpty().withMessage('Scholar number cannot be empty'),
  body('interests').optional().isArray().withMessage('Interests must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { 
      email, 
      scholarNumber, 
      fullName, 
      password, 
      department, 
      role, 
      year, 
      semester, 
      dateOfBirth, 
      phoneNumber, 
      interests 
    } = req.body;

    // Validate required fields based on role
    if (role === 'participant' || role === 'coordinator') {
      if (!year || !semester || !dateOfBirth || !phoneNumber || !scholarNumber) {
        return res.status(400).json({
          success: false,
          message: 'Year, semester, date of birth, phone number, and scholar number are required for participants and coordinators'
        });
      }
    }

    // Check for duplicate user
    const existingUser = await User.findOne({
      $or: [{ email }, { scholarNumber }]
    });

    if (existingUser) {
      let messages = [];
      if (existingUser.email === email) messages.push("Email already registered");
      if (existingUser.scholarNumber === scholarNumber) messages.push("Scholar number already registered");

      return res.status(400).json({
        success: false,
        message: messages.join(" & ")
      });
    }

    // Create user data based on role
    const userData = {
      fullName,
      email,
      password,
      department,
      role,
      isEmailVerified: true, // Admin-created accounts are pre-verified
      isActive: true
    };

    // Add conditional fields based on role
    if (role === 'participant' || role === 'coordinator') {
      userData.year = year;
      userData.semester = semester;
      userData.dateOfBirth = dateOfBirth;
      userData.phoneNumber = phoneNumber;
      userData.scholarNumber = scholarNumber;
      if (interests) {
        userData.interests = interests;
      }
    }

    const user = new User(userData);
    await user.save();

    res.status(201).json({
      success: true,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully`,
      user: user.getPublicProfile()
    });

  } catch (error) {
    console.error('Create account error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error creating account' 
    });
  }
});

// @route   POST /api/auth/create-user
// @desc    Create user account (Faculty/Admin only)
// @access  Private (Faculty/Admin)
router.post('/create-user', [
  auth,
  requireFaculty,
  body('fullName').trim().isLength({ min: 2 }).withMessage('Full name must be at least 2 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('department').trim().notEmpty().withMessage('Department is required'),
  body('role').isIn(['participant', 'coordinator']).withMessage('Invalid role'),
  body('year').notEmpty().withMessage('Year is required'),
  body('semester').notEmpty().withMessage('Semester is required'),
  body('dateOfBirth').notEmpty().withMessage('Date of birth is required'),
  body('phoneNumber').notEmpty().withMessage('Phone number is required'),
  body('scholarNumber').notEmpty().withMessage('Scholar number is required')
], async (req, res) => {
  try {
    // Allow faculty and admin to create users
    if (req.user.role !== 'faculty' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to create users'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, scholarNumber, fullName, password, department, role, year, semester, dateOfBirth, phoneNumber, interests } = req.body;

    // Check for duplicate user
    const existingUser = await User.findOne({
      $or: [{ email }, { scholarNumber }]
    });

    if (existingUser) {
      let messages = [];
      if (existingUser.email === email) messages.push("Email already registered");
      if (existingUser.scholarNumber === scholarNumber) messages.push("Scholar number already registered");

      return res.status(400).json({
        success: false,
        message: messages.join(" & ")
      });
    }

    // Create new user
    const userData = {
      fullName,
      email,
      password,
      department,
      role,
      year,
      semester,
      dateOfBirth,
      phoneNumber,
      scholarNumber,
      interests: interests || [],
      isEmailVerified: true // Faculty-created accounts are pre-verified
    };

    const user = new User(userData);
    await user.save();

    res.status(201).json({
      success: true,
      message: "User account created successfully",
      user: user.getPublicProfile()
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error creating user account' 
    });
  }
});

// @route   POST /api/auth/create-faculty
// @desc    Create faculty account (Admin only)
// @access  Private (Admin)
router.post('/create-faculty', [
  auth,
  requireAdmin,
  body('fullName').trim().isLength({ min: 2 }).withMessage('Full name must be at least 2 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('department').trim().notEmpty().withMessage('Department is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const { email } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: 'Email already registered' 
      });
    }

    // Create faculty user
    const facultyData = {
      ...req.body,
      role: 'faculty',
      isActive: true,
      isEmailVerified: true
    };

    const user = new User(facultyData);
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Faculty account created successfully',
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Create faculty error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error creating faculty account' 
    });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').exists().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(400).json({ 
        success: false,
        message: 'Account is deactivated' 
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during login' 
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error getting profile' 
    });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', [
  auth,
  body('fullName').optional().trim().isLength({ min: 2 }).withMessage('Full name must be at least 2 characters'),
  body('phoneNumber').optional().trim().notEmpty().withMessage('Phone number cannot be empty'),
  body('interests').optional().isArray().withMessage('Interests must be an array'),
  body('bio').optional().isString().trim().isLength({ max: 1000 }).withMessage('Bio must be a string up to 1000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const updates = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Strictly allow only interests and bio to be updated for students (participant)
    if (user.role === 'participant') {
      const allowedFields = ['interests', 'bio'];
      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          user[key] = updates[key];
        }
        // Ignore all other fields, including email, dateOfBirth, scholarNumber, etc.
      });
    } else {
      // Other roles can update as before
      Object.keys(updates).forEach(key => {
        if (key !== 'password' && key !== 'role' && key !== 'email') {
          user[key] = updates[key];
        }
      });
    }

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error updating profile' 
    });
  }
});

// @route   POST /api/auth/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password', [
  auth,
  body('currentPassword').exists().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error changing password' 
    });
  }
});

// @route   GET /api/auth/users
// @desc    Get all users (Admin/Faculty only)
// @access  Private (Admin/Faculty)
router.get('/users', auth, async (req, res) => {
  try {
    // Check permissions
    if (!req.user.can('manage:users') && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view users'
      });
    }

    const { role, department, page = 1, limit = 10, search } = req.query;
    const skip = (page - 1) * limit;

    let query = { isActive: true };

    if (role) query.role = role;
    if (department) query.department = department;
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { scholarNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalUsers: total,
        usersPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting users'
    });
  }
});

// @route   PUT /api/auth/users/:id
// @desc    Update user (Admin/Faculty only)
// @access  Private (Admin/Faculty)
router.put('/users/:id', [
  auth,
  body('isActive').optional().isBoolean(),
  body('role').optional().isIn(['admin', 'faculty', 'participant', 'coordinator'])
], async (req, res) => {
  try {
    // Check permissions
    if (!req.user.can('manage:users') && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update users'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const updates = req.body;

    // Prevent role escalation (only admin can make other users admin)
    if (updates.role === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can assign admin role'
      });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating user'
    });
  }
});

// @route   DELETE /api/auth/users/:id
// @desc    Deactivate user (Admin only)
// @access  Private (Admin)
router.delete('/users/:id', auth, async (req, res) => {
  try {
    // Only admin can deactivate users
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can deactivate users'
      });
    }

    const { id } = req.params;

    // Prevent admin from deactivating themselves
    if (id === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate your own account'
      });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User deactivated successfully'
    });
  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deactivating user'
    });
  }
});

module.exports = router;
