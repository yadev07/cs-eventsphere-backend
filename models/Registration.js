const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
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
  registrationType: {
    type: String,
    enum: ['participant', 'coordinator'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'rejected', 'cancelled'],
    default: 'pending'
  },
  registrationDate: {
    type: Date,
    default: Date.now
  },
  attended: {
    type: Boolean,
    default: false
  },
  attendanceDate: {
    type: Date
  },
  feedback: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Feedback'
  },
  notes: {
    type: String,
    trim: true
  },
  coordinatorNotes: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for better query performance
registrationSchema.index({ event: 1, participant: 1 }, { unique: true });
registrationSchema.index({ status: 1, registrationDate: 1 });
registrationSchema.index({ participant: 1, status: 1 });

// Pre-save middleware to check duplicate registrations
registrationSchema.pre('save', async function(next) {
  if (this.isNew) {
    const existingRegistration = await this.constructor.findOne({
      event: this.event,
      participant: this.participant
    });
    
    if (existingRegistration) {
      throw new Error('User already registered for this event');
    }
  }
  next();
});

// Method to check if registration is valid
registrationSchema.methods.isValid = function() {
  return this.status === 'confirmed' && this.isActive;
};

module.exports = mongoose.model('Registration', registrationSchema);
