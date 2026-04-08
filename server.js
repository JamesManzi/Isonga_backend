const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const multer = require("multer");
require("dotenv").config();
const Seller = require("./models/seller");
const Buyer = require("./models/buyer");
const Product = require("./models/product");
const Rating = require("./models/Rating");
const Message = require("./models/Message");
const Cart = require("./models/Cart");
const Order = require("./models/Order");
const path = require("path");
const Booking = require("./models/booking");
const jwt = require("jsonwebtoken");
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const Notification = require("./models/Notification");
const rateLimit = require("express-rate-limit");
const Conversation = require("./models/Conversation");
// Creating App
const app = express();

app.set("trust proxy", 1);


const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : [];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS not allowed"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
  optionsSuccessStatus: 204,
  maxAge: 600
}));

// Define How Data Are Sent
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Login limiter (define FIRST)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts

  message: {
    success: false,
    message: "Too many login attempts, please try again after 15 minutes"
  },

  standardHeaders: true,
  legacyHeaders: false,

  //  Better: limit by email + IP (not just IP)
  keyGenerator: (req) => {
    return (req.body.email || "unknown") + "-" + req.ip;
  },
});
app.use('/api/login', loginLimiter);
app.use('/api/buyer_login', loginLimiter);
// Store Uploads
const { upload } = require('./cloudinary');

const auth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Attach the user info to the request object
    req.userId = decoded.id;
    req.role = decoded.role;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Session expired or invalid token" });
  }
};
// Database Connection
mongoose.connect(process.env.MONGO_URL)
  .then(async () => {
    console.log(" Database Connected");
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("Collections in DB:", collections.map(c => c.name));
  })
  .catch((error) => console.log(" DB connection error:", error));
// Seller Register with Email Verification
app.post("/api/register", upload.fields([
  { name: "profile", maxCount: 1 },
  { name: "files", maxCount: 5 }
]), async (req, res) => {
  try {
    const { name, location, phone, email, password, description, category, sellerType } = req.body;

    // 1. Basic Checks
    const existingSeller = await Seller.findOne({ email });
    if (existingSeller) return res.json({ success: false, message: "User Already Exists" });

    if (!req.files || !req.files.profile) {
      return res.status(400).json({ success: false, message: "Profile image required" });
    }
    if (!req.files || !req.files.files) {
      return res.status(400).json({ success: false, message: "Location Images Required" })
    }
    // 2. Prepare Data
    const hash = await bcrypt.hash(password, 12);
    const profile = req.files.profile[0].path;
    const files = req.files.files ? req.files.files.map(f => f.path) : [];

    // 3. Generate 6-Digit Code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    console.log(`📧 Sending Seller Verification to: ${email}`);

    // 4. Send Email via Resend
    const { data, error } = await resend.emails.send({
      from: 'Isonga Market <onboarding@resend.dev>',
      to: email,
      subject: 'Verify your Isonga Seller Account',
      html: `
                <div style="font-family: sans-serif; padding: 20px;">
                    <h1 style="color: #2563eb;">Welcome to Isonga Market, ${name}!</h1>
                    <p>To start selling, please verify your email using this code:</p>
                    <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1e293b; padding: 10px; background: #f1f5f9; display: inline-block;">
                        ${code}
                    </div>
                    <p>This code expires in 10 minutes.</p>
                </div>
            `
    });
    console.log(" API Email sent:", data.id);
    if (error) {
      console.error("❌ Resend Error:", error);
      return res.status(500).json({ success: false, message: "Email service failed" });
    }

    // 5. Create Seller (Unverified)
    await Seller.create({
      name,
      profile,
      location,
      phone,
      email,
      files,
      password: hash,
      description,
      category,
      sellerType,
      isVerified: false, // Must verify first
      verificationCode: code,
      verificationExpires: Date.now() + 10 * 60 * 1000
    });

    res.json({
      success: true,
      message: "Verification code sent to your email",
      email
    });

  } catch (error) {
    console.error("Seller Register error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await Seller.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "Invalid Credentials" });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.json({ success: false, message: "Invalid Credentials" });
    }

    //  CREATE TOKEN
    const token = jwt.sign(
      { id: user._id, role: "seller" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );


    res.json({
      success: true,
      token,
      seller: {
        id: user._id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: "Login Error" });
  }
});

app.post("/api/buyer_register", upload.single("profile"), async (req, res) => {
  try {
    const { name, email, password, repeat_pass } = req.body;

    const ExistingBuyer = await Buyer.findOne({ email });
    if (ExistingBuyer) {
      return res.json({ success: false, message: "User Already Exist" });
    }

    // ... Keep your password regex and hashing logic here ...
    const hashed = await bcrypt.hash(password, 12);
    let profile = req.file ? req.file.path : "";
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    console.log("📧 Sending via Resend API to:", email);

    // SEND EMAIL USING API (NOT SMTP)
    const { data, error } = await resend.emails.send({
      from: 'Isonga Market <onboarding@resend.dev>', // Use this default sender for testing
      to: email,
      subject: 'Verify your Isonga Market Account',
      html: `<strong>Welcome ${name}!</strong><p>Your verification code is: <b>${code}</b></p>`
    });

    if (error) {
      console.error("❌ Resend Error:", error);
      return res.status(500).json({ success: false, message: "Email failed" });
    }

    console.log(" API Email sent:", data.id);

    // SAVE TO DATABASE
    await Buyer.create({
      name,
      email,
      password: hashed,
      profile,
      verificationCode: code,
      verificationExpires: Date.now() + 10 * 60 * 1000
    });

    return res.json({
      success: true,
      message: "Verification code sent to email",
      email
    });

  } catch (error) {
    console.error("🔥 REGISTER ERROR:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
});

app.post("/api/resend-verification", async (req, res) => {
  try {
    const { email, userType } = req.body;

    // 🔴 Validate input
    if (!email || !userType) {
      return res.status(400).json({
        success: false,
        message: "Email and user type are required"
      });
    }

    console.log("Resend request:", { email, userType });

    // ✅ Choose correct model
    const Model = userType === "seller" ? Seller : Buyer;

    // 🔍 Find user
    const user = await Model.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // 🚫 Already verified
    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Account already verified. Please login."
      });
    }

    // 🔢 Generate new code
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();

    // 💾 Save new code
    user.verificationCode = newCode;
    user.verificationExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    console.log("New verification code:", newCode);

    // 📧 Send email
    const { data, error } = await resend.emails.send({
      from: "Isonga Market <onboarding@resend.dev>",
      to: email,
      subject: "Your New Verification Code",
      html: `
        <div style="font-family: sans-serif; border: 1px solid #e2e8f0; padding: 20px; border-radius: 10px;">
          <h2 style="color: #2563eb;">Isonga Market</h2>
          <p>Hello ${user.name || "User"},</p>
          <p>You requested a new verification code for your <strong>${userType}</strong> account.</p>
          
          <div style="font-size: 24px; font-weight: bold; background: #f1f5f9; display: inline-block; padding: 10px 20px; margin: 10px 0;">
            ${newCode}
          </div>

          <p style="color: #64748b; font-size: 14px;">
            This code will expire in 10 minutes and replaces any previous codes.
          </p>
        </div>
      `
    });

    // ❌ Email failed
    if (error) {
      console.error("Resend email error:", error);
      return res.status(500).json({
        success: false,
        message: "Email delivery failed"
      });
    }

    // ✅ Success
    return res.json({
      success: true,
      message: "New verification code sent successfully!"
    });

  } catch (error) {
    console.error("Resend route error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
});

app.post("/api/verify-email", async (req, res) => {
  try {
    const { email, code } = req.body;
    const inputCode = String(code).trim();

    // 1. Look for the user in both collections specifically for the code
    // This solves the issue if an email exists in both Buyer and Seller collections
    let user = await Buyer.findOne({ email, verificationCode: inputCode });
    let modelType = "Buyer";

    if (!user) {
      user = await Seller.findOne({ email, verificationCode: inputCode });
      modelType = "Seller";
    }

    // 2. If NO user in either collection has that code
    if (!user) {
      // DEBUG: Let's see what's actually in the DB for this email
      const bTest = await Buyer.findOne({ email });
      const sTest = await Seller.findOne({ email });

      console.log(`--- Verification Failed for ${email} ---`);
      console.log(`Input Code: ${inputCode}`);
      console.log(`Buyer Code in DB: ${bTest?.verificationCode || "None"}`);
      console.log(`Seller Code in DB: ${sTest?.verificationCode || "None"}`);

      return res.json({ success: false, message: "Invalid code" });
    }

    // 3. Check Expiry
    if (user.verificationExpires < Date.now()) {
      return res.json({ success: false, message: "Code expired" });
    }

    // 4. Success Logic - Update the specific document found
    user.isVerified = true;
    user.verificationCode = null;
    user.verificationExpires = null;
    await user.save();

    console.log(`✅ ${modelType} verified successfully: ${email}`);
    res.json({ success: true, message: `${modelType} verified successfully` });

  } catch (error) {
    console.error("🔥 Verify Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});


app.post("/api/buyer_login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await Buyer.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "Invalid Credentials" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.json({ success: false, message: "Invalid Credentials" });
    }

    const token = jwt.sign(
      { id: user._id, role: "buyer" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({
      success: true,
      token,
      buyer: {
        id: user._id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified
      }
    });

  } catch (error) {
    res.status(500).json({ success: false });
  }
});

app.post("/api/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    // 1. Find user in either collection
    let user = await Buyer.findOne({ email }) || await Seller.findOne({ email });

    if (!user) {
      return res.json({ success: false, message: "No account found with this email" });
    }

    // 2. Generate 6-digit reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    // 3. Save to DB with short expiry (e.g., 5 minutes)
    user.verificationCode = resetCode;
    user.verificationExpires = Date.now() + 5 * 60 * 1000;
    await user.save();

    // 4. Send Email
    await resend.emails.send({
      from: 'Isonga Market <onboarding@resend.dev>',
      to: email,
      subject: 'Reset your Isonga Market Password',
      html: `<h3>Password Reset Request</h3>
             <p>Use this code to reset your password: <b>${resetCode}</b></p>
             <p>This code expires in 5 minutes.</p>`
    });

    res.json({ success: true, message: "Reset code sent to your email" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error sending email" });
  }
});

app.post("/api/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    // 1. Find the user with that specific code
    let user = await Buyer.findOne({ email, verificationCode: code }) ||
      await Seller.findOne({ email, verificationCode: code });

    if (!user) {
      return res.json({ success: false, message: "Invalid or expired code" });
    }

    // 2. Check if code is expired
    if (user.verificationExpires < Date.now()) {
      return res.json({ success: false, message: "Code expired" });
    }

    // 3. Hash new password and save
    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);

    // 4. Clear reset fields so code can't be used again
    user.verificationCode = null;
    user.verificationExpires = null;
    await user.save();

    res.json({ success: true, message: "Password updated successfully!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Reset failed" });
  }
});

app.post("/api/verify-reset-code", async (req, res) => {
  const { email, code } = req.body;
  const user = await Buyer.findOne({ email, verificationCode: code }) ||
    await Seller.findOne({ email, verificationCode: code });

  if (!user || user.verificationExpires < Date.now()) {
    return res.json({ success: false, message: "Invalid code" });
  }
  res.json({ success: true }); // Move to step 3
});

app.post("/api/add_product", auth, upload.array("files", 10), auth, async (req, res) => {
  try {

    const { type, name, price, location, category, description, quantity } = req.body;

    let files = [];
    if (req.files.length > 10) {
      return res.json({ success: false, message: "Max Upload Must Be 10" });
    }
    if (req.files && req.files.length > 0) {
      files = req.files.map(file => file.path);
    }

    await Product.create({
      seller: req.userId,
      type,
      name,
      price,
      location,
      category,
      description,
      quantity,
      files
    });

    res.json({
      success: true,
      message: "Item Added Successfully"
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Add Item Error"
    });
  }
});

app.get("/api/dashboard", auth, async (req, res) => {
  try {
    const sellerId = req.userId;
    if (!sellerId) return res.json({ success: false, message: "Not Logged In" });

    const seller = await Seller.findById(sellerId);
    if (!seller) return res.json({ success: false, message: "Seller not found" });

    const totalItemsCount = await Product.countDocuments({
      seller: sellerId,
      type: seller.sellerType // Matches "Product", "Service", or "Asset"
    });

    // 1. Calculate Ratings
    const ratings = await Rating.find({ seller: sellerId });
    const numReviews = ratings.length;
    const averageRating = numReviews > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / numReviews
      : 0;

    // 2. Fetch Data based on Seller Type
    let totalActivityCount = 0;
    let newActivityCount = 0;

    if (seller.sellerType === "Service") {
      // COUNT BOOKINGS for Service Sellers
      totalActivityCount = await Booking.countDocuments({ seller: sellerId });
      newActivityCount = await Booking.countDocuments({ seller: sellerId, status: "Pending" });
    } else {
      // COUNT ORDERS for Product Sellers
      totalActivityCount = await Order.countDocuments({ "items.seller": sellerId });
      newActivityCount = await Order.countDocuments({ "items.seller": sellerId, status: "Pending" });
    }

    // 4. Get Views
    const totalViews = seller.views || 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayEntry = seller.dailyViews.find(
      d => new Date(d.date).getTime() === today.getTime()
    );

    const todayViews = todayEntry ? todayEntry.buyers.length : 0;

    // Current problematic part in your backend:
    res.json({
      success: true,
      seller: {
        ...seller.toObject(),
        totalOrders: totalActivityCount,
        newOrders: newActivityCount,
        // averageRating is being calculated, but let's make sure it's inside 'seller'
        averageRating: Number(averageRating.toFixed(1)),
        numReviews: numReviews,
        totalItemsCount: totalItemsCount
      },
      totalViews,
      todayViews
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Dashboard Internal Server Error" });
  }
});

app.get("/api/my_store", auth, async (req, res) => {
  try {

    const products = await Product.find({ seller: req.userId });
    const seller = await Seller.findById(req.userId).select("name");

    res.json({
      success: true,
      products,
      seller
    })
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "My Store Server Error" });
  }
})

app.get("/api/seller_profile", auth, async (req, res) => {
  try {

    // Get seller
    const seller = await Seller.findById(req.userId);

    if (!seller) {
      return res.json({ success: false, message: "Seller not found" });
    }

    // Get ratings with buyer name AND profile
    const ratings = await Rating.find({ seller: seller._id })
      .populate("buyer", "name profile") //  populate profile too
      .sort({ createdAt: -1 });

    // Calculate average rating
    const averageRating = ratings.length
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
      : 0;

    // Return seller with ratings & review info
    res.json({
      success: true,
      seller: {
        ...seller.toObject(),
        ratings,         // all ratings with buyer name + profile
        averageRating,   // calculated average
        numReviews: ratings.length
      }
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Seller_Profile Server error" });
  }
});

app.get("/api/buyer_dashboard", auth, async (req, res) => {
  try {
    // 1. Fetch Buyer (Ensure you only select what the frontend needs)
    const buyer = await Buyer.findById(req.userId).select("name profile");

    if (!buyer) {
      return res.status(404).json({ success: false, message: "Buyer not found" });
    }

    // 2. Fetch all sellers
    const sellers = await Seller.find().select(
      "name location category profile files description"
    );

    // 3. Map through sellers to attach ratings
    // Using Promise.all is correct for parallel DB queries
    const sellersWithRatings = await Promise.all(
      sellers.map(async (seller) => {
        // Ensure 'Rating' model is imported at the top of your file!
        const ratings = await Rating.find({ seller: seller._id });

        const numReviews = ratings.length;
        const averageRating = numReviews
          ? ratings.reduce((sum, r) => sum + r.rating, 0) / numReviews
          : 0;

        // Use .toObject() to allow adding new properties to a Mongoose document
        return {
          ...seller.toObject(),
          averageRating: Number(averageRating.toFixed(1)), // Round to 1 decimal place for stars
          numReviews
        };
      })
    );

    // 4. Send response in the exact format your Frontend useEffect expects
    res.json({
      success: true,
      buyer: {
        _id: buyer._id,
        name: buyer.name,
        profile: buyer.profile
      },
      sellers: sellersWithRatings
    });

  } catch (error) {
    console.error("Dashboard Route Error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message
    });
  }
});

app.get("/api/view_profile/:id", auth, async (req, res) => {
  try {

    const sellerId = req.params.id;

    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return res.json({ success: false, message: "Seller not found" });
    }

    //  POPULATE BUYER NAME
    const ratings = await Rating.find({ seller: sellerId })
      .populate("buyer", "name profile");

    const averageRating = ratings.length
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
      : 0;

    const numReviews = ratings.length;

    res.json({
      success: true,
      seller: {
        ...seller.toObject(),
        ratings,
        averageRating,
        numReviews
      }
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "View Profile Server Error" });
  }
});

app.get("/api/view_products/:id", auth, async (req, res) => {
  try {
    const sellerId = req.params.id;

    // 1. INCREMENT VIEW COUNT
    // We update the Seller model because the 'views' stat belongs to them
    const updatedSeller = await Seller.findByIdAndUpdate(
      sellerId,
      { $inc: { views: 1 } },
      { new: true }
    );

    if (!updatedSeller) {
      return res.status(404).json({ success: false, message: "Seller not found" });
    }

    // 2. FETCH PRODUCTS
    const products = await Product.find({ seller: sellerId });

    // 3. EMIT REAL-TIME UPDATE TO SELLER
    const sellerRoom = `Seller_${sellerId}`;
    
    // This sends the updated count to the Seller's dashboard immediately
    io.to(sellerRoom).emit("viewUpdate", {
      totalViews: updatedSeller.views,
      timestamp: new Date()
    });

    res.json({
      success: true,
      seller: updatedSeller,
      products
    });

  } catch (error) {
    console.error("View Products Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

app.get("/api/Service_Products/:id", auth, async (req, res) => {
  try {
    const sellerId = req.params.id;
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return res.json({ success: false, message: "Seller not found" });
    }
    const products = await Product.find({ seller: sellerId });
    res.json({
      success: true,
      seller,
      products
    })
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "View Products Server Error" });
  }
})

app.get("/api/Asset_Products/:id", auth, async (req, res) => {
  try {
    const sellerId = req.params.id;
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return res.json({ success: false, message: "Seller not found" });
    }
    const products = await Product.find({ seller: sellerId });
    res.json({
      success: true,
      seller,
      products
    })
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "View Products Error" });
  }
})
app.get("/api/sellers/:category", auth, async (req, res) => {
  try {
    // Find sellers by category
    const sellers = await Seller.find({
      category: { $regex: new RegExp("^" + req.params.category + "$", "i") }
    }).select("name location category profile files description"); // only essential fields

    // Fetch buyer info if logged in
    let buyer = null;
    if (req.userId) {
      buyer = await Buyer.findById(req.userId).select("name profile");
    }

    // Attach ratings to each seller
    const sellersWithRatings = await Promise.all(
      sellers.map(async (seller) => {
        const ratings = await Rating.find({ seller: seller._id });
        const averageRating = ratings.length
          ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
          : 0;
        const numReviews = ratings.length;

        return {
          ...seller.toObject(),
          averageRating,
          numReviews
        };
      })
    );

    res.json({
      success: true,
      sellers: sellersWithRatings,
      buyer
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Error fetching sellers" });
  }
});

app.delete("/api/products/delete/:productId", auth, async (req, res) => {
  try {

    const productId = req.params.productId;
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ success: false, message: "Product Not Found" });
    }

    // Optional: check seller ownership
    if (product.seller.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: "You can only delete your own products" });
    }

    await Product.findByIdAndDelete(productId);

    res.json({ success: true, message: "Product Deleted Successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Delete Products Error" });
  }
});

app.put("/api/products/update/:id", auth, upload.array("files", 10), async (req, res) => {
  try {

    const productId = req.params.id;
    const product = await Product.findById(productId);
    if (!product) {
      return res.json({ success: false, message: "Product Not Found" });
    }

    if (product.seller.toString() !== req.userId) {
      return res.json({ success: false, message: "UnAuthorised" });
    }

    const { name, price, category, location, description, quantity } = req.body;

    const updatedData = {
      name,
      price: Number(price),
      category,
      location,
      description,
      quantity: Number(quantity),
      files: product.files || [], // start with old files
    };

    // Append new files instead of replacing
    if (req.files && req.files.length > 0) {
      const newFiles = req.files.map(file => file.path);
      updatedData.files = updatedData.files.concat(newFiles);
    }

    const UpdatedProduct = await Product.findByIdAndUpdate(
      productId,
      updatedData,
      { returnDocument: "after" } // avoids mongoose deprecation warning
    );


    res.json({
      success: true,
      UpdatedProduct,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Updating Product Error" });
  }
});

app.get("/api/buyer_profile/update", auth, async (req, res) => {
  try {

    const buyer = await Buyer.findById(req.userId);
    res.json({
      success: true,
      buyer
    })
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Buyer Profile Error" });
  }
})
const fs = require("fs");

app.put(
  "/api/seller_profile",
  upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "files", maxCount: 10 }
  ]), auth,
  async (req, res) => {
    try {
      const seller = await Seller.findById(req.userId);

      if (!seller) {
        return res.json({ success: false, message: "Seller Not Found" });
      }

      // 📝 BASIC DATA
      let updatedData = {
        name: req.body.name,
        location: req.body.location,
        phone: req.body.phone,
        description: req.body.description
      };

      // =============================
      // ✅ UPDATE PROFILE IMAGE
      // =============================
      if (req.files && req.files["profileImage"]) {
        updatedData.profile = req.files["profileImage"][0].path; // ✅ FIXED
      }

      // =============================
      // ✅ ADD LOCATION IMAGES
      // =============================
      if (req.files && req.files["files"]) {
        const newImages = req.files["files"].map(file => file.path); // ✅ FIXED

        updatedData.files = [
          ...(seller.files || []),
          ...newImages
        ];
      }

      // =============================
      // 💾 SAVE UPDATE
      // =============================
      const updatedSeller = await Seller.findByIdAndUpdate(
        req.userId,
        updatedData,
        { new: true } // return updated document
      );

      res.json({
        success: true,
        updatedSeller
      });

    } catch (error) {
      console.log("UPDATE ERROR:", error);
      res.status(500).json({
        success: false,
        message: "Update Error"
      });
    }
  }
);

// =========================
// SELLER REPLY TO RATING
// =========================
app.put("/api/ratings/:id/reply", auth, async (req, res) => {
  try {
    const { reply } = req.body;
    const ratingId = req.params.id;

    // Ensure the user is a seller
    if (req.role !== "seller") {
      return res.status(403).json({ success: false, message: "Only sellers can reply to ratings" });
    }

    // Update the rating document
    const updatedRating = await Rating.findOneAndUpdate(
      { _id: ratingId, seller: req.userId }, // Ensure the rating belongs to this seller
      { sellerReply: reply },
      { new: true }
    );

    if (!updatedRating) {
      return res.status(404).json({ success: false, message: "Rating not found or unauthorized" });
    }

    // Optional: If you use Socket.io for live updates
    io.emit("sellerReplyAdded", {
      ratingId: updatedRating._id,
      sellerReply: updatedRating.sellerReply
    });

    res.json({
      success: true,
      message: "Reply added successfully",
      rating: updatedRating
    });

  } catch (error) {
    console.error("Reply Error:", error);
    res.status(500).json({ success: false, message: "Server error while replying" });
  }
});

app.delete("/api/delete_location_image/:filename", auth, async (req, res) => {
  try {

    const { filename } = req.params;

    await Seller.findByIdAndUpdate(
      req.userId,
      { $pull: { files: filename } }
    );

    res.json({ success: true });

  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false });
  }
});

app.get("/api/product_views", auth, async (req, res) => {
  try {
    const products = await Product.find({ seller: req.userId });

    const totalViews = products.reduce((sum, p) => sum + p.views, 0);

    res.json({
      success: true,
      totalViews
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false });
  }
});

const httpServer = require("http").createServer(app);
const { Server } = require("socket.io");

const io = new Server(httpServer, {
  cors: {
    origin: "https://isonga-frontend.vercel.app",
    methods: ["GET", "POST"],
  },
  transports: ["polling", "websocket"],
  pingTimeout: 60000, // Increase timeout for slower connections
});
// Store online users
// Key = Buyer_<id> OR Seller_<id>
const onlineUsers = new Map();
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) return next(new Error("Unauthorized"));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    socket.userId = decoded.id; // ✅ REQUIRED

    next();
  } catch (err) {
    next(new Error("Invalid token"));
  }
});
io.on("connection", (socket) => {

  console.log("New socket connected:", socket.id);

  // =========================
  // USER ONLINE
  // ==================
  // BACKEND: updated userOnline listener
socket.on("userOnline", (data) => {
  // 1. Get the ID and Model from the data sent by the Frontend
  const { userId, userModel } = data;

  if (!userId || !userModel) return;

  // 2. Format the model (e.g., "seller" -> "Seller")
  const model = userModel.charAt(0).toUpperCase() + userModel.slice(1).toLowerCase();

  // 3. Create the key (e.g., "Seller_65eb...")
  const key = `${model}_${userId}`;

  // 4. Register in your onlineUsers Map
  if (!onlineUsers.has(key)) {
    onlineUsers.set(key, new Set());
  }
  onlineUsers.get(key).add(socket.id);
  
  socket.userKey = key;

  // 5. JOIN THE ROOM (Critical for io.to(key).emit to work)
  socket.join(key);

  console.log("✅ LIVE DASHBOARD ACTIVE:", key);
});

  // =========================
  // JOIN CHAT ROOM
  // =========================
  socket.on("joinRoom", ({ senderId, senderModel, receiverId, receiverModel }) => {
    if (!senderId || !receiverId || !senderModel || !receiverModel) return;

    const buyerId = senderModel === "Buyer" ? senderId : receiverId;
    const sellerId = senderModel === "Seller" ? senderId : receiverId;

    const room = `Buyer_${buyerId}__Seller_${sellerId}`;
    socket.join(room);

    console.log(`Socket ${socket.id} joined room: ${room}`);
  });

  // ====
  // =========================
  // SEND MESSAGE (UPDATED FOR REAL-TIME NOTIFS)
  // =========================
  socket.on("sendMessage", async (data) => {
    try {
      const {
        sender, senderModel, receiver, receiverModel,
        message, files, productId, replyTo
      } = data;

      if (!sender || !receiver || (!message && (!files || files.length === 0))) return;

      const room =
        senderModel === "Buyer"
          ? `Buyer_${sender}__Seller_${receiver}`
          : `Buyer_${receiver}__Seller_${sender}`;

      const Conversation = require("./models/Conversation");

      await Conversation.updateOne(
        { room },
        {
          $setOnInsert: {
            room,
            participants: [sender, receiver],
          },
        },
        { upsert: true }
      );

      // Restore deleted conversations
      await Conversation.findOneAndUpdate(
        { room },
        {
          $pull: {
            deletedFor: {
              $in: [
                new mongoose.Types.ObjectId(sender),
                new mongoose.Types.ObjectId(receiver),
              ],
            },
          },
        }
      );

      // 1. Save message
      const newMessage = await Message.create({
        sender,
        senderModel,
        receiver,
        receiverModel,
        message: message || "",
        files: files || [],
        room,
        productId: productId || null,
        replyTo: replyTo || null,
        read: false
      });

      // 2. Populate for the quote/product box
      const populatedMessage = await Message.findById(newMessage._id)
        .populate({
          path: "replyTo",
          select: "message files sender senderModel"
        })
        .populate("productId", "name price files");

      // 3. Count unread messages for THIS ROOM (for the chat screen)
      const roomUnreadCount = await Message.countDocuments({
        room,
        receiver,
        read: false
      });

      // 4. 🔥 NEW: Count TOTAL unread messages for THIS USER (for the dashboard bubble)
      const totalUnreadMessages = await Message.countDocuments({
        receiver,
        read: false
      });

      const messageData = {
        ...populatedMessage.toObject(),
        unreadCount: roomUnreadCount
      };

      // 5. Emit to the active chat room
      io.to(room).emit("receiveMessage", messageData);

      // 6. Emit to the Receiver's Dashboard (Real-time Notification)
      const normalize = (m) =>
        m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();

      const receiverKey = `${normalize(receiverModel)}_${receiver}`;
      
      // ✅ TARGET THE ROOM (More reliable than onlineUsers Map)
      // Since your userOnline logic joins socket.join(key), we can emit directly to the room
      io.to(receiverKey).emit("newMessageNotification", {
        room,
        sender,
        senderModel,
        receiver,
        receiverModel,
        message: message || "Sent an attachment",
        unreadChatCount: totalUnreadMessages,
         // 🔥 PASSING THE TOTAL COUNT 
         roomUnreadCount: roomUnreadCount,
        replyTo: messageData.replyTo,
        createdAt: newMessage.createdAt
      });

    } catch (error) {
      console.error("SendMessage Error:", error);
    }
  });
  // =========================
  // TYPING INDICATOR (FIXED)
  // =========================
  socket.on("typing", ({ room, senderId }) => {
    if (!room || !senderId) return;

    socket.to(room).emit("typing", {
      senderId,
    });
  });

  socket.on("stopTyping", ({ room }) => {
    if (!room) return;

    socket.to(room).emit("stopTyping");
  });

  app.post("/api/chat/upload", auth, upload.array("files", 10), (req, res) => {

    try {

      if (!req.files || req.files.length === 0) {
        return res.json({ success: false, message: "No files uploaded" });
      }

      const fileUrls = req.files.map(file => file.path);

      res.json({
        success: true,
        files: fileUrls
      });

    } catch (error) {

      console.log(error);

      res.status(500).json({
        success: false,
        message: "Upload failed"
      });

    }

  });

  // =========================
  // MARK MESSAGES AS READ
  // =========================
  socket.on("messagesRead", async ({ room }) => {
    try {
      // Find all unread messages for this room and mark them as read
      await Message.updateMany(
        { room, read: false },
        { $set: { read: true } }
      );

      // Notify all sockets in the room to update unread count
      io.to(room).emit("messagesRead", { room });

    } catch (err) {
      console.error("messagesRead Error:", err);
    }
  });

  socket.on("deleteMessage", async ({ messageId, room, forEveryone }) => {
    try {
      const message = await Message.findById(messageId);
      if (!message) return;

      const userId = socket.userId;

      if (forEveryone) {
        // only sender can delete for everyone
        if (message.sender.toString() !== userId) return;

        await Message.findByIdAndUpdate(messageId, {
          message: "This message was deleted",
          files: [],
          deletedForEveryone: true,
        });
      } else {
        // delete for me only
        await Message.findByIdAndUpdate(messageId, {
          $addToSet: {
            deletedFor: new mongoose.Types.ObjectId(userId),
          },
        });
      }

      io.to(room).emit("messageDeleted", {
        messageId,
        forEveryone,
        userId,
      });

    } catch (err) {
      console.error("Delete Error:", err);
    }
  });

  const mongoose = require("mongoose");

  socket.on("deleteConversation", async ({ room }) => {
    try {
      const userId = socket.userId;

      console.log("DELETE REQUEST:", { userId, room });

      const userObjectId = new mongoose.Types.ObjectId(userId);

      const result = await Conversation.findOneAndUpdate(
        { room },
        { $addToSet: { deletedFor: userObjectId } },
        { upsert: true, new: true }
      );

      console.log("UPDATED CONVERSATION:", result);

      io.to(room).emit("conversationDeleted", { room });
    } catch (err) {
      console.error(err);
    }
  });
  // =========================
  // USER DISCONNECT
  // =========================
  socket.on("disconnect", () => {

    console.log("Socket disconnected:", socket.id);

    if (socket.userKey && onlineUsers.has(socket.userKey)) {
      const userSockets = onlineUsers.get(socket.userKey);

      userSockets.delete(socket.id);

      if (userSockets.size === 0) {
        onlineUsers.delete(socket.userKey);
      }
    }

  });

});
// Add this to your server.js
app.get("/api/get_buyer/:id", auth, async (req, res) => {
  try {
    const buyer = await Buyer.findById(req.params.id).select("name profile");
    if (!buyer) return res.json({ success: false, message: "Buyer not found" });
    res.json({ success: true, buyer });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

app.get("/api/seller/conversations", auth, async (req, res) => {
  try {
    const sellerObjectId = new mongoose.Types.ObjectId(req.userId);

    const conversations = await Message.aggregate([
      // 1. Get only messages related to this seller
      {
        $match: {
          $or: [
            { sender: sellerObjectId, senderModel: "Seller" },
            { receiver: sellerObjectId, receiverModel: "Seller" }
          ]
        }
      },

      { $sort: { createdAt: -1 } },

      // 2. Group messages into conversations (Extracting Buyer details)
      {
        $group: {
          _id: "$room",
          lastMessage: { $first: "$message" },
          updatedAt: { $first: "$createdAt" },

          buyerId: {
            $first: {
              $cond: [
                { $eq: ["$senderModel", "Buyer"] },
                "$sender",
                "$receiver"
              ]
            }
          },

          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$receiver", sellerObjectId] },
                    { $eq: ["$read", false] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },

      // 3. Join conversation table to check for deletions
      {
        $lookup: {
          from: "conversations",
          localField: "_id",
          foreignField: "room",
          as: "conv"
        }
      },

      // 4. Flatten the conversation data safely
      {
        $addFields: {
          conv: { $arrayElemAt: ["$conv", 0] }
        }
      },

      // 5. 🔥 DELETE FILTER: Remove if seller ID is in deletedFor array
      {
        $match: {
          $expr: {
            $not: {
              $in: [
                sellerObjectId,
                { $ifNull: ["$conv.deletedFor", []] }
              ]
            }
          }
        }
      },

      // 6. Buyer lookup (to show the buyer's name/profile to the seller)
      {
        $lookup: {
          from: "buyers",
          localField: "buyerId",
          foreignField: "_id",
          as: "buyer"
        }
      },

      { $unwind: "$buyer" },

      // 7. Final shape for the Seller Dashboard
      {
        $project: {
          _id: 0,
          room: "$_id",
          lastMessage: 1,
          updatedAt: 1,
          unreadCount: 1,
          buyerId: 1,
          buyerName: "$buyer.name",
          buyerProfile: "$buyer.profile"
        }
      },

      { $sort: { updatedAt: -1 } }
    ]);

    res.json({ success: true, conversations });

  } catch (err) {
    console.error("Seller Conversation fetch error:", err);
    res.status(500).json({ success: false });
  }
});
// 1. GET messages for a specific room (Updated with Population)
app.get("/api/messages/:room", async (req, res) => {
  try {
    const messages = await Message.find({ room: req.params.room })
      // This "joins" the referenced message so you get the actual text
      .populate({
        path: "replyTo",
        select: "message files sender senderModel" // Only fetch fields needed for the quote box
      })
      // This "joins" the product data if the message is a product inquiry
      .populate("productId", "name price files")
      .sort({ createdAt: 1 });

    res.json({ success: true, messages });
  } catch (err) {
    console.error("Fetch Messages Error:", err);
    res.status(500).json({ success: false, message: "Could not load messages" });
  }
});

app.put("/api/messages/read/:room", auth, async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // This updates messages where YOU are the receiver and they are currently unread
    const result = await Message.updateMany(
      {
        room: req.params.room,
        receiver: userId, // Essential: only mark messages sent TO you
        read: false
      },
      { $set: { read: true } }
    );

    io.to(req.params.room).emit("messagesRead", {
      room: req.params.room,
      updatedBy: userId
    });

    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error("Mark messages read error:", err);
    res.status(500).json({ success: false });
  }
});

// --- DELETE MESSAGE ROUTE ---
app.delete("/api/messages/delete/:id", auth, async (req, res) => {
  try {
    const messageId = req.params.id;
    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    // Security check: Only the sender can delete their message
    if (message.sender.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: "Unauthorized to delete this message" });
    }

    await Message.findByIdAndDelete(messageId);

    res.json({ success: true, message: "Message deleted for everyone" });
  } catch (error) {
    console.error("Delete Msg Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});
// In server.js
app.get("/api/get_seller/:id", auth, async (req, res) => {
  const seller = await Seller.findById(req.params.id).select("name profile");
  if (!seller) return res.json({ success: false });
  res.json({ success: true, seller });
});

app.get("/api/buyer/conversations", auth, async (req, res) => {
  try {
    const buyerObjectId = new mongoose.Types.ObjectId(req.userId);

    const conversations = await Message.aggregate([
      // 1. Get only messages related to buyer
      {
        $match: {
          $or: [
            { sender: buyerObjectId, senderModel: "Buyer" },
            { receiver: buyerObjectId, receiverModel: "Buyer" }
          ]
        }
      },

      { $sort: { createdAt: -1 } },

      // 2. Group messages into conversations
      {
        $group: {
          _id: "$room",
          lastMessage: { $first: "$message" },
          updatedAt: { $first: "$createdAt" },

          sellerId: {
            $first: {
              $cond: [
                { $eq: ["$senderModel", "Seller"] },
                "$sender",
                "$receiver"
              ]
            }
          },

          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$receiver", buyerObjectId] },
                    { $eq: ["$read", false] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },

      // 3. Join conversation table
      {
        $lookup: {
          from: "conversations",
          localField: "_id",
          foreignField: "room",
          as: "conv"
        }
      },

      // 4. flatten safely
      {
        $addFields: {
          conv: { $arrayElemAt: ["$conv", 0] }
        }
      },

      // 5. 🔥 STRONG DELETE FILTER (FIX)
      {
        $match: {
          $expr: {
            $not: {
              $in: [
                buyerObjectId,
                {
                  $ifNull: ["$conv.deletedFor", []]
                }
              ]
            }
          }
        }
      },

      // 6. seller lookup
      {
        $lookup: {
          from: "sellers",
          localField: "sellerId",
          foreignField: "_id",
          as: "seller"
        }
      },

      { $unwind: "$seller" },

      // 7. final shape
      {
        $project: {
          _id: 0,
          room: "$_id",
          lastMessage: 1,
          updatedAt: 1,
          unreadCount: 1,
          sellerId: 1,
          sellerName: "$seller.name",
          sellerProfile: "$seller.profile"
        }
      },

      { $sort: { updatedAt: -1 } }
    ]);

    res.json({ success: true, conversations });

  } catch (err) {
    console.error("Conversation fetch error:", err);
    res.status(500).json({ success: false });
  }
});


// GET all sellers for public home
app.get("/api/home_sellers", async (req, res) => {
  try {
    const sellers = await Seller.find().select(
      "name location category profile files description"
    );

    // Add ratings info for each seller
    const sellersWithRatings = await Promise.all(
      sellers.map(async (seller) => {
        const ratings = await Rating.find({ seller: seller._id });
        const averageRating = ratings.length
          ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
          : 0;
        const numReviews = ratings.length;

        return {
          ...seller.toObject(),
          averageRating,
          numReviews,
        };
      })
    );

    res.json({ success: true, sellers: sellersWithRatings });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Error fetching sellers" });
  }
});

app.get("/api/sellers/search", async (req, res) => {
  try {
    const query = req.query.q;

    if (!query) {
      return res.json({ success: true, sellers: [] });
    }

    const sellers = await Seller.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { location: { $regex: query, $options: "i" } },
        { category: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } }
      ]
    }).select("name location category profile files description");

    const sellersWithRatings = await Promise.all(
      sellers.map(async (seller) => {
        const ratings = await Rating.find({ seller: seller._id });

        const averageRating = ratings.length
          ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
          : 0;

        return {
          ...seller.toObject(),
          averageRating,
          numReviews: ratings.length
        };
      })
    );

    res.json({
      success: true,
      sellers: sellersWithRatings
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false });
  }
});

app.post("/api/cart/add", auth, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const buyerId = req.userId;

    if (!buyerId) {
      return res.status(401).json({ success: false, message: "Please login to add items to cart" });
    }

    const product = await Product.findById(productId);
    if (!product || product.quantity < quantity) {
      return res.json({ success: false, message: "Product unavailable or insufficient stock" });
    }

    let cart = await Cart.findOne({ buyer: buyerId });

    if (!cart) {
      // Create new cart if none exists
      cart = await Cart.create({
        buyer: buyerId,
        items: [{ product: productId, quantity, price: product.price }],
        totalPrice: product.price * quantity
      });
    } else {
      // Check if product exists in cart
      const itemIndex = cart.items.findIndex(p => p.product.toString() === productId);

      if (itemIndex > -1) {
        cart.items[itemIndex].quantity += Number(quantity);
      } else {
        cart.items.push({ product: productId, quantity, price: product.price });
      }

      // Recalculate Total
      cart.totalPrice = cart.items.reduce((acc, item) => acc + (item.quantity * item.price), 0);
      await cart.save();
    }

    res.json({ success: true, message: "Added to cart", cartCount: cart.items.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Cart Error" });
  }
});

app.get("/api/cart", auth, async (req, res) => {
  try {
    const buyer = await Buyer.findById(req.userId).select("profile");
    const cart = await Cart.findOne({ buyer: req.userId })
      .populate("items.product", "name price files location");

    res.json({ success: true, cart, buyer });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

app.put("/api/cart/update", auth, async (req, res) => {
  try {

    const { productId, quantity } = req.body;

    const cart = await Cart.findOne({ buyer: req.userId });

    if (!cart) return res.json({ success: false });

    const item = cart.items.find(
      i => i.product.toString() === productId
    );

    if (!item) return res.json({ success: false });

    item.quantity = quantity;

    cart.totalPrice = cart.items.reduce(
      (acc, item) => acc + item.quantity * item.price, 0
    );

    await cart.save();

    res.json({ success: true, cart });

  } catch (error) {
    res.status(500).json({ success: false });
  }
});

app.get("/api/cart/count", auth, async (req, res) => {
  try {

    const cart = await Cart.findOne({
      buyer: req.userId
    });

    const count = cart ? cart.items.length : 0;

    res.json({
      success: true,
      count
    });

  } catch (error) {
    res.status(500).json({ success: false });
  }
});
// ==========================================
//  ORDER MANAGEMENT ROUTES
// ==========================================

// 1. PLACE ORDER (Buyer)
app.post("/api/order", auth, upload.single("paymentProof"), async (req, res) => {
  try {
    const buyerId = req.userId;
    const { name, phone, address, deliveryMethod, paymentMethod, notes, deliveryDate } = req.body;

    // Fetch the buyer's current cart
    const cart = await Cart.findOne({ buyer: buyerId }).populate("items.product");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    // Map cart items to the Order schema format
    const orderItems = cart.items.map(item => ({
      product: item.product._id,
      seller: item.product.seller, // Assumes Product model has a 'seller' field
      quantity: item.quantity,
      price: item.price
    }));

    // Create the order
    const newOrder = await Order.create({
      buyer: buyerId,
      items: orderItems,
      totalPrice: cart.totalPrice,
      name,
      phone,
      address,
      deliveryMethod,
      deliveryDate: deliveryDate || null,
      paymentMethod,
      paymentProof: req.file ? req.file.path : "", // Uses your Cloudinary/Multer setup
      notes,
      status: "Pending"
    });

    // Notify involved sellers via Socket.io
    const uniqueSellers = [...new Set(orderItems.map(i => i.seller.toString()))];

    uniqueSellers.forEach(sellerId => {
      const sellerRoom = `Seller_${sellerId}`;

      // Use io.to(sellerRoom) to hit the room, not a specific ID
      // If 'io' is defined in your main server file, ensure it's accessible here
      io.to(sellerRoom).emit("newOrderNotification", {
        message: `New Order from ${name}!`,
        orderId: newOrder._id,
        total: cart.totalPrice
      });
    }); // <--- YOU WERE MISSING THIS CLOSING BRACE AND PARENTHESIS

    // Clear the cart after successful order
    await Cart.findOneAndDelete({ buyer: buyerId });

    res.json({ success: true, message: "Order placed successfully!", orderId: newOrder._id });
} catch (error) {
    console.error("Order Creation Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  } // <--- Added this to close 'catch'
}); //
    // 2. GET SELLER ORDERS
    app.get("/api/seller/orders", auth, async (req, res) => {
      try {
        const sellerId = req.userId;

        // Find orders where at least one item belongs to this seller
        const orders = await Order.find({ "items.seller": sellerId })
          .populate("items.product", "name")
          .sort({ createdAt: -1 });

        res.json({ success: true, orders });
      } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
      }
    });

    // GET /api/orders/my-orders (For Buyers)
    app.get("/api/orders/my-orders", auth, async (req, res) => {
      try {
        if (req.role !== "buyer") {
          return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        // Find orders belonging to this buyer, sorted by newest update
        const orders = await Order.find({ buyer: req.userId })
          .sort({ updatedAt: -1 })
          .populate("items.product", "name");

        res.json({
          success: true,
          orders
        });
      } catch (error) {
        console.error("Fetch Buyer Orders Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
      }
    });

    app.put("/api/order/status/:id", auth, async (req, res) => {
  try {
    const sellerId = req.userId;
    const id = req.params.id;
    const { status } = req.body;

    const item = await Order.findById(id);

    if (!item) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Check ownership
    const isOwner = item.items.some(i => i.seller.toString() === sellerId);
    if (!isOwner) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    // Prevent duplicate updates
    if (item.status !== "Pending") {
      return res.json({ success: false, message: `Already ${item.status}` });
    }

    // Update status
    item.status = status;
    await item.save();

    const displayId = item._id.toString().slice(-6).toUpperCase();
    const notificationMessage =
      status === "Accepted"
        ? `✅ Your order #${displayId} has been accepted!`
        : `❌ Your order #${displayId} was declined.`;

    // 1. Create the notification in DB
    const newNotif = await Notification.create({
      recipient: item.buyer,
      sender: sellerId,
      message: notificationMessage,
      orderId: item._id,
      read: false,
      category: "Order"
    });

    // 2. CRITICAL: Calculate the REAL unread count for this buyer
    const unreadCount = await Notification.countDocuments({
      recipient: item.buyer,
      read: false
    });

    const buyerRoom = `Buyer_${item.buyer}`;

    // 3. EMIT: Match the frontend listener name
    // If your frontend uses socket.on("notification"), change it here:
    io.to(buyerRoom).emit("notification", {
      _id: newNotif._id,
      message: notificationMessage,
      unreadCount: unreadCount, // Now this has a real value!
      orderId: item._id,
      status: status,
      createdAt: newNotif.createdAt
    });

    res.json({
      success: true,
      message: `Order ${status.toLowerCase()} successfully`,
      data: item
    });

  } catch (err) {
    console.error("🔥 Status Update Error:", err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});
    // ✅ Add this route to handle fetching a single order by ID
    app.get("/api/orders/:id", auth, async (req, res) => {
      try {
        const orderId = req.params.id;

        // Find the order and populate product details
        const order = await Order.findById(orderId).populate("items.product");

        if (!order) {
          return res.status(404).json({
            success: false,
            message: "Order not found in database",
          });
        }

        // Security: Ensure the person requesting is either the Buyer or the Seller of this order
        const isBuyer = order.buyer.toString() === req.userId.toString();

        // Check if the seller is involved in any item of this order
        const isSeller = order.items.some(item => item.seller.toString() === req.userId.toString());

        if (!isBuyer && !isSeller) {
          return res.status(403).json({
            success: false,
            message: "Not authorized to view this order",
          });
        }

        res.json({
          success: true,
          order,
        });
      } catch (err) {
        console.error("🔥 Fetch Order Error:", err);
        res.status(500).json({
          success: false,
          message: "Server error while fetching order",
        });
      }
    });

    // ✅ CORRECTED: MARK ALL NOTIFICATIONS AS READ
    app.put("/api/notifications/mark-read", auth, async (req, res) => {
      try {
        // We update based on the 'read' boolean to match your unread-count route
        const result = await Notification.updateMany(
          { recipient: req.userId, read: false },
          { $set: { read: true } }
        );

        res.json({
          success: true,
          message: "Notifications marked as read",
          modifiedCount: result.modifiedCount
        });
      } catch (error) {
        console.error("Mark Read Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
      }
    });

    app.get("/api/notifications", auth, async (req, res) => {
      try {
        if (!req.userId) {
          return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const notifications = await Notification.find({ recipient: req.userId })
          .populate({
            path: "sender",
            select: "name profile",
            options: { strictPopulate: false } // ✅ prevents crash from old data
          })
          .sort({ createdAt: -1 })
          .limit(20);

        res.json({
          success: true,
          notifications
        });

      } catch (error) {
        console.error("🔥 Fetch Notif Error FULL:", error);
        res.status(500).json({ success: false, message: error.message });
      }
    });

    // ✅ THIS ONE WAS ALREADY CORRECT
    app.get("/api/notifications/unread-count", auth, async (req, res) => {
      try {
        const count = await Notification.countDocuments({
          recipient: req.userId,
          read: false
        });

        res.json({ success: true, count });
      } catch (err) {
        res.status(500).json({ success: false });
      }
    });
    app.post("/api/rate_seller", auth, async (req, res) => {
  try {
    const { sellerId, rating, comment } = req.body;
    const buyerId = req.userId;

    if (!buyerId) return res.json({ success: false, message: "Login required" });

    // 1. UPSERT: Find existing rating by this buyer for this seller, or create new
    await Rating.findOneAndUpdate(
      { buyer: buyerId, seller: sellerId }, // Search criteria
      { 
        rating: Number(rating), 
        comment, 
        createdAt: Date.now() 
      }, // Data to update
      { upsert: true, new: true } // Create if doesn't exist
    );

    // 2. RE-CALCULATE Stats
    const ratings = await Rating.find({ seller: sellerId });
    const numReviews = ratings.length;
    const totalRatingSum = ratings.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = totalRatingSum / numReviews;

    // 3. BROADCAST TO ROOM
    // Using the "Room" ensures every open tab (Seller Dashboard & Buyer View) 
    // listening to this seller ID gets the update instantly.
    const sellerRoom = `Seller_${sellerId}`;
    
    io.to(sellerRoom).emit("sellerRatingUpdated", {
      sellerId: sellerId, // Include ID so frontend can verify
      averageRating: Number(averageRating.toFixed(1)),
      numReviews: numReviews,
      message: "Rating updated!" 
    });

    res.json({ 
      success: true, 
      message: "Rating submitted!",
      averageRating: Number(averageRating.toFixed(1)),
      numReviews 
    });

  } catch (error) {
    console.error("Rating Error:", error);
    res.status(500).json({ success: false });
  }
});
    app.get("/api/buyer_profile", auth, async (req, res) => {
      try {

        const buyer = await Buyer.findById(req.userId);

        res.json({ success: true, buyer });

      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    app.use((err, req, res, next) => {
      console.error("Global error:", err);

      res.status(500).json({
        success: false,
        message: "Server error",
        error: err.message
      });
    });

    // POST: Create a new booking
    // Note: "paymentProof" here must match the key used in formData.append() on frontend
    app.post("/api/bookService", auth, upload.single("paymentProof"), async (req, res) => {
      try {

        const { productId, name, phone, date, time, message, paymentMethod } = req.body;

        // 2. Fetch the product to get the associated Seller ID
        const productData = await Product.findById(productId);
        if (!productData) {
          return res.status(404).json({ success: false, message: "Service not found" });
        }

        // 3. Prepare the booking data
        const bookingData = {
          buyer: req.userId,
          seller: productData.seller, // Automatically link the seller from the product
          product: productId,
          name,
          phone,
          date,
          time,
          message,
          paymentMethod,
          status: "Pending"
        };

        // 4. Handle the uploaded file if it exists
        if (req.file) {
          // Map the file path to your model's field name: paymentScreenshot
          bookingData.paymentScreenshot = req.file.path;
        }

        const newBooking = await Booking.create(bookingData);

// ✅ USE ROOMS FOR RELIABLE NOTIFICATIONS
const sellerRoom = `Seller_${productData.seller}`;

// This sends to ALL devices/tabs the seller has open
io.to(sellerRoom).emit("newBookingNotification", {
  message: `New Booking Request from ${name}!`,
  bookingId: newBooking._id,
  date,
  time
});

res.json({
  success: true,
  message: "Booking Sent Successfully!",
  booking: newBooking
});

      } catch (error) {
        console.error("Booking Route Error:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
      }
    });

    app.get("/api/seller/bookings", auth, async (req, res) => {
      try {
        const sellerId = req.userId;
        if (!sellerId) return res.json({ success: false, message: "Unauthorized" });

        // We fetch everything so the frontend can decide what to show/hide
        const bookings = await Booking.find({ seller: sellerId })
          .populate("product", "name")
          .sort({ createdAt: -1 });

        res.json({ success: true, bookings });
      } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server Error" });
      }
    });

    app.put("/api/bookings/:id", auth, async (req, res) => {
      try {
        const { id } = req.params;
        const { status } = req.body;
        const sellerId = req.userId;

        if (!sellerId) {
          return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const validStatuses = ["Pending", "Accepted", "Processing", "Shipped", "Delivered", "Cancelled"];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({ success: false, message: "Invalid status type" });
        }

        const updatedBooking = await Booking.findOneAndUpdate(
          { _id: id, seller: sellerId },
          { status, seen: true },
          { new: true }
        );

        if (!updatedBooking) {
          return res.status(404).json({ success: false, message: "Booking not found" });
        }

        // ✅ CREATE NOTIFICATION
        const displayId = updatedBooking._id.toString().slice(-6).toUpperCase();

        const notificationMessage =
          status === "Accepted"
            ? `✅ Your booking #${displayId} has been accepted!`
            : `❌ Your booking #${displayId} was declined.`;

        const newNotif = await Notification.create({
          recipient: updatedBooking.buyer,   // ⚠️ MUST exist in Booking schema
          sender: sellerId,
          message: notificationMessage,
          bookingId: updatedBooking._id,
          read: false,
          category: "Booking"
        });

        // ✅ SOCKET REAL-TIME
       // ... inside app.put("/api/bookings/:id") after creating the Notification ...

// ✅ USE ROOMS FOR BUYER NOTIFICATIONS
const buyerRoom = `Buyer_${updatedBooking.buyer}`;

const unreadCount = await Notification.countDocuments({
  recipient: updatedBooking.buyer,
  read: false
});

// Notify the buyer room
io.to(buyerRoom).emit("new_notification", {
  _id: newNotif._id,
  message: notificationMessage,
  unreadCount,
  orderId: updatedBooking._id,
  status,
  type: "Booking",
  createdAt: newNotif.createdAt
});

res.json({ success: true, booking: updatedBooking });

      } catch (error) {
        console.error("🔥 Booking Update Error:", error);
        res.status(500).json({ success: false, message: "Update Error" });
      }
    });

    // ✅ GET SINGLE BOOKING (FIX)
    app.get("/api/bookings/:id", auth, async (req, res) => {
      try {
        const bookingId = req.params.id;

        const booking = await Booking.findById(bookingId)
          .populate("product");

        if (!booking) {
          return res.status(404).json({
            success: false,
            message: "Booking not found",
          });
        }

        // ✅ Security check (same as order)
        const isBuyer = booking.buyer.toString() === req.userId.toString();
        const isSeller = booking.seller.toString() === req.userId.toString();

        if (!isBuyer && !isSeller) {
          return res.status(403).json({
            success: false,
            message: "Not authorized to view this booking",
          });
        }

        res.json({
          success: true,
          booking,
        });

      } catch (err) {
        console.error("🔥 Fetch Booking Error:", err);
        res.status(500).json({
          success: false,
          message: "Server error while fetching booking",
        });
      }
    });

    app.put("/api/update_buyer_profile", auth, upload.single("profile"), async (req, res) => {

      try {

        const buyerId = req.userId;

        const buyer = await Buyer.findById(buyerId);

        if (!buyer) {
          return res.json({ success: false });
        }

        buyer.name = req.body.name;

        if (req.body.password) {
          buyer.password = await bcrypt.hash(req.body.password, 10);
        }

        if (req.file) {
          buyer.profile = req.file.path;
        }

        await buyer.save();

        res.json({ success: true, buyer });

      } catch (err) {
        console.log(err);
        res.json({ success: false });
      }

    });
    app.delete("/api/cart/remove/:id", auth, async (req, res) => {
      try {
        const buyerId = req.userId;

        const identifier = req.params.id;

        const cart = await Cart.findOne({ buyer: buyerId });
        if (!cart) {
          return res.status(404).json({ success: false, message: "Cart not found" });
        }

        cart.items = cart.items.filter((item) => {
          const isProductIdMatch =
            item.product && item.product.toString() === identifier;

          const isCartItemIdMatch =
            item._id.toString() === identifier;

          return !isProductIdMatch && !isCartItemIdMatch;
        });

        cart.totalPrice = cart.items.reduce(
          (acc, item) => acc + item.price * item.quantity,
          0
        );

        await cart.save();

        res.json({
          success: true,
          message: "Item removed from cart",
          cart
        });

      } catch (error) {
        console.error("Remove from cart error:", error);
        res.status(500).json({ success: false });
      }
    });

    app.post("/api/seller/mark-activity-read", auth, async (req, res) => {
      try {
        const sellerId = req.userId;

        if (!sellerId) {
          return res.status(401).json({ success: false });
        }

        const seller = await Seller.findById(sellerId);

        if (!seller) {
          return res.json({ success: false });
        }

        if (seller.sellerType === "Service") {
          // BOOKINGS
          await Booking.updateMany(
            { seller: sellerId, status: "Pending" },
            { $set: { status: "Seen" } }
          );
        } else {
          // ORDERS
          await Order.updateMany(
            { "items.seller": sellerId, status: "Pending" },
            { $set: { seen: true } }
          );
        }

        res.json({ success: true });

      } catch (error) {
        console.log(error);
        res.status(500).json({ success: false });
      }
    });
    app.post("/api/seller/view/:id", auth, async (req, res) => {
  try {
    const sellerId = req.params.id;
    const buyerId = req.userId;

    if (!buyerId) return res.json({ success: false, message: "Guest view" });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const seller = await Seller.findById(sellerId);
    if (!seller) return res.json({ success: false });

    // 1. Logic to find/update today's entry
    let todayEntry = seller.dailyViews.find(
      (d) => new Date(d.date).getTime() === today.getTime()
    );

    if (!todayEntry) {
      seller.dailyViews.push({ date: today, buyers: [buyerId] });
      seller.views += 1;
    } else {
      const hasViewed = todayEntry.buyers.includes(buyerId);
      if (!hasViewed) {
        todayEntry.buyers.push(buyerId);
        seller.views += 1;
      } else {
        return res.json({ success: true, message: "Already visited today" });
      }
    }

    await seller.save();

    // 2. TRIGGER REAL-TIME UPDATE VIA ROOM
    const sellerKey = `Seller_${sellerId}`;

    // Re-calculate today's count for the broadcast
    const currentTodayEntry = seller.dailyViews.find(
      (d) => new Date(d.date).getTime() === today.getTime()
    );

    // CRITICAL FIX: 
    // Instead of io.to(sellerSocket), we use io.to(sellerKey).
    // This sends the update to EVERY tab the seller has open in that room.
    io.to(sellerKey).emit("viewUpdate", {
      totalViews: seller.views,
      todayViews: currentTodayEntry ? currentTodayEntry.buyers.length : 0
    });

    console.log(`📡 View update broadcasted to room: ${sellerKey}`);

    res.json({ success: true });
  } catch (error) {
    console.error("View Update Error:", error);
    res.status(500).json({ success: false });
  }
});
    app.post("/api/logout", (req, res) => {
      res.json({
        success: true,
        message: "Logged out successfully"
      });
    });
    // START SERVER
    // ==============================
    const PORT = process.env.PORT;
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });