const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  shortDescription: {
    type: String,
    required: true,
    maxlength: 200
  },
  category: {
    type: String,
    required: true,
    enum: ['Technical', 'Cultural', 'Sports', 'Academic', 'Workshop', 'Seminar', 'Competition', 'Other']
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  venue: {
    type: String,
    required: true
  },
  maxParticipants: {
    type: Number,
    default: 0
  },
  currentParticipants: {
    type: Number,
    default: 0
  },
  registrationDeadline: {
    type: Date,
    required: true
  },
  image: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Past', 'Upcoming', 'Live'],
    default: 'Live'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Event details
  eventType: {
    type: String,
    enum: ['offline', 'online', 'hybrid'],
    default: 'offline'
  },
  onlineLink: String,
  meetingId: String,
  meetingPassword: String,
  // Event requirements
  requirements: [String],
  prerequisites: [String],
  materials: [String],
  // Event features
  hasQuiz: {
    type: Boolean,
    default: false
  },
  hasCertificate: {
    type: Boolean,
    default: false
  },
  hasPrize: {
    type: Boolean,
    default: false
  },
  prizeDetails: String,
  // Event management
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  organizers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  moderators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Participation tracking
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    registrationDate: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['registered', 'attended', 'completed', 'cancelled'],
      default: 'registered'
    },
    attendanceMarked: {
      type: Boolean,
      default: false
    },
    attendanceDate: Date,
    quizScore: Number,
    certificateIssued: {
      type: Boolean,
      default: false
    },
    certificateIssuedDate: Date
  }],
  // Event analytics
  views: {
    type: Number,
    default: 0
  },
  registrations: {
    type: Number,
    default: 0
  },
  attendance: {
    type: Number,
    default: 0
  },
  // Event feedback
  averageRating: {
    type: Number,
    default: 0
  },
  totalRatings: {
    type: Number,
    default: 0
  },
  // Event notifications
  notificationsSent: {
    type: Boolean,
    default: false
  },
  reminderSent: {
    type: Boolean,
    default: false
  },
  // Event tags for search
  tags: [String],
  // Event visibility
  isPublic: {
    type: Boolean,
    default: true
  },
  allowedDepartments: [String],
  allowedYears: [String],
  // Event cost
  isFree: {
    type: Boolean,
    default: true
  },
  cost: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'INR'
  }
}, {
  timestamps: true
});

// Indexes for better performance
eventSchema.index({ startDate: 1, status: 1 });
eventSchema.index({ category: 1, status: 1 });
eventSchema.index({ createdBy: 1 });
eventSchema.index({ tags: 1 });
eventSchema.index({ 'participants.userId': 1 });

// Virtual for event duration
eventSchema.virtual('duration').get(function() {
  if (this.startDate && this.endDate) {
    const diffTime = Math.abs(this.endDate - this.startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
  return 0;
});

// Virtual for registration status
eventSchema.virtual('isRegistrationOpen').get(function() {
  if (!this.registrationDeadline) return false;
  return new Date() < this.registrationDeadline && this.status === 'Live';
});

// Virtual for event status
eventSchema.virtual('eventStatus').get(function() {
  const now = new Date();
  if (this.status === 'Past') return 'Past';
  if (this.status === 'Upcoming') return 'Upcoming';
  if (this.status === 'Live') return 'Live';
  // Fallback: auto-detect based on dates if needed
  if (now < this.startDate) return 'Live';
  if (now >= this.startDate && now <= this.endDate) return 'Upcoming';
  if (now > this.endDate) return 'Past';
  return 'unknown';
});

// Method to check if user can register
eventSchema.methods.canUserRegister = function(userId) {
  // Check if user is already registered
  const existingParticipant = this.participants.find(p => p.userId.toString() === userId.toString());
  if (existingParticipant) return false;
  
  // Check if registration is open
  if (!this.isRegistrationOpen) return false;
  
  // Check if event is full
  if (this.maxParticipants > 0 && this.currentParticipants >= this.maxParticipants) return false;
  
  return true;
};

// Method to register user for event
eventSchema.methods.registerUser = function(userId) {
  if (!this.canUserRegister(userId)) {
    throw new Error('User cannot register for this event');
  }
  
  this.participants.push({
    userId,
    registrationDate: new Date(),
    status: 'registered'
  });
  
  this.currentParticipants++;
  this.registrations++;
  
  return this.save();
};

// Method to mark attendance
eventSchema.methods.markAttendance = function(userId) {
  const participant = this.participants.find(p => p.userId.toString() === userId.toString());
  if (!participant) {
    throw new Error('User is not registered for this event');
  }
  
  participant.attendanceMarked = true;
  participant.attendanceDate = new Date();
  participant.status = 'attended';
  this.attendance++;
  
  return this.save();
};

// Method to update event status
eventSchema.methods.updateStatus = function(newStatus) {
  this.status = newStatus;
  return this.save();
};

// Method to get event statistics
eventSchema.methods.getStatistics = function() {
  return {
    totalRegistrations: this.registrations,
    totalAttendance: this.attendance,
    attendanceRate: this.registrations > 0 ? (this.attendance / this.registrations * 100).toFixed(2) : 0,
    views: this.views,
    averageRating: this.averageRating,
    totalRatings: this.totalRatings
  };
};

// Static method to find events by status
eventSchema.statics.findByStatus = function(status) {
  return this.find({ status, isActive: true });
};

// Static method to find upcoming events
eventSchema.statics.findUpcoming = function() {
  const now = new Date();
  return this.find({
    startDate: { $gt: now },
    status: 'Upcoming',
    isActive: true
  }).sort({ startDate: 1 });
};

// Static method to find ongoing events
eventSchema.statics.findOngoing = function() {
  const now = new Date();
  return this.find({
    startDate: { $lte: now },
    endDate: { $gte: now },
    status: 'Live',
    isActive: true
  });
};

// Static method to find completed events
eventSchema.statics.findCompleted = function() {
  const now = new Date();
  return this.find({
    endDate: { $lt: now },
    status: 'Past',
    isActive: true
  }).sort({ endDate: -1 });
};

// Static method to find events by category
eventSchema.statics.findByCategory = function(category) {
  return this.find({ category, status: 'Live', isActive: true });
};

// Static method to find events by creator
eventSchema.statics.findByCreator = function(creatorId) {
  return this.find({ createdBy: creatorId, isActive: true });
};

// Static method to search events
eventSchema.statics.search = function(query) {
  const searchRegex = new RegExp(query, 'i');
  return this.find({
    $or: [
      { title: searchRegex },
      { description: searchRegex },
      { tags: searchRegex },
      { category: searchRegex }
    ],
    status: 'Live',
    isActive: true
  });
};

module.exports = mongoose.model('Event', eventSchema);
