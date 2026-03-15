const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');
const express=require("express");
const mongoose=require("mongoose");
const bcrypt=require("bcryptjs");
const session=require("express-session");
const cors=require("cors");
const multer=require("multer");
require("dotenv").config();
const Seller=require("./models/seller");
const Buyer=require("./models/buyer");
const Product=require("./models/product");
const Rating=require("./models/Rating");
const Message = require("./models/Message");
const MongoStore = require("connect-mongo").default || require("connect-mongo");
const Cart = require("./models/Cart");
const Order = require("./models/Order");
const path = require("path");


const app=express();
app.use(cors({
  origin: "https://isonga-frontend.vercel.app",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const { upload } = require('./cloudinary');


app.set("trust proxy", 1);
app.use(session({
    name:"isonga.sid",
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:false,
    store: MongoStore.create({
         mongoUrl: process.env.MONGO_URL,
        collectionName: "sessions"
    }),

    cookie:{
        httpOnly:true,
        secure:true,
        sameSite:"none",
        maxAge:1000*60*30
    }
}))

mongoose.connect(process.env.MONGO_URL)
.then(async () => {
  console.log("✅ Database Connected");
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log("Collections in DB:", collections.map(c => c.name));
})
.catch((error) => console.log("❌ DB connection error:", error));

app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).json({ success: false,message:"Logout Error" });
        res.clearCookie("isonga.sid"); // Use the name you gave your session
        res.json({ success: true });
    });
});

app.post("/api/register",upload.fields([
    {name:"profile",maxCount:1},
    {name:"files",maxCount:5}
]),async(req,res)=>{
    try {
        const{name,location,phone,email,password,repeat_pass,description,category}=req.body;
   let profile = "";
if (req.files && req.files.profile && req.files.profile.length > 0) {
    profile = req.files.profile[0].path;
}

    let files=[];
    if(req.files&&req.files.files){
         files = req.files.files.map(file => file.path);
    }

    const ExistingSeller=await Seller.findOne({email});
    if(ExistingSeller){
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
    const hash=await bcrypt.hash(password,12);

    const phoneRule = /^07\d{8}$/;
    if(!phoneRule.test(phone)){
  return res.json({success:false,message:"Invalid Phone Number"});
}

    await Seller.create({
        name,
        location,
        phone,
        email,
        description,
        password:hash,
        files,
        profile,
        category

    })

    res.json({
        success:true,
        message:"User Registered Successfully"
    })
    } catch (error) {
        console.log(error);
        return res.status(500).json({success:false,message:"Register Error"})
    }
})

app.post("/api/login",async(req,res)=>{
    try {
        const{email,password}=req.body;
    const UserSeller=await Seller.findOne({email});
    if(!UserSeller){
        return res.json({success:false,message:"Invalid Credentials"});
    }

    const compare=await bcrypt.compare(password,UserSeller.password);
    if(!compare){
        return res.json({success:false,message:"Invalid Credentials"});
    }

    if (!email || !password) {
   return res.json({
      success:false,
      message:"Email and Password required"
   })
}

    req.session.sellerId=UserSeller._id;
   const SellerData={
        id:UserSeller._id,
        name:UserSeller.name,
        email:UserSeller.email
    }

    res.json({
        success:true,
        message:"Login Successfully",
        SellerData
    })
    } catch (error) {
        console.log(error);
        return res.status(500).json({success:false,message:"Login Error"});
    }
})

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
    const hash=await bcrypt.hash(password,12);

    let profile="";
    if(req.file){
        profile=req.file.path;
    }

    await Buyer.create({
        name,
        email,
        password:hash,
        profile
    })

    res.json({
        success:true,
        message:"User Registered Successfully"
    })
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, debug: error.message });
    }
})

app.post("/api/buyer_login",async(req,res)=>{
    try {
        const{email,password}=req.body;
    const UserBuyer=await Buyer.findOne({email});
    if(!UserBuyer){
        return res.json({success:false,message:"Invalid Credentials"});
    }

    const compare=await bcrypt.compare(password,UserBuyer.password);
    if(!compare){
        return res.json({success:false,message:"Invalid Credentials"});
    }

    if (!email || !password) {
   return res.json({
      success:false,
      message:"Email and Password required"
   })
}
    req.session.buyerId=UserBuyer._id;
    const BuyerData={
        id:UserBuyer._id,
        name:UserBuyer.name,
        email:UserBuyer.email
    };

    res.json({
        success:true,
        message:"Login SuccessFully",
        BuyerData
    })
    } catch (error) {
        console.log(error);
        return res.status(500).json({success:false,message:"Login Error"});
    }
})

app.post("/api/add_product",upload.array("files",10),async(req,res)=>{
   try {
     if(!req.session.sellerId){
        return res.json({success:false,message:"Seller Not Logged In"});
     }
     const{name,price,location,category,description,quantity}=req.body;

   let files = [];
if(req.files&&req.files.length>0){
    files = req.files.map(file => file.path);
}

    await Product.create({
        name,
        price,
        location,
        files,
        category,
        description,
        quantity,
        seller: req.session.sellerId
    })
    res.json({
        success:true,
        message:"Product Added SuccessFully"
    })
   } catch (error) {
    console.log(error);
    return res.status(500).json({success:false,message:"Add Products Error"});
   }
})

app.get("/api/dashboard", async (req, res) => {
  try {
    const sellerId = req.session.sellerId;
    if (!sellerId) return res.json({ success: false, message: "Not Logged In" });

    const seller = await Seller.findById(sellerId);
    if (!seller) return res.json({ success: false, message: "Seller not found" });

    // 1. CALCULATE ACTUAL RATINGS (Crucial Fix)
    // Assuming you have a Rating model that stores { seller: sellerId, rating: Number }
    const ratings = await Rating.find({ seller: sellerId });
    const numReviews = ratings.length;
    const averageRating = numReviews > 0 
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / numReviews 
      : 0;

    // 2. Calculate Total Sales
    const orders = await Order.find({ "items.seller": sellerId });
    let totalSales = 0;
    orders.forEach(order => {
      order.items.forEach(item => {
        if (item.seller.toString() === sellerId.toString()) {
          totalSales += (item.price * item.quantity);
        }
      });
    });

    // 3. Count Total Orders
    const totalOrders = await Order.countDocuments({ "items.seller": sellerId });

    // 4. Count NEW Orders
    const newOrders = await Order.countDocuments({ 
      "items.seller": sellerId, 
      status: "Pending" 
    });

    // 5. Get Views from Products
    const products = await Product.find({ seller: sellerId });
    const totalViews = products.reduce((sum, p) => sum + (p.views || 0), 0);

    res.json({
      success: true,
      seller: {
        ...seller.toObject(),
        totalSales,
        totalOrders,
        newOrders,
        // Send the freshly calculated rating data
        averageRating: Number(averageRating.toFixed(1)), 
        numReviews: numReviews
      },
      totalViews
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});
app.get("/api/my_store",async(req,res)=>{
 try {
    if(!req.session.sellerId){
        return res.json({success:false,message:"Seller Not Logged In"});
    }

    const products=await Product.find({seller:req.session.sellerId});
    const seller=await Seller.findById(req.session.sellerId).select("name");

    res.json({
        success:true,
        products,
        seller
    })
 } catch (error) {
    console.log(error);
    res.status(500).json({success:false,message:"My Store Error"});
 }
})

app.get("/api/seller_profile", async (req, res) => {
  try {
    if (!req.session.sellerId) {
      return res.json({ success: false, message: "Seller not logged in" });
    }

    // Get seller
    const seller = await Seller.findById(req.session.sellerId);

    if (!seller) {
      return res.json({ success: false, message: "Seller not found" });
    }

    // Get ratings with buyer name AND profile
    const ratings = await Rating.find({ seller: seller._id })
      .populate("buyer", "name profile") // ✅ populate profile too
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
    res.status(500).json({ success: false, message: "Server error" });
  }
});
app.get("/api/buyer_dashboard", async (req, res) => {
  try {
    if (!req.session.buyerId) {
      return res.json({ success: false, message: "Buyer Not Logged In" });
    }

    const buyer = await Buyer.findById(req.session.buyerId);

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
    res.status(500).json({ success: false, message: "Buyer Dashboard Error" });
  }
});

app.get("/api/view_profile/:id", async (req, res) => {
  try {
    if (!req.session.buyerId) {
      return res.json({ success: false, message: "Buyer Not Logged In" });
    }

    const sellerId = req.params.id;

    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return res.json({ success: false, message: "Seller not found" });
    }

    // ✅ POPULATE BUYER NAME
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
    res.status(500).json({ success: false, message: "View Profile Error" });
  }
});

app.get("/api/view_products/:id",async(req,res)=>{
    try {
        if(!req.session.buyerId){
            return res.json({success:false,message:"Buyer Not Logged In"})
        }
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

app.get("/api/sellers/:category", async (req, res) => {
  try {
    // Find sellers by category
    const sellers = await Seller.find({
      category: { $regex: new RegExp("^" + req.params.category + "$", "i") }
    }).select("name location category profile files description"); // only essential fields

    // Fetch buyer info if logged in
    let buyer = null;
    if (req.session.buyerId) {
      buyer = await Buyer.findById(req.session.buyerId).select("name profile");
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

app.delete("/api/products/delete/:productId", async (req, res) => {
  try {
    if (!req.session.sellerId) {
      return res.status(401).json({ success: false, message: "Seller Not Logged In" });
    }

    const productId = req.params.productId;
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ success: false, message: "Product Not Found" });
    }

    // Optional: check seller ownership
    if (product.seller.toString() !== req.session.sellerId) {
      return res.status(403).json({ success: false, message: "You can only delete your own products" });
    }

    await Product.findByIdAndDelete(productId);

    res.json({ success: true, message: "Product Deleted Successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Delete Products Error" });
  }
});

app.put("/api/products/update/:id", upload.array("files", 10), async (req, res) => {
  try {
    if (!req.session.sellerId) {
      return res.json({ success: false, message: "Seller Not Logged In" });
    }

    const productId = req.params.id;
    const product = await Product.findById(productId);
    if (!product) {
      return res.json({ success: false, message: "Product Not Found" });
    }

    if (product.seller.toString() !== req.session.sellerId) {
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
      const newFiles = req.files.map(file => file.filename);
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

app.get("/api/buyer_profile/update",async(req,res)=>{
    try {
        if(!req.session.buyerId){
            return res.json({success:false,message:"Buyer Not Logged In"});
        }

        const buyer=await Buyer.findById(req.session.buyerId);
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
app.put("/api/seller_profile",
  upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "files", maxCount: 10 }
  ]),
  async (req, res) => {
    try {

      if (!req.session.sellerId) {
        return res.json({ success: false, message: "Not Logged In" });
      }

      const seller = await Seller.findById(req.session.sellerId);

      if (!seller) {
        return res.json({ success: false, message: "Seller Not Found" });
      }

      let updatedData = {
        name: req.body.name,
        location: req.body.location,
        phone: req.body.phone,
        description: req.body.description
      };

      // =============================
      // ✅ DELETE OLD PROFILE IMAGE
      // =============================
      if (req.files["profileImage"]) {

        if (seller.profile) {
          const oldPath = path.join(__dirname, "public/uploads", seller.profile);
          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
          }
        }

        updatedData.profile = req.files["profileImage"][0].filename;
      }

      // =============================
      // ✅ APPEND LOCATION IMAGES
      // =============================
      if (req.files["files"]) {

        const newImages = req.files["files"].map(file => file.filename);

        updatedData.files = [...seller.files, ...newImages];
      }

      const updatedSeller = await Seller.findByIdAndUpdate(
        req.session.sellerId,
        updatedData,
        { returnDocument:"after"}
      );

      res.json({ success: true, updatedSeller });

    } catch (error) {
      console.log(error);
      res.status(500).json({ success: false, message: "Update Error" });
    }
});

app.delete("/api/delete_location_image/:filename", async (req, res) => {
  try {

    const { filename } = req.params;

    const seller = await Seller.findById(req.session.sellerId);

    if (!seller) {
      return res.json({ success: false });
    }

    // Remove from database
    await Seller.findByIdAndUpdate(
      req.session.sellerId,
      { $pull: { files: filename } }
    );

    // Remove from folder
    const filePath = path.join(__dirname, "public/uploads", filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ success: true });

  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false });
  }
});



app.get("/api/product_views", async (req, res) => {
  try {
    if (!req.session.sellerId) return res.json({ success: false });

    const products = await Product.find({ seller: req.session.sellerId });

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
    credentials: true
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
    socket.userKey = key;

    console.log("Online Users:", Array.from(onlineUsers.keys()));
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

app.post("/api/chat/upload", upload.array("files",10), (req,res)=>{

try{

if(!req.files || req.files.length===0){
return res.json({success:false,message:"No files uploaded"});
}

const fileUrls = req.files.map(file => "uploads/" + file.filename);

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
app.get("/api/get_buyer/:id", async (req, res) => {
  try {
    const buyer = await Buyer.findById(req.params.id).select("name profile");
    if (!buyer) return res.json({ success: false, message: "Buyer not found" });
    res.json({ success: true, buyer });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

// GET all conversations for a seller
app.get("/api/seller/conversations", async (req, res) => {
  try {
    const sellerId = req.session.sellerId;
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
app.put("/api/messages/read/:room", async (req, res) => {
  try {
    const userId = req.session.sellerId || req.session.buyerId;
    
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
app.get("/api/get_seller/:id", async (req, res) => {
  const seller = await Seller.findById(req.params.id).select("name profile");
  if (!seller) return res.json({ success: false });
  res.json({ success: true, seller });
});

app.get("/api/buyer/conversations", async (req, res) => {
  try {
    const buyerId = req.session.buyerId;

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
app.post("/api/product/view/:productId", async (req, res) => {
  try {
    const { productId } = req.params;
    const buyerId = req.session.buyerId; 
    
    if (!buyerId) return res.json({ success: false, message: "Guest views not tracked uniquely" });

    const product = await Product.findById(productId);
    if (!product) return res.json({ success: false });

    // 1. Get the start of "today" in UTC
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 2. Check if there is an entry for today in dailyViews
    let todayEntry = product.dailyViews.find(v => 
      new Date(v.date).getTime() === today.getTime()
    );

    let isNewViewForToday = false;

    if (!todayEntry) {
      // First person to view this product today
      product.dailyViews.push({ date: today, buyers: [buyerId] });
      isNewViewForToday = true;
    } else if (!todayEntry.buyers.includes(buyerId)) {
      // Buyer has not viewed this product yet today
      todayEntry.buyers.push(buyerId);
      isNewViewForToday = true;
    }

    // 3. Only update the database and notify the seller if it's a new unique view
    if (isNewViewForToday) {
      product.views += 1; 
      await product.save();

      // Recalculate total store views for the real-time dashboard
      const sellerProducts = await Product.find({ seller: product.seller });
      const totalStoreViews = sellerProducts.reduce((sum, p) => sum + (p.views || 0), 0);
      
      const sellerSocket = onlineUsers.get(`Seller_${product.seller}`);
      if (sellerSocket) {
        io.to(sellerSocket).emit("newView", { totalViews: totalStoreViews });
      }
    }

    res.json({ success: true, counted: isNewViewForToday });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

app.post("/api/rate_seller/:sellerId", async (req, res) => {
  try {
    if (!req.session.buyerId) return res.json({ success: false });

    const { rating, comment } = req.body;
    const sellerId = req.params.sellerId;

    let existing = await Rating.findOne({
      seller: sellerId,
      buyer: req.session.buyerId
    });

    if (existing) {
      existing.rating = rating;
      existing.comment = comment;
      await existing.save();
    } else {
      await Rating.create({
        seller: sellerId,
        buyer: req.session.buyerId,
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

app.post("/api/cart/add", async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const buyerId = req.session.buyerId;

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

app.get("/api/cart", async (req, res) => {
    try {
        if (!req.session.buyerId) return res.status(401).json({ success: false });

        const buyer=await Buyer.findById(req.session.buyerId).select("profile");
        const cart = await Cart.findOne({ buyer: req.session.buyerId })
            .populate("items.product", "name price files location");

        res.json({ success: true, cart,buyer });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

app.put("/api/cart/update", async (req, res) => {
  try {

    const { productId, quantity } = req.body;

    const cart = await Cart.findOne({ buyer: req.session.buyerId });

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


app.delete("/api/cart/remove/:productId", async (req,res)=>{
  try{

    const cart = await Cart.findOne({
      buyer:req.session.buyerId
    });

    if(!cart){
      return res.json({success:false});
    }

    cart.items = cart.items.filter(
      item => item.product.toString() !== req.params.productId
    );

    cart.totalPrice = cart.items.reduce(
      (acc,item)=>acc + item.quantity * item.price,
      0
    );

    await cart.save();

    res.json({
      success:true,
      cart
    });

  }catch(error){
    console.log(error);
    res.status(500).json({success:false});
  }
});

app.get("/api/cart/count", async (req,res)=>{
 try{

   const cart = await Cart.findOne({
     buyer:req.session.buyerId
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

// Add this to your server.js
app.post("/api/order", async (req, res) => {
    try {
        if (!req.session.buyerId) {
            return res.status(401).json({ success: false, message: "Please login to place an order" });
        }

        const buyerId = req.session.buyerId;
        // Destructure name from req.body (this is what Mongoose says is missing)
        const { name, phone, address, deliveryMethod, paymentMethod, notes, deliveryDate } = req.body;

        // 1. Get the current cart for this buyer
        const cart = await Cart.findOne({ buyer: buyerId }).populate("items.product");

        if (!cart || cart.items.length === 0) {
            return res.json({ success: false, message: "Your cart is empty" });
        }

        // 2. Create the New Order
        const newOrder = new Order({
            buyer: buyerId,
            name: name,   // <--- THIS IS THE FIX: Explicitly assigning the required 'name'
            phone,
            address,
            deliveryMethod,
            paymentMethod,
            notes,
            deliveryDate,
            items: cart.items.map(item => ({
                product: item.product._id,
                seller: item.product.seller,
                quantity: item.quantity,
                price: item.price
            })),
            totalPrice: cart.totalPrice,
            status: "Pending"
        });

        // 3. Save to Database
await newOrder.save();


// ================================
// REAL-TIME ORDER NOTIFICATION
// ================================
const sellerIds = [...new Set(newOrder.items.map(item => item.seller.toString()))];

sellerIds.forEach(sId => {

  const sellerKey = `Seller_${sId}`;
  const sellerSocketId = onlineUsers.get(sellerKey);

  if (sellerSocketId) {
    io.to(sellerSocketId).emit("newOrderNotification", {
      orderId: newOrder._id,
      message: "You have a new order!"
    });
  }

});


// 4. Clear the cart after successful order
await Cart.findOneAndDelete({ buyer: buyerId });

        res.json({
            success: true,
            message: "Order placed successfully!",
            orderId: newOrder._id
        });

    } catch (error) {
        console.error("Order Error:", error);
        res.status(500).json({ 
            success: false, 
            message: "Failed to place order", 
            error: error.message 
        });
    }
});

app.get("/api/seller/orders", async (req, res) => {
  try {
    if (!req.session.sellerId) {
      return res.status(401).json({ success: false, message: "Seller Not Logged In" });
    }

    // Find orders where at least one item belongs to this seller
    // We populate 'buyer' to get name/phone and 'items.product' for product details
    const orders = await Order.find({ "items.seller": req.session.sellerId })
      .populate("buyer", "name phone")
      .populate("items.product", "name")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      orders
    });
  } catch (error) {
    console.error("Fetch Orders Error:", error);
    res.status(500).json({ success: false, message: "Error fetching orders" });
  }
});

app.post("/api/place_order", async (req, res) => {
  try {
    // ... your existing order creation logic ...
    const order = await Order.create({ ...req.body });

    // 1. Group items by seller (in case of multiple sellers)
    const sellerIds = [...new Set(order.items.map(item => item.seller.toString()))];

    // 2. Notify each seller involved in the order
    sellerIds.forEach(sId => {
      const sellerKey = `Seller_${sId}`;
      const sellerSocketId = onlineUsers.get(sellerKey);

      if (sellerSocketId) {
        io.to(sellerSocketId).emit("newOrderNotification", {
          orderId: order._id,
          message: "You have a new order!"
        });
      }
    });

    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

app.post("/api/rate_seller", async (req, res) => {
  try {
    const { sellerId, rating, comment } = req.body;
    const buyerId = req.session.buyerId;

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

app.get("/api/buyer_profile", async (req, res) => {
  try {
    if (!req.session.buyerId) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const buyer = await Buyer.findById(req.session.buyerId);

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
// START SERVER
// ==============================
const PORT = process.env.PORT || 10000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});