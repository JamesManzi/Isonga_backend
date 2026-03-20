const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
  // Reference to the User/Buyer who made the booking
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Buyer",
    required: true
  },
  // Reference to the Seller providing the service
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Seller",
    required: true
  },
  // Reference to the specific Service (Product) being booked
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true
  },
  date: {
    type: String, // You can use Date type, but String matches your frontend input type="date"
    required: true
  },
  time: {
    type: String, // Matches frontend input type="time"
    required: true
  },
  message: {
    type: String,
    trim: true
  },
  status: {
      type: String,
     enum: ["Pending", "Accepted", "Processing", "Shipped", "Delivered", "Cancelled"],
      default: "Pending"
    },
    seen: {
  type: Boolean,
  default: false
},
  paymentMethod: { type: String, enum: ["cash", "mobile", "card"], required: true },
paymentScreenshot: { type: String }, // store Cloudinary URL or file path
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Booking", bookingSchema);