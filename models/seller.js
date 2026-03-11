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
    category: { type: String, required: true }
});

// ✅ Add a text index for full-text search
sellerSchema.index({ name: "text", category: "text", location: "text", description: "text" });

module.exports = mongoose.model("Seller", sellerSchema);