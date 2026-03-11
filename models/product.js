const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Seller",
    index: true
  },
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  files: [
    {
      type: String,
      required: true
    }
  ],
  category: {
    type: String,
    required: true,
    enum: [
      "Agriculture", "Services", "Electronics", "Fashion", "Real Estate",
      "Vehicles", "Hospitality", "Furniture", "Construction"
    ],
    index: true
  },
  description: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },

  // --- VIEW TRACKING FIELDS ---
  dailyViews: [
    {
      // Using a Date object set to midnight for easy comparison
      date: { type: Date, default: () => new Date().setHours(0, 0, 0, 0) },
      buyers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Buyer" }]
    }
  ],
  // Optional: Keep track of every unique buyer who ever saw the product
  uniqueBuyers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Buyer" }],
  // The "Display" count shown on the dashboard
  views: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model("Product", productSchema);