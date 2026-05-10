const mongoose = require("mongoose");

const sellerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    profile: { type: String, required: true },
    location: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    files: [{ type: String, required: true }],
    password: { type: String, required: true },
    description: { type: String, required: true },
     isVerified: {
       type: Boolean,
        default: false 
      },
      failedAttempts:{
        type:Number,
        default:0
      },
      lockUntil:{
        type:Date,
        default:null
      },
      lastVerificationSent:{
        type:Date,
        default:null
      },
verificationCode: String,
verificationExpires: Date,
    category: { type: String, required: true },
      sellerType:{
       type: String,
        enum: ["Product", "Service", "Asset"],
        required: true
    },
    views: { type: Number, default: 0 }, // Total store visits ever
  dailyViews: [
    {
      date: { type: Date, default: () => new Date().setHours(0, 0, 0, 0) },
      buyers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Buyer" }]
    }
  ]
});
//  Add a text index for full-text search
sellerSchema.index({ name: "text", category: "text", location: "text", description: "text" });

module.exports = mongoose.model("Seller", sellerSchema);