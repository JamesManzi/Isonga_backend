  const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');
const express=require("express");
const mongoose=require("mongoose");
const bcrypt=require("bcryptjs");
const cors=require("cors");
const multer=require("multer");
require("dotenv").config();
const Seller=require("./models/seller");
const Buyer=require("./models/buyer");
const Product=require("./models/product");
const Rating=require("./models/Rating");
const Message = require("./models/Message");
const Cart = require("./models/Cart");
const Order = require("./models/Order");
const path = require("path");
const Booking=require("./models/booking");
const jwt = require("jsonwebtoken");
// Creating App
const app=express();
//Cross Origin Configure
app.use(cors({
  origin: "https://isonga-frontend.vercel.app",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false
}));
// Define How Data Are Sent
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Store Uploads
const { upload } = require('./cloudinary');
// Session Configure
app.set("trust proxy", 1); // Help Https Work Well
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
// Seller Register
app.post("/api/register", upload.fields([
    { name:"profile", maxCount:1 },
    { name:"files", maxCount:5 }
]), async (req, res) => {
    try {
        console.log("Request body:", req.body);
        console.log("Uploaded files:", req.files);

        const { name, location, phone, email, password, repeat_pass, description, category, sellerType } = req.body;

        // Check required files
        if (!req.files || !req.files.profile || req.files.profile.length === 0) {
            return res.status(400).json({ success: false, message: "Profile image required" });
        }
        if (!req.files.files || req.files.files.length < 2) {
            return res.status(400).json({ success: false, message: "At least 2 store images required" });
        }

        const profile = req.files.profile[0].path;
        const files = req.files.files.map(f => f.path);

        console.log("Profile path:", profile);
        console.log("Files paths:", files);

        const existingSeller = await Seller.findOne({ email });
        if (existingSeller) return res.json({ success: false, message: "User Already Exists" });

        // Password validation here...

        const hash = await bcrypt.hash(password, 12);

        const seller = await Seller.create({
            name, profile, location, phone, email, files, password: hash, description, category, sellerType
        });

        console.log("Seller created:", seller);
        res.json({ success: true, message: "User Registered Successfully" });

    } catch (error) {
        console.error("Register error:", error); // ← important
        return res.status(500).json({ success: false, message: "Register Error" });
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

    // 🔥 CREATE TOKEN
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
    email: user.email
  }
});

  } catch (error) {
    res.status(500).json({ success: false, message: "Login Error" });
  }
});

app.post("/api/buyer_register",upload.single("profile"),async(req,res)=>{
    try {
        const{name,email,password,repeat_pass}=req.body;
    const ExistingBuyer=await Buyer.findOne({email});
    if(ExistingBuyer){
        return res.json({success:false,message:"User Already Exist"});
    }
const rule = /^(?=.{10,})(?:(?=.*[a-z])(?=.*[A-Z])(?=.*\d)|(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9])|(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9])|(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])).*$/;

if (!rule.test(password)) {
  return res.json({
    success: false,
    message: "Password must be at least 10 characters and include at least 3 of these: uppercase, lowercase, number, special character."
  });
}
    if(password!==repeat_pass){
        return res.json({success:false,message:"Password Must Much"});
    }
    const hashed=await bcrypt.hash(password,12);

    let profile="";
    if(req.file){
        profile=req.file.path;
    }
   const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASS
  }
});

try {
  console.log("📧 Sending email to:", email);
  console.log("EMAIL:", process.env.EMAIL);
  console.log("PASS exists:", !!process.env.EMAIL_PASS);

  await transporter.sendMail({
    from: process.env.EMAIL,
    to: email,
    subject: "Verify your account",
    text: `Your verification code is: ${code}`
  });

  console.log("✅ Email sent successfully");

} catch (err) {
  console.log("🔥 FULL EMAIL ERROR:", err);

  return res.status(500).json({
    success: false,
    message: "Email sending failed",
    error: err.message
  });
}
    res.json({
  success: true,
  message: "Verification code sent to email",
  email
});
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, debug: error.message });
    }
})

app.post("/api/verify-email", async (req, res) => {
  try {
    const { email, code } = req.body;

    const user = await Buyer.findOne({ email });

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    if (user.verificationCode !== code) {
      return res.json({ success: false, message: "Invalid code" });
    }

    if (user.verificationExpires < Date.now()) {
      return res.json({ success: false, message: "Code expired" });
    }

    user.isVerified = true;
    user.verificationCode = null;

    await user.save();

    res.json({
      success: true,
      message: "Email verified successfully"
    });

  } catch (error) {
    res.status(500).json({ success: false });
  }
});

app.post("/api/buyer_login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await Buyer.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "Invalid Credentials" });
    }

    if (!user.isVerified) {
  return res.json({
    success: false,
    message: "Please verify your email first"
  });
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
        email: user.email
      }
    });

  } catch (error) {
    res.status(500).json({ success: false });
  }
});

app.post("/api/add_product",auth, upload.array("files",10),auth, async (req,res)=>{
try{

const {type,name,price,location,category,description,quantity}=req.body;

let files=[];

if(req.files && req.files.length>0){
files=req.files.map(file=>file.path);
}

await Product.create({
seller:req.userId,
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
success:true,
message:"Item Added Successfully"
});

}catch(error){
console.log(error);
res.status(500).json({
success:false,
message:"Add Item Error"
});
}
});

app.get("/api/dashboard",auth, async (req, res) => {
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

    res.json({
      success: true,
      seller: {
        ...seller.toObject(),
        totalOrders: totalActivityCount, // This maps to "Bookings" in your frontend if type is Service
        newOrders: newActivityCount,
        averageRating: Number(averageRating.toFixed(1)), 
        numReviews: numReviews,
        totalItemsCount: totalItemsCount
      },
      totalViews,
      todayViews
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false,message:"Dashboard Internal Server Error" });
  }
});

app.get("/api/my_store",auth,async(req,res)=>{
 try {

    const products=await Product.find({seller:req.userId});
    const seller=await Seller.findById(req.userId).select("name");

    res.json({
        success:true,
        products,
        seller
    })
 } catch (error) {
    console.log(error);
    res.status(500).json({success:false,message:"My Store Server Error"});
 }
})

app.get("/api/seller_profile",auth, async (req, res) => {
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
app.get("/api/buyer_dashboard",auth, async (req, res) => {
  try {

    const buyer = await Buyer.findById(req.userId);

    // Fetch all sellers
    const sellers = await Seller.find().select(
      "name location category profile files description"
    );

    // Calculate averageRating and numReviews for each seller
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
      buyer,
      sellers: sellersWithRatings
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Buyer Dashboard Server Error" });
  }
});

app.get("/api/view_profile/:id",auth, async (req, res) => {
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

app.get("/api/view_products/:id",auth,async(req,res)=>{
    try {
        const sellerId=req.params.id;
        const seller=await Seller.findById(sellerId);
        if (!seller) {
      return res.json({ success: false, message: "Seller not found" });
    }
    const products=await Product.find({seller:sellerId});
        res.json({
            success:true,
            seller,
            products
        })
    } catch (error) {
        console.log(error);
        return res.status(500).json({success:false,message:"View Products Server Error"});
    }
})

app.get("/api/Service_Products/:id",auth,async(req,res)=>{
  try {
        const sellerId=req.params.id;
        const seller=await Seller.findById(sellerId);
        if (!seller) {
      return res.json({ success: false, message: "Seller not found" });
    }
    const products=await Product.find({seller:sellerId});
        res.json({
            success:true,
            seller,
            products
        })
    } catch (error) {
        console.log(error);
        return res.status(500).json({success:false,message:"View Products Server Error"});
    }
})

app.get("/api/Asset_Products/:id",auth,async(req,res)=>{
  try {
        const sellerId=req.params.id;
        const seller=await Seller.findById(sellerId);
        if (!seller) {
      return res.json({ success: false, message: "Seller not found" });
    }
    const products=await Product.find({seller:sellerId});
        res.json({
            success:true,
            seller,
            products
        })
    } catch (error) {
        console.log(error);
        return res.status(500).json({success:false,message:"View Products Error"});
    }
})
app.get("/api/sellers/:category",auth, async (req, res) => {
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

app.delete("/api/products/delete/:productId",auth, async (req, res) => {
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

app.put("/api/products/update/:id",auth, upload.array("files", 10), async (req, res) => {
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

app.get("/api/buyer_profile/update",auth,async(req,res)=>{
    try {

        const buyer=await Buyer.findById(req.userId);
        res.json({
            success:true,
            buyer
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({success:false,message:"Buyer Profile Error"});
    }
})
const fs = require("fs");

app.put(
  "/api/seller_profile",
  upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "files", maxCount: 10 }
  ]),auth,
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

   app.delete("/api/delete_location_image/:filename",auth, async (req, res) => {
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

app.get("/api/product_views",auth, async (req, res) => {
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
  transports: ['websocket', 'polling'] // Explicitly allow both
});
// Store online users
// Key = Buyer_<id> OR Seller_<id>
const onlineUsers = new Map();

io.on("connection", (socket) => {

  console.log("New socket connected:", socket.id);

  // =========================
  // USER ONLINE
  // =========================
  socket.on("userOnline", ({ userId, userModel }) => {

  if (!userId || !userModel) return;

  const key = `${userModel}_${userId}`;

  onlineUsers.set(key, socket.id);

  socket.join(key); // ✅ IMPORTANT

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

// =========================
// SEND MESSAGE
// =========================
socket.on("sendMessage", async (data) => {
  try {
    const { sender, senderModel, receiver, receiverModel, message,files } = data;
    if (!sender || !receiver || (!message && (!files || files.length===0))) return;

    const room =
      senderModel === "Buyer"
        ? `Buyer_${sender}__Seller_${receiver}`
        : `Buyer_${receiver}__Seller_${sender}`;

    // Save message
    const newMessage = await Message.create({
      sender,
      senderModel,
      receiver,
      receiverModel,
      message:message||"",
      files:files||[],
      room,
      read: false
    });

    // Count unread messages
    const unreadCount = await Message.countDocuments({
      room,
      receiver,
      receiverModel,
      read: false
    });

    const messageData = {
      ...newMessage.toObject(),
      unreadCount
    };

    // Emit message to everyone in room
    io.to(room).emit("receiveMessage", messageData);

    // Emit notification to receiver if online
    const receiverKey = `${receiverModel}_${receiver}`;
    const receiverSocket = onlineUsers.get(receiverKey);
    if (receiverSocket) {
      io.to(receiverSocket).emit("newMessageNotification", {
        room,
        sender,
        senderModel,
        receiver,
        receiverModel,
        message,
        unreadCount,
        createdAt: newMessage.createdAt
      });
    }

  } catch (error) {
    console.error("SendMessage Error:", error);
  }
});

app.post("/api/chat/upload",auth, upload.array("files",10), (req,res)=>{

try{

if(!req.files || req.files.length===0){
return res.json({success:false,message:"No files uploaded"});
}

const fileUrls = req.files.map(file => file.path);

res.json({
success:true,
files:fileUrls
});

}catch(error){

console.log(error);

res.status(500).json({
success:false,
message:"Upload failed"
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
  // =========================
  // USER DISCONNECT
  // =========================
  socket.on("disconnect", () => {

    console.log("Socket disconnected:", socket.id);

    if (socket.userKey) {
      onlineUsers.delete(socket.userKey);
    }

  });

});
// Add this to your server.js
app.get("/api/get_buyer/:id",auth, async (req, res) => {
  try {
    const buyer = await Buyer.findById(req.params.id).select("name profile");
    if (!buyer) return res.json({ success: false, message: "Buyer not found" });
    res.json({ success: true, buyer });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

// GET all conversations for a seller
app.get("/api/seller/conversations",auth, async (req, res) => {
  try {
    const sellerId =req.userId;
    if (!sellerId) return res.status(401).json({ success: false });

    const sellerObjectId = new mongoose.Types.ObjectId(sellerId);

    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: sellerObjectId, senderModel: "Seller" },
            { receiver: sellerObjectId, receiverModel: "Seller" },
          ],
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $addFields: {
          buyerId: {
            $cond: [
              { $eq: ["$senderModel", "Buyer"] },
              "$sender",
              "$receiver",
            ],
          },
          room: {
            $concat: [
              "Buyer_",
              { $cond: [{ $eq: ["$senderModel", "Buyer"] }, { $toString: "$sender" }, { $toString: "$receiver" }] },
              "__Seller_",
              sellerId,
            ],
          },
        },
      },
      {
        $group: {
          _id: "$room",
          lastMessage: { $first: "$message" },
          updatedAt: { $first: "$createdAt" },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$receiver", sellerObjectId] }, { $eq: ["$read", false] }] },
                1,
                0,
              ],
            },
          },
          buyerId: { $first: "$buyerId" },
        },
      },
      {
        $lookup: {
          from: "buyers",
          localField: "buyerId",
          foreignField: "_id",
          as: "buyer",
        },
      },
      { $unwind: "$buyer" },
      {
        $project: {
          _id: 1,
          room: "$_id",
          lastMessage: 1,
          updatedAt: 1,
          unreadCount: 1,
          buyerId: 1,
          buyerName: "$buyer.name",
          buyerProfile: "$buyer.profile",
        },
      },
      { $sort: { updatedAt: -1 } },
    ]);

    res.json({ success: true, conversations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});


// 1. GET messages for a specific room
app.get("/api/messages/:room", async (req, res) => {
  try {
    const messages = await Message.find({ room: req.params.room }).sort({ createdAt: 1 });
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});
app.put("/api/messages/read/:room",auth, async (req, res) => {
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

// In server.js
app.get("/api/get_seller/:id",auth, async (req, res) => {
  const seller = await Seller.findById(req.params.id).select("name profile");
  if (!seller) return res.json({ success: false });
  res.json({ success: true, seller });
});

app.get("/api/buyer/conversations",auth, async (req, res) => {
  try {
    const buyerId = req.userId;

    if (!buyerId) {
      return res.status(401).json({ success: false, message: "Buyer not logged in" });
    }

    const buyerObjectId = new mongoose.Types.ObjectId(buyerId);

    const conversations = await Message.aggregate([
      {
        // Only messages involving this buyer
        $match: {
          $or: [
            { sender: buyerObjectId, senderModel: "Buyer" },
            { receiver: buyerObjectId, receiverModel: "Buyer" }
          ]
        }
      },
      { $sort: { createdAt: -1 } },
      {
        $addFields: {
          // Determine sellerId consistently
          sellerId: {
            $cond: [
              { $eq: ["$senderModel", "Seller"] },
              "$sender",
              "$receiver"
            ]
          },
          // Room always Buyer_<buyerId>__Seller_<sellerId>
          room: {
            $concat: [
              "Buyer_",
              buyerId,
              "__Seller_",
              {
                $cond: [
                  { $eq: ["$senderModel", "Seller"] },
                  { $toString: "$sender" },
                  { $toString: "$receiver" }
                ]
              }
            ]
          }
        }
      },
      {
        $group: {
          _id: "$room", // use directional room string
          lastMessage: { $first: "$message" },
          updatedAt: { $first: "$createdAt" },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$receiver", buyerObjectId] }, { $eq: ["$read", false] }] },
                1,
                0
              ]
            }
          },
          sellerId: { $first: "$sellerId" }
        }
      },
      {
        $lookup: {
          from: "sellers",
          localField: "sellerId",
          foreignField: "_id",
          as: "seller"
        }
      },
      { $unwind: "$seller" },
      {
        $project: {
          _id: 1,
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
    console.error("Buyer Conversations Error:", err);
    res.status(500).json({ success: false });
  }
});

app.post("/api/rate_seller/:sellerId",auth, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const sellerId = req.params.sellerId;

    let existing = await Rating.findOne({
      seller: sellerId,
      buyer: req.userId
    });

    if (existing) {
      existing.rating = rating;
      existing.comment = comment;
      await existing.save();
    } else {
      await Rating.create({
        seller: sellerId,
        buyer: req.userId,
        rating,
        comment
      });
    }

    // Recalculate average rating
    const ratings = await Rating.find({ seller: sellerId });
    const avg = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;

    await Seller.findByIdAndUpdate(sellerId, {
      averageRating: avg,
      numReviews: ratings.length
    });

    // ==========================================
    // REAL-TIME EMIT LOGIC START
    // ==========================================
    const sellerKey = `Seller_${sellerId}`;
    const sellerSocket = onlineUsers.get(sellerKey);

    if (sellerSocket) {
      io.to(sellerSocket).emit("sellerRatingUpdated", {
        sellerId: sellerId,
        averageRating: avg,
        numReviews: ratings.length
      });
    }
    // ==========================================
    // REAL-TIME EMIT LOGIC END
    // ==========================================

    res.json({
      success: true,
      averageRating: avg,
      numReviews: ratings.length
    });
  } catch (err) {
    console.log(err);
    res.json({ success: false });
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

app.post("/api/cart/add",auth, async (req, res) => {
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

app.get("/api/cart",auth, async (req, res) => {
    try {
        const buyer=await Buyer.findById(req.userId).select("profile");
        const cart = await Cart.findOne({ buyer: req.userId })
            .populate("items.product", "name price files location");

        res.json({ success: true, cart,buyer });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

app.put("/api/cart/update",auth, async (req, res) => {
  try {

    const { productId, quantity } = req.body;

    const cart = await Cart.findOne({ buyer: req.userId });

    if (!cart) return res.json({ success:false });

    const item = cart.items.find(
      i => i.product.toString() === productId
    );

    if (!item) return res.json({ success:false });

    item.quantity = quantity;

    cart.totalPrice = cart.items.reduce(
      (acc, item) => acc + item.quantity * item.price, 0
    );

    await cart.save();

    res.json({ success:true, cart });

  } catch (error) {
    res.status(500).json({ success:false });
  }
});

app.get("/api/cart/count",auth, async (req,res)=>{
 try{

   const cart = await Cart.findOne({
     buyer:req.userId
   });

   const count = cart ? cart.items.length : 0;

   res.json({
     success:true,
     count
   });

 }catch(error){
   res.status(500).json({success:false});
 }
});
// ==========================================
//  ORDER MANAGEMENT ROUTES
// ==========================================

// 1. PLACE ORDER (Buyer)
app.post("/api/order",auth, upload.single("paymentProof"), async (req, res) => {
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
      const sellerKey = `Seller_${sellerId}`;
      const sellerSocketId = onlineUsers.get(sellerKey);
      if (sellerSocketId) {
        io.to(sellerSocketId).emit("newOrderNotification", {
          message: `New Order from ${name}!`,
          orderId: newOrder._id,
          total: cart.totalPrice
        });
      }
    });

    // Clear the cart after successful order
    await Cart.findOneAndDelete({ buyer: buyerId });

    res.json({ success: true, message: "Order placed successfully!", orderId: newOrder._id });
  } catch (error) {
    console.error("Order Creation Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// 2. GET SELLER ORDERS
app.get("/api/seller/orders",auth, async (req, res) => {
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


app.put("/api/order/status/:id",auth, async (req, res) => {
  try {
    const sellerId = req.userId;
    if (!sellerId) {
      return res.status(401).json({ success: false, message: "Not authorized" });
    }

    const { status } = req.body;
    const orderId = req.params.id;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // ✅ Check if this seller owns at least one item in the order
    const isSellerOwner = order.items.some(
      item => item.seller.toString() === sellerId
    );

    if (!isSellerOwner) {
      return res.status(403).json({ success: false, message: "Not your order" });
    }

    // ✅ Prevent re-updating
    if (order.status !== "Pending") {
      return res.json({
        success: false,
        message: "Order already handled"
      });
    }

    // ✅ Allow only valid actions
    const allowedStatuses = ["Accepted", "Cancelled"];

    if (!allowedStatuses.includes(status)) {
      return res.json({
        success: false,
        message: "Invalid status"
      });
    }

    order.status = status;
    await order.save();

    // 🔥 REAL-TIME UPDATE TO BUYER
    const buyerKey = `Buyer_${order.buyer}`;
    const buyerSocket = onlineUsers.get(buyerKey);

    if (buyerSocket) {
      io.to(buyerSocket).emit("orderStatusUpdated", {
        orderId: order._id,
        status: order.status
      });
    }

    res.json({
      success: true,
      message: `Order ${status}`
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

app.post("/api/rate_seller",auth, async (req, res) => {
  try {
    const { sellerId, rating, comment } = req.body;
    const buyerId = req.userId;

    if (!buyerId) return res.json({ success: false, message: "Login required" });

    // 1. Save the rating
    const newRating = await Rating.create({
      buyer: buyerId,
      seller: sellerId,
      rating: Number(rating),
      comment
    });

    // 2. RE-CALCULATE (To send fresh data to the dashboard)
    const ratings = await Rating.find({ seller: sellerId });
    const numReviews = ratings.length;
    const averageRating = ratings.reduce((sum, r) => sum + r.rating, 0) / numReviews;

    // 3. SOCKET EMISSION (Real-time update)
    const sellerKey = `Seller_${sellerId}`;
    const sellerSocketId = onlineUsers.get(sellerKey);

    if (sellerSocketId) {
      io.to(sellerSocketId).emit("sellerRatingUpdated", {
        averageRating: Number(averageRating.toFixed(1)),
        numReviews: numReviews
      });
    }

    res.json({ success: true, message: "Rating submitted!" });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

app.get("/test-db", async (req, res) => {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    res.send({ status: "OK", collections });
  } catch (err) {
    res.status(500).send({ status: "ERROR", message: err.message });
  }
});

app.get("/api/buyer_profile",auth, async (req, res) => {
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
    success:false,
    message:"Server error",
    error: err.message
  });
});

// POST: Create a new booking
// Note: "paymentProof" here must match the key used in formData.append() on frontend
app.post("/api/bookService",auth, upload.single("paymentProof"), async (req, res) => {
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

//  SEND REAL-TIME NOTIFICATION TO SELLER
const sellerKey = `Seller_${productData.seller}`;
const sellerSocketId = onlineUsers.get(sellerKey);

if (sellerSocketId) {
  io.to(sellerSocketId).emit("newBookingNotification", {
    message: `New Booking from ${name}!`,
    bookingId: newBooking._id,
    date,
    time
  });
}

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

app.get("/api/seller/bookings",auth, async (req, res) => {
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

// 2. UPDATE booking status
app.put("/api/bookings/:id",auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const sellerId = req.userId;

    if (!sellerId) return res.json({ success: false, message: "Unauthorized" });

    const validStatuses = ["Pending", "Accepted", "Processing", "Shipped", "Delivered", "Cancelled"];
    if (!validStatuses.includes(status)) {
      return res.json({ success: false, message: "Invalid status type" });
    }

    const updatedBooking = await Booking.findOneAndUpdate(
      { _id: id, seller: sellerId },
      { status, seen: true }, 
      { new: true }
    );

    if (!updatedBooking) return res.json({ success: false, message: "Booking not found" });

    res.json({ success: true, booking: updatedBooking });
  } catch (error) {
    res.status(500).json({ success: false, message: "Update Error" });
  }
});

app.put("/api/update_buyer_profile",auth, upload.single("profile"), async (req,res)=>{

try{

const buyerId = req.userId;

const buyer = await Buyer.findById(buyerId);

if(!buyer){
return res.json({success:false});
}

buyer.name = req.body.name;

if(req.body.password){
buyer.password = await bcrypt.hash(req.body.password,10);
}

if(req.file){
buyer.profile = req.file.path;
}

await buyer.save();

res.json({success:true,buyer});

}catch(err){
console.log(err);
res.json({success:false});
}

});
app.delete("/api/cart/remove/:id",auth, async (req, res) => {
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

app.post("/api/seller/mark-activity-read",auth, async (req, res) => {
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

app.post("/api/seller/view/:id",auth, async (req, res) => {
  try {
    const sellerId = req.params.id;
    const buyerId = req.userId;

    if (!buyerId) return res.json({ success: false, message: "Guest view" });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const seller = await Seller.findById(sellerId);
    if (!seller) return res.json({ success: false });

    // Check if there is an entry for today's date
    let todayEntry = seller.dailyViews.find(
      (d) => new Date(d.date).getTime() === today.getTime()
    );

    if (!todayEntry) {
      // First visitor of the day
      seller.dailyViews.push({ date: today, buyers: [buyerId] });
      seller.views += 1;
    } else {
      // Check if THIS buyer has already been counted today
      const hasViewed = todayEntry.buyers.includes(buyerId);
      if (!hasViewed) {
        todayEntry.buyers.push(buyerId);
        seller.views += 1;
      } else {
        // Already counted this buyer today - do nothing
        return res.json({ success: true, message: "Already visited today" });
      }
    }

    await seller.save();
    const sellerKey = `Seller_${sellerId}`;
const sellerSocket = onlineUsers.get(sellerKey);

if (sellerSocket) {
  const todayEntry = seller.dailyViews.find(
    d => new Date(d.date).getTime() === today.getTime()
  );

  io.to(sellerSocket).emit("newView", {
    totalViews: seller.views,
    todayViews: todayEntry ? todayEntry.buyers.length : 0
  });
}
    res.json({ success: true });
  } catch (error) {
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
const PORT = process.env.PORT || 10000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});