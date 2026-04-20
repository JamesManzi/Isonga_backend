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
        // ✅ FIX: Added status here so items can be Accepted/Declined individually
        status: {
          type: String,
          enum: ["Pending", "Accepted", "Processing", "Shipped", "Delivered", "Cancelled"],
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

    // ✅ You can keep a top-level status for the overall order if you want,
    // but your logic currently relies on the item-level status.
    status: {
      type: String,
      enum: ["Pending", "Accepted", "Processing", "Shipped", "Delivered", "Cancelled"],
      default: "Pending"
    },
    seen: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", OrderSchema);