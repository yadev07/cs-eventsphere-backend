const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['admin', 'faculty', 'participant'],
    default: 'participant'
  },
  scholarNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  department: {
    type: String,
    required: true
  },
  year: {
    type: String,
    enum: ['1st', '2nd', '3rd', '4th', 'Masters 1st', 'Masters 2nd']
  },
  semester: {
    type: String,
    enum: ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']
  },
  dateOfBirth: {
    type: Date
  },
  age: {
    type: Number
  },
  phoneNumber: {
    type: String
  },
  interests: [{
    type: String,
    trim: true
  }],
  profileImage: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  lastLogin: {
    type: Date,
    default: Date.now
  },
  // Role-based permissions
  permissions: {
    canCreateEvents: {
      type: Boolean,
      default: false
    },
    canManageUsers: {
      type: Boolean,
      default: false
    },
    canManageFaculty: {
      type: Boolean,
      default: false
    },
    canViewAnalytics: {
      type: Boolean,
      default: false
    },
    canManageFeedback: {
      type: Boolean,
      default: false
    }
  },
  // Event participation tracking
  participatedEvents: [{
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event'
    },
    participationDate: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['registered', 'attended', 'completed', 'cancelled'],
      default: 'registered'
    },
    feedback: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Feedback'
    }
  }],
  // Support tickets
  supportTickets: [{
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SupportTicket'
    },
    status: {
      type: String,
      enum: ['open', 'in-progress', 'resolved', 'closed'],
      default: 'open'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Pre-save middleware to hash password and calculate age
userSchema.pre('save', async function(next) {
  try {
    // Hash password if modified
    if (this.isModified('password')) {
      this.password = await bcrypt.hash(this.password, 12);
    }
    
    // Set permissions based on role
    this.setRolePermissions();
    
    // Calculate age if dateOfBirth is present
    if (this.dateOfBirth && this.isModified('dateOfBirth')) {
      try {
        const today = new Date();
        const birthDate = new Date(this.dateOfBirth);
        
        if (isNaN(birthDate.getTime())) {
          throw new Error('Invalid date of birth');
        }
        
        this.age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          this.age--;
        }
      } catch (dateError) {
        console.error('Date parsing error:', dateError);
        // Don't fail the save, just skip age calculation
      }
    }
    
    next();
  } catch (error) {
    console.error('Pre-save middleware error:', error);
    next(error);
  }
});

// Method to set role-based permissions
userSchema.methods.setRolePermissions = function() {
  switch (this.role) {
    case 'admin':
      this.permissions = {
        canCreateEvents: true,
        canManageUsers: true,
        canManageFaculty: true,
        canViewAnalytics: true,
        canManageFeedback: true
      };
      break;
    case 'faculty':
      this.permissions = {
        canCreateEvents: true,
        canManageUsers: false,
        canManageFaculty: false,
        canViewAnalytics: true,
        canManageFeedback: true
      };
      break;
    case 'coordinator':
      this.permissions = {
        canCreateEvents: true,
        canManageUsers: false,
        canManageFaculty: false,
        canViewAnalytics: false,
        canManageFeedback: false
      };
      break;
    case 'participant':
    default:
      this.permissions = {
        canCreateEvents: false,
        canManageUsers: false,
        canManageFaculty: false,
        canViewAnalytics: false,
        canManageFeedback: false
      };
      break;
  }
};

// Method to check if user has specific permission
userSchema.methods.hasPermission = function(permission) {
  return this.permissions[permission] || false;
};

// Method to check if user can perform action
userSchema.methods.can = function(action) {
  const permissionMap = {
    'create:events': 'canCreateEvents',
    'manage:users': 'canManageUsers',
    'manage:faculty': 'canManageFaculty',
    'view:analytics': 'canViewAnalytics',
    'manage:feedback': 'canManageFeedback'
  };
  
  return this.hasPermission(permissionMap[action]) || false;
};

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to get public profile
userSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.emailVerificationToken;
  delete userObject.emailVerificationExpires;
  delete userObject.passwordResetToken;
  delete userObject.passwordResetExpires;
  return userObject;
};

// Method to get admin profile (includes permissions)
userSchema.methods.getAdminProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.emailVerificationToken;
  delete userObject.emailVerificationExpires;
  delete userObject.passwordResetToken;
  delete userObject.passwordResetExpires;
  return userObject;
};

// Static method to find users by role
userSchema.statics.findByRole = function(role) {
  return this.find({ role, isActive: true });
};

// Static method to find users with specific permission
userSchema.statics.findByPermission = function(permission) {
  return this.find({ [`permissions.${permission}`]: true, isActive: true });
};

module.exports = mongoose.model('User', userSchema);
