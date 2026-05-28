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
          min: 1
        },
        price: {
          type: Number,
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
      default: ""
    },

    deliveryDate: {
      type: Date
    },

   
    paymentMethod: {
      type: String,
      enum: ["cash", "mobile"],
      default: ""
    },

   
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