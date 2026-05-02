const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema(
  {
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Buyer",
      required: true
    },

    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true
        },
        seller: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Seller",
          required: true
        },
        quantity: {
          type: Number,
          required: true,
          min: 1
        },
        price: {
          type: Number,
          required: true,
          min: 0
        },
        // Moved status here so each seller can accept/decline their own items
        status: {
          type: String,
          enum: ["Pending", "Accepted", "Cancelled"],
          default: "Pending"
        }
      }
    ],

    totalPrice: {
      type: Number,
      required: true,
      min: 0
    },

    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },

    deliveryMethod: {
      type: String,
      enum: ["standard", "express", "pickup"],
      default: "standard"
    },

    deliveryDate: { type: Date },

    paymentMethod: {
      type: String,
      enum: ["cash", "mobile", "card"],
      default: "cash"
    },

    paymentProof: { type: String, default: "" },
    notes: { type: String, default: "" },
    seen: { type: Boolean, default: false }
    // Global status removed from here
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", OrderSchema);