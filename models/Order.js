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

        // ✅ NEW: status per seller (CRITICAL FIX)
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

    // 👤 Customer Info
    name: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    address: {
      type: String,
      required: true,
      trim: true
    },
    // 📝 Customer Message
notes: {
  type: String,
  trim: true,
  default: ""
},
    // 🚚 Delivery
    deliveryMethod: {
      type: String,
      enum: ["standard", "express", "pickup"],
      default: "standard"
    },

    deliveryDate: {
      type: Date
    },

    // 💳 Payment
    paymentMethod: {
      type: String,
      enum: ["cash", "mobile", "card"],
      default: "cash"
    },

    // ✅ IMPROVED: payment proof per seller
    paymentProofsBySeller: {
      type: Map,
      of: String, // sellerId => image path
      default: {}
    },
   
    seen: {
      type: Boolean,
      default: false
    },

  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", OrderSchema);