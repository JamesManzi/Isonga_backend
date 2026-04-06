const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "senderModel",
      required: true
    },

    senderModel: {
      type: String,
      required: true,
      enum: ["Buyer", "Seller"]
    },

    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "receiverModel",
      required: true
    },

    receiverModel: {
      type: String,
      required: true,
      enum: ["Buyer", "Seller"]
    },

    room: {
      type: String,
      required: true
    },

    message: {
      type: String,
      default: ""
    },

    read: {
      type: Boolean,
      default: false
    },

    files: [
      {
        type: String
      }
    ],
     deletedFor: [{ type: mongoose.Schema.Types.ObjectId }],
  deletedForEveryone: { type: Boolean, default: false },
    // --- MOVE THESE INSIDE THE MAIN BRACES ---
    replyTo: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Message", 
      default: null 
    },
    
    productId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Product", 
      default: null 
    }
  }, 
  { timestamps: true } // Options go here in their own object
);

module.exports = mongoose.model("Message", messageSchema);