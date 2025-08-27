const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  participant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  registration: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Registration',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comments: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  categories: {
    content: {
      type: Number,
      min: 1,
      max: 5,
      required: true
    },
    organization: {
      type: Number,
      min: 1,
      max: 5,
      required: true
    },
    venue: {
      type: Number,
      min: 1,
      max: 5,
      required: true
    },
    overall: {
      type: Number,
      min: 1,
      max: 5,
      required: true
    }
  },
  suggestions: {
    type: String,
    trim: true,
    maxlength: 500
  },
  isAnonymous: {
    type: Boolean,
    default: false
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  adminNotes: {
    type: String,
    trim: true
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for better query performance
feedbackSchema.index({ event: 1, participant: 1 }, { unique: true });
feedbackSchema.index({ rating: 1, submittedAt: 1 });
feedbackSchema.index({ isPublic: 1, isApproved: 1 });

// Virtual for average category rating
feedbackSchema.virtual('averageCategoryRating').get(function() {
  const categories = this.categories;
  const sum = categories.content + categories.organization + categories.venue + categories.overall;
  return (sum / 4).toFixed(1);
});

// Method to check if feedback is valid
feedbackSchema.methods.isValid = function() {
  return this.isApproved && this.isPublic;
};

// Pre-save middleware to ensure one feedback per participant per event
feedbackSchema.pre('save', async function(next) {
  if (this.isNew) {
    const existingFeedback = await this.constructor.findOne({
      event: this.event,
      participant: this.participant
    });
    
    if (existingFeedback) {
      throw new Error('Participant already provided feedback for this event');
    }
  }
  next();
});

module.exports = mongoose.model('Feedback', feedbackSchema);
