const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    room: {
      type: String,
      required: true,
      unique: true,
    },

    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Buyer",
      required: true,
    },

    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
    },

    lastMessage: {
      type: String,
      default: "",
    },

    unreadCount: {
      type: Number,
      default: 0,
    },

    deletedFor: {
      type: [mongoose.Schema.Types.ObjectId],
      default: []   //  CRITICAL FIX
    }

  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Conversation", conversationSchema);