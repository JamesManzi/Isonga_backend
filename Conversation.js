const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    room: { type: String, required: true, unique: true },

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

    lastMessage: { type: String, default: "" },
    updatedAt: { type: Date, default: Date.now },

    unreadCount: {
      type: Number,
      default: 0,
    },

    // 👇 KEY FIX: per-user deletion
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        refPath: "deletedModel",
      },
    ],

    deletedModel: {
      type: String,
      enum: ["Buyer", "Seller"],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Conversation", conversationSchema);