const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  recipient: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Buyer', 
    required: true 
  },

  sender: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Seller',   // MUST match your Seller model name
    required: true 
  },

  message: { 
    type: String, 
    required: true 
  },

  orderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Order' 
  },
  bookingId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Booking'   //  ADD THIS
  },
  read: { 
    type: Boolean, 
    default: false 
  },

  category: {
    type: String,
    enum: ["Order", "Booking"]  //  IMPORTANT (prevents bugs)
  }

}, { timestamps: true }); //  replaces createdAt manually

module.exports = mongoose.model("Notification", notificationSchema);