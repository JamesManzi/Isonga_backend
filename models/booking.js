const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
  productId: String,
  name: String,
  phone: String,
  date: String,
  message: String
});

module.exports = mongoose.model("Booking", bookingSchema);