const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema({
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Seller"
  },
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Buyer"
  },
  rating: Number,
  comment: String,
  sellerReply: {
    type: String,
    default: ""
  }
}, { timestamps: true });

module.exports = mongoose.model("Rating", ratingSchema);