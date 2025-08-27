const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to authenticate user
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token. User not found.'
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account is deactivated. Please contact administrator.'
        });
      }

      req.user = user;
      req.token = token;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please login again.'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during authentication'
    });
  }
};

// Middleware to require admin role
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    next();
  } catch (error) {
    console.error('Require admin middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error checking admin access'
    });
  }
};

// Middleware to require faculty role
const requireFaculty = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!['admin', 'faculty'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Faculty or admin access required'
      });
    }

    next();
  } catch (error) {
    console.error('Require faculty middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error checking faculty access'
    });
  }
};

// Middleware to require coordinator role
const requireCoordinator = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!['admin', 'faculty', 'coordinator'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Coordinator, faculty, or admin access required'
      });
    }

    next();
  } catch (error) {
    console.error('Require coordinator middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error checking coordinator access'
    });
  }
};

// Middleware to check specific permission
const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (!req.user.can(permission)) {
        return res.status(403).json({
          success: false,
          message: `Permission denied. ${permission} access required.`
        });
      }

      next();
    } catch (error) {
      console.error('Require permission middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error checking permissions'
      });
    }
  };
};

// Middleware to check if user owns resource or has admin access
const requireOwnershipOrAdmin = (resourceModel, resourceIdField = 'id') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Admin can access everything
      if (req.user.role === 'admin') {
        return next();
      }

      const resourceId = req.params[resourceIdField];
      if (!resourceId) {
        return res.status(400).json({
          success: false,
          message: 'Resource ID required'
        });
      }

      const resource = await resourceModel.findById(resourceId);
      if (!resource) {
        return res.status(404).json({
          success: false,
          message: 'Resource not found'
        });
      }

      // Check if user owns the resource
      if (resource.createdBy && resource.createdBy.toString() === req.user._id.toString()) {
        return next();
      }

      // Check if user is organizer or moderator
      if (resource.organizers && resource.organizers.includes(req.user._id)) {
        return next();
      }

      if (resource.moderators && resource.moderators.includes(req.user._id)) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not own this resource.'
      });
    } catch (error) {
      console.error('Ownership check middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error checking resource ownership'
      });
    }
  };
};

// Middleware to check if user can participate in event
const canParticipateInEvent = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { eventId } = req.params;
    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: 'Event ID required'
      });
    }

    const Event = require('../models/Event');
    const event = await Event.findById(eventId);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if user can register for this event
    if (!event.canUserRegister(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot register for this event'
      });
    }

    req.event = event;
    next();
  } catch (error) {
    console.error('Can participate middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error checking event participation'
    });
  }
};

// Middleware to check if user is registered for event
const isRegisteredForEvent = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { eventId } = req.params;
    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: 'Event ID required'
      });
    }

    const Event = require('../models/Event');
    const event = await Event.findById(eventId);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if user is registered
    const participant = event.participants.find(p => p.userId.toString() === req.user._id.toString());
    if (!participant) {
      return res.status(400).json({
        success: false,
        message: 'You are not registered for this event'
      });
    }

    req.event = event;
    req.participant = participant;
    next();
  } catch (error) {
    console.error('Is registered middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error checking event registration'
    });
  }
};

// Middleware to rate limit requests
const rateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    
    if (!requests.has(ip)) {
      requests.set(ip, { count: 1, resetTime: now + windowMs });
    } else {
      const userRequests = requests.get(ip);
      
      if (now > userRequests.resetTime) {
        userRequests.count = 1;
        userRequests.resetTime = now + windowMs;
      } else if (userRequests.count >= maxRequests) {
        return res.status(429).json({
          success: false,
          message: 'Too many requests. Please try again later.'
        });
      } else {
        userRequests.count++;
      }
    }
    
    next();
  };
};

module.exports = {
  auth,
  requireAdmin,
  requireFaculty,
  requireCoordinator,
  requirePermission,
  requireOwnershipOrAdmin,
  canParticipateInEvent,
  isRegisteredForEvent,
  rateLimit
};
