const dns = require("node:dns");
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
const Booking = require("./models/booking");
const jwt = require("jsonwebtoken");
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const Notification = require("./models/Notification");
const rateLimit = require("express-rate-limit");
const Conversation = require("./models/Conversation");
const verifyEmailTemplate = require("./utils/emailTemplates.js");
const path=require("path");
// Creating App
const app = express();

app.set("trust proxy", 1);
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map(origin => origin.trim())
  : [
      "https://isongamarket.com",
      "https://www.isongamarket.com",
      "http://localhost:5173",
    ];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.log("Blocked origin:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

const httpServer = require("http").createServer(app);
const { Server } = require("socket.io");

const io = new Server(httpServer, {
  cors: {
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      console.log("Blocked origin",origin);
    return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  },
  transports: ["websocket", "polling"]
});
// Define How Data Are Sent
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Login limiter (define FIRST)
const { ipKeyGenerator } = require('express-rate-limit');

const ipLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100,
  message: {
    success: false,
    message: "Too many requests from this IP, try later"
  },
  keyGenerator: (req) => ipKeyGenerator(req), 
});

const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10, // strict for login
  message: {
    success: false,
    message: "Too many login attempts for this account try again later"
  },
 keyGenerator: (req) => {
  if (!req.body?.email){
    return ipKeyGenerator(req);
  }
  return req.body.email.toLowerCase();
}
});
app.use("/api", ipLimiter);
// Store Uploads
const { cloudinary, upload } = require("./cloudinary");

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
  })
  .catch((error) => console.log(" DB connection error:", error));
// Seller Register with Email Verification
app.post("/api/register", upload.fields([
  { name: "profile", maxCount: 1 },
  { name: "files", maxCount: 6 }
]), async (req, res) => {
  try {
    const { name, location, phone, email, password, description, category, sellerType,repeat_pass } = req.body;
if(!name||!location||!phone||!email||!password||!description||!category||!sellerType||!repeat_pass){
  res.json({
    success:false,
    message:"All Field Required please"
  })
  return
}
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if(!emailRegex.test(email)){
  return res.json({success:false,message:"Invalid Email Try Again"})
}
    // 1. Basic Checks
    const existingSeller = await Seller.findOne({ email });
    if (existingSeller) {
      return res.json({ success: false, message: "User Already Exists" });
    }
      
    const profileMaxSize = 5 * 1024 * 1024;
    if (!req.files || !req.files.profile) {
      return res.status(400).json({ success: false, message: "Profile image required" });
    }
     const profileFile = req.files.profile[0];
     if (profileFile.size > profileMaxSize) {
  return res.json({
    success: false,
    message: "Profile image: 5MB Max Allowed"
  });
}
if(!profileFile.mimetype.startsWith("image/")){
  return res.json({success:false,message:"Only Images Allowed"});
}
const profile = profileFile.path;

const fileSize = 10 * 1024 * 1024; // 10MB

if (!req.files || !req.files.files || req.files.files.length < 2) {
  return res.status(400).json({
    success: false,
    message: "Location Images Required (min 2)"
  });
}
if(req.files.files.length>6){
  return res.json({
    success:false,
   message: "You can upload a maximum of 6 files only"
  })
}
for (let file of req.files.files) {
  if (file.size > fileSize) {
    return res.json({
      success: false,
      message: `Each file must be under 10MB`
    });
  }
}

for(let file of req.files.files){
  if(!file.mimetype.startsWith("image/")){
    return res.json({success:false,message:"Only Images Required"})
  }
}

// extract paths
const files = req.files.files.map(f => f.path);
 const rule = /^(?=.{10,})(?:(?=.*[a-z])(?=.*[A-Z])(?=.*\d)|(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9])|(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9])|(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])).*$/;
     if(!rule.test(password)){
      return res.json({success:false,message:"Please use strong password"})
     }

     if(password!==repeat_pass){
      return res.json({success:false,message:"Password Must Much"});
     }
     const regex = /^(07(8|9|2|3)\d{7})$/;
     if(!regex.test(phone)){
      return res.json({success:false,message:"Invalid Phone Number"});
     }
    // 2. Prepare Data
    const hash = await bcrypt.hash(password, 12);
   
    // 3. Generate 6-Digit Code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

   const { data, error } = await resend.emails.send({
  from: "Isonga Market <noreply@isongamarket.com>",
  to: email,
  subject: "Verify Your Isonga Seller account",
  html: verifyEmailTemplate(name, code),
});
    if (error) {
      console.error(" Resend Error:", error);
      return res.status(500).json({ success: false, message: "Email service failed" });
    }

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
      isVerified: false, 
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


app.post("/api/seller-verify-email",async(req,res)=>{
  try {
    const {email,code}=req.body;
    if(!code){
      return res.json({success:false,message:"Code Required Please!"})
    }
    const inputCode=String(code).trim();
    let seller=await Seller.findOne({email});
    if(!seller){
      return res.json({success:false,message:"Seller  Not Found"});
    }

    if(seller.verificationCode!==inputCode){
      return res.json({success:false,message:"Invalid Code Try Again"});
    }
    if(seller.verificationExpires<Date.now()){
      return res.json({success:false,message:"Code Expired"});
    }

    await Seller.findOneAndUpdate(
      {email},
      {
        $set:{
          isVerified:true,
          verificationCode:null,
          verificationExpires:null
        }
      },
      {new:true}
    );

    res.json({success:true});
  } catch (error) {
    console.log("email error",error);
    res.json({success:false,message:"Email Verifying Error"});
  }
})


app.post("/api/seller-resend-verification", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.json({ success: false, message: "Email Required" });
    }

    const seller = await Seller.findOne({ email });
    if (!seller) {
      return res.json({ success: false, message: "Seller Not Found" });
    }

    if (seller.isVerified) {
      return res.json({ success: false, message: "User Verified. Login Please!" });
    }

    // Rate limiting check 
    if (
      seller.lastVerificationSent &&
      Date.now() - seller.lastVerificationSent < 60000
    ) {
      return res.status(429).json({
        success: false,
        message: "Please wait  before requesting again"
      });
    }

    // Generate new code
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    await Seller.findOneAndUpdate(
  { email },
  {
    $set: {
      verificationCode: newCode,
      verificationExpires: Date.now() + 10 * 60 * 1000,
      lastVerificationSent: Date.now(),
    }
  },
  {new:true}
);

    // Send email using the CORRECT variables
    const { error } = await resend.emails.send({
      from: "Isonga Market <noreply@isongamarket.com>",
      to: email,
      subject: "Your New Verification Code",
      // FIXED: Using seller.name and the newCode variable defined above
      html: verifyEmailTemplate(seller.name || "Seller", newCode), 
    });

    if (error) {
      console.error("Resend Email Error:", error);
      return res.status(500).json({ success: false, message: "Email service failed" });
    }

    return res.json({
      success: true,
      message: "New verification code sent successfully!"
    });

  } catch (error) {
    console.error("Resend Route Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});


app.post("/api/login", emailLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if(!email||!password){
      return res.json({success:false,message:"All Fields Required"})
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!emailRegex.test(email)){
      return res.json({success:false,message:"Invalid Email Try Again"});
    }
    const user = await Seller.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "Invalid Credentials" });
    }
    
      if(user.lockUntil&&user.lockUntil>Date.now()){
      const remaining=Math.floor((user.lockUntil-Date.now())/1000);
      const minutes=Math.floor(remaining/60);
      const seconds=remaining%60;
      return res.json({
        success:false,
        message:`Account Locked For ${minutes}m ${seconds}s`,
        remaining
      })
    }
      const match = await bcrypt.compare(password, user.password);
    if (!match) {
      user.failedAttempts+=1;
       const maxAttempts=5;
       const lockDuration=5*60*1000
       let attemptsLeft=maxAttempts-user.failedAttempts;
      if(user.failedAttempts>=maxAttempts){
        user.lockUntil=Date.now()+lockDuration;
        user.failedAttempts=0;
        attemptsLeft=0;
      }
      await user.save();

      return res.json({
        success:false,
        message:attemptsLeft<=0
        ?"Too many attempts. Please try again later."
        :`Invalid credentials. Attempts left: ${attemptsLeft}`,
        remaining:attemptsLeft<=0
        ?Math.ceil(lockDuration/1000)
        :null
      })
    }
     
    user.failedAttempts=0;
    user.lockUntil=null;
    await user.save();
    if(!user.isVerified){
      return res.json({success:false,message:"User Email Not Verified"});
    }
    //  CREATE TOKEN
    const token = jwt.sign(
      { 
        id: user._id,
         role:user.role
        },
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
        isVerified: user.isVerified,
        role:user.role
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: "Login Error" });
  }
})

app.post("/api/buyer_register", upload.single("profile"), async (req, res) => {
  try {
    const { name, email, password,repeat_pass} = req.body;
   if (!name || !email || !password || !repeat_pass) {
  res.json({ success: false, message: "All Fields Required" });
  return;
}
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if(!emailRegex.test(email)){
  return res.json({success:false,message:"Invalid Email Try Again"});
}
    const ExistingBuyer = await Buyer.findOne({ email });
    if (ExistingBuyer) {
      return res.json({ success: false, message: "User Already Exist" });
    }
    if(!req.file){
      return res.json({success:false,message:"Profile Image Required"});
    }
    const maxSize = 5 * 1024 * 1024;
    const profileImage=req.file;

    if (profileImage.size > maxSize) {
      return res.json({
        success: false,
        message: "Maximum file size is 5MB"
      });
    }

    if(!profileImage.mimetype.startsWith("image/")){
      return res.json({
        success:false,
        message:"Only Image required"
      })
    }
   const profile=profileImage.path;
     const rule = /^(?=.{10,})(?:(?=.*[a-z])(?=.*[A-Z])(?=.*\d)|(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9])|(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9])|(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])).*$/;
     if(!rule.test(password)){
      return res.json({success:false,messa:"Please use strong password"})
     }

     if(password!==repeat_pass){
      return res.json({success:false,message:"Password Must Much"});
     }
     
    // ... Keep your password regex and hashing logic here ...
    const hashed = await bcrypt.hash(password, 12);

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // SEND EMAIL USING API (NOT SMTP)
    const { data, error } = await resend.emails.send({
      from: 'Isonga Market <noreply@isongamarket.com>', // Use this default sender for testing
      to: email,
      subject: 'Verify your Isonga Buyer Account',
      html: verifyEmailTemplate(name, code),
    });

    if (error) {
      console.error(" Resend Error:", error);
      return res.status(500).json({ success: false, message: "Email failed" });
    }

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
    console.error(" REGISTER ERROR:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
});


app.post("/api/buyer-verify-email",async(req,res)=>{
  try {
    const{email,code}=req.body;
    if(!code){
      res.json({success:false,message:"Code Required Please!"});
    }
    const inputCode=String(code).trim();
    let buyer=await Buyer.findOne({email});
    if(!buyer){
      return res.json({success:false,message:"Buyer Not Found"});
    }

    if(buyer.verificationCode!==inputCode){
      return res.json({success:false,message:"Invalid Code"});
    }
    if(buyer.verificationExpires<Date.now()){
      return res.json({success:false,message:"Code Expired"});
    }
    await Buyer.findOneAndUpdate(
      {email},
      {
        $set:{
          isVerified:true,
          verificationCode:null,
          verificationExpires:null
        }
      },
      {new:true}
    );
    
    res.json({success:true});
  } catch (error) {
    console.log(error);
    res.json({success:false,message:"Email Server Verifying Error"})
  }
})

app.post("/api/buyer-resend-verification", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.json({ success: false, message: "Email Required" });
    }

    const buyer = await Buyer.findOne({ email });
    if (!buyer) {
      return res.json({ success: false, message: "Buyer Not Found" });
    }

    if (buyer.isVerified) {
      return res.json({ success: false, message: "User Verified. Login Please!" });
    }

    // Rate limiting: 60 seconds 
    if (
      buyer.lastVerificationSent &&
      Date.now() - buyer.lastVerificationSent < 60000
    ) {
      return res.status(429).json({
        success: false,
        message: "Please wait 60 seconds before requesting again"
      });
    }

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();

await Buyer.findOneAndUpdate(
  { email },
  {
    $set: {
      verificationCode: newCode,
      verificationExpires: Date.now() + 10 * 60 * 1000, // 10 minutes
      lastVerificationSent: Date.now()
    }
  },
  {new:true}
);

    // FIXED: Use buyer.name and newCode (matching your variables)
    const { error } = await resend.emails.send({
      from: "Isonga Market <noreply@isongamarket.com>",
      to: email,
      subject: "Your New Verification Code",
      html: verifyEmailTemplate(buyer.name || "Valued Buyer", newCode), 
    });

    if (error) {
      console.error("Resend Error:", error);
      return res.json({ success: false, message: "Email service failed" });
    }

    return res.json({
      success: true,
      message: "New verification code sent successfully!"
    });

  } catch (error) {
    console.error("Full Error Stack:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.post("/api/buyer_login", emailLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if(!email||!password){
      return res.json({success:false,message:"All fields Required"});
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!emailRegex.test(email)){
      return res.json({success:false,message:"Invalid Email Try Again"})
    }
    const user = await Buyer.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "Invalid Credentials" });
    }
    if(user.lockUntil&&user.lockUntil>Date.now()){
      const remaining=Math.ceil((user.lockUntil-Date.now())/1000);
      const minutes=Math.floor(remaining/60);
      const seconds=remaining%60;
      return res.json({
        success:false,
        message:`Account Locked for ${minutes}m ${seconds}s`,
        remaining
      })
    }
      const match = await bcrypt.compare(password, user.password);
    if (!match) {
      const maxAttempts=5;
      const lockDuration=5*60*1000;
      let attemptsLeft=maxAttempts-user.failedAttempts;
      user.failedAttempts+=1;
      if(user.failedAttempts>=maxAttempts){
        user.lockUntil=Date.now()+lockDuration;
        user.failedAttempts=0;
        attemptsLeft=0;
      }
     await user.save();
     return res.json({
      success:false,
      message:attemptsLeft<=0
      ?"Too many attempts. Please try again later."
      :`Invalid credentials. Attempts left:${attemptsLeft}`,
      remaining:attemptsLeft<=0
      ?Math.ceil(lockDuration/1000)
      :null
     });
    };
   
    if(!user.isVerified){
      return res.json({success:false,message:"User Email Not Verified"});
    }
     user.failedAttempts=0;
    user.lockUntil=null;

    await user.save();
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
        isVerified: user.isVerified,
        role:user.role
      }
    });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

app.post("/api/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!emailRegex.test(email)){
      return res.json({success:false,message:"Invalid Email Try Again"});
    }

    // 1. Find buyer
    const buyer = await Buyer.findOne({ email });

    if (!buyer) {
      return res.json({
        success: false,
        message: "No account found with this email"
      });
    }

    // 2. Generate OTP
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    await Buyer.findOneAndUpdate(
      {email},
      {
        $set:{
          verificationCode:resetCode,
          verificationExpires:Date.now() + 5 * 60 * 1000,
          lastVerificationSent:Date.now(),
        }
      },
      {new:true}
    )
    // 4. Safe name fallback
    const name = buyer.name || "User";

    // 5. Send email
    await resend.emails.send({
      from: "Isonga Market <noreply@isongamarket.com>",
      to: email,
      subject: "Isonga Buyer Password Reset",
      html: verifyEmailTemplate(name, resetCode),
    });

    res.json({
      success: true,
      message: "Reset code sent to your email"
    });

  } catch (error) {
    console.error("Forgot password error:", error);

    res.status(500).json({
      success: false,
      message: "Error sending email"
    });
  }
});

app.post("/api/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if(!code){
      return res.json({success:false,message:"Code Required Please!"})
    }
    const inputCode = String(code).trim();

    // 1. Find user first (to validate)
    const user = await Buyer.findOne({ email });

    if (user.verificationCode !== inputCode||!user) {
      return res.json({ success: false, message: "Invalid code or User not found" });
    }

    if (user.verificationExpires < Date.now()) {
      return res.json({ success: false, message: "Code expired" });
    }
    const rule = /^(?=.{10,})(?:(?=.*[a-z])(?=.*[A-Z])(?=.*\d)|(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9])|(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9])|(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])).*$/;
     if(!rule.test(newPassword)){
      return res.json({success:false,messa:"Please use strong password!"})
     }
    if (!newPassword) {
      return res.json({ success: false, message: "New Password Required" });
    }

    const hashedPassword = await bcrypt.hash(newPassword,12);

    // 3. Update using findOneAndUpdate
    await Buyer.findOneAndUpdate(
      { email },
      {
        $set: {
          password: hashedPassword,
          verificationCode: null,
          verificationExpires: null,
          lastVerificationSent:null
        }
      },
      {new:true}
    );

    res.json({ success: true, message: "Password updated successfully!" });

  } catch (error) {
    console.log("reset error:", error);
    res.status(500).json({ success: false, message: "Reset failed" });
  }
});

app.post("/api/verify-reset-code", async (req, res) => {
  const { email, code } = req.body;
  const user = await Buyer.findOne({ email, verificationCode: code }) ||
    await Seller.findOne({ email, verificationCode: code });

  if(!user){
    return res.json({
      success:false,
      message:"User not found!"
    })
  }
  if(user.verificationExpires<Date.now()){
    return res.json({
      success:false,
      message:"Code Expired"
    })
  }
  res.json({ success: true }); // Move to step 3
});

app.post("/api/add_product", upload.array("files", 10), auth, async (req, res) => {
  try {

    const { type, name, price, description, quantity } = req.body;

   let files = [];

const maxSize = 20 * 1024 * 1024; // 20MB

// 2. Check individual file sizes
if (req.files && req.files.length > 0) {
  for (let file of req.files) {
    if (file.size > maxSize) {
      return res.json({ 
        success: false, 
        message: `File ${file.originalname} is too large. Max 20MB per file.` 
      });
    }
  }

  if(req.files.length>10){
    return res.json({
      success:false,
      message:"Only 10 Files Allowed"
    })
  }

  for(let file of req.files){
   if(!file.mimetype.startsWith("image/")&&!file.mimetype.startsWith("video/")){
    return res.json({
      success:false,
      message:"Only Images And videos required"
    })
   }
  }
  // 3. If all sizes are okay, map the paths
  files = req.files.map(file => file.path);
}

await Product.create({
  seller: req.userId,
  type,
  name,
  price,
  description,
  quantity,
  files // Array of paths
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
    if (!sellerId) {
      return res.json({ success: false, message: "Not Logged In" });
    }

    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return res.json({ success: false, message: "Seller not found" });
    }

    // -----------------------------
    // 1. Total Items (Products/Services/Assets)
    // -----------------------------
    const totalItemsCount = await Product.countDocuments({
      seller: sellerId,
      type: seller.sellerType,
    });

    // -----------------------------
    // 2. Ratings
    // -----------------------------
    const ratings = await Rating.find({ 
      seller: sellerId
     });
    const numReviews = ratings.length;

    const totalRating=ratings.reduce((sum,item)=>{
      return sum+item.rating
    },0);


    const averageRating =numReviews > 0
        ? totalRating/numReviews
        : 0;

    let totalActivityCount = 0;
    let newActivityCount = 0;

    if (seller.sellerType === "Service") {
      // BOOKINGS (Service sellers)
      const bookings = await Booking.find({ seller: sellerId });

      totalActivityCount = bookings.length;

      newActivityCount = bookings.reduce((count, b) => {
        return count + (b.status === "Pending" ? 1 : 0);
      }, 0);

    } else {
      // ORDERS (Product/Asset sellers)

      const orders = await Order.find({ "items.seller": sellerId });

      totalActivityCount = orders.length;

      // IMPORTANT FIX: item-level counting (NOT order.status)
      newActivityCount = 0;

      orders.forEach(order => {
        order.items.forEach(item => {
          if (
            item.seller.toString() === sellerId.toString() &&
            item.status === "Pending"
          ) {
            newActivityCount++;
          }
        });
      });
    }

    // -----------------------------
    // 4. Views
    // -----------------------------
    const totalViews = seller.views || 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayEntry = seller.dailyViews.find(d =>
      new Date(d.date).toDateString() === today.toDateString()
    );

    const todayViews = todayEntry ? todayEntry.buyers.length : 0;

    // -----------------------------
    // RESPONSE
    // -----------------------------
    return res.json({
      success: true,
      seller: {
        ...seller.toObject(),
        totalOrders: totalActivityCount,
        newOrders: newActivityCount, // ✔ now correct item-based count
        averageRating: Number(averageRating.toFixed(1)),
        numReviews,
        totalItemsCount,
      },
      totalViews,
      todayViews,
    });

  } catch (err) {
    console.error("Dashboard Error:", err);
    return res.status(500).json({
      success: false,
      message: "Dashboard Internal Server Error",
    });
  }
});

app.get("/api/my_store", auth, async (req, res) => {
  try {
    const sellerId=req.userId;

    const products = await Product.find({ seller: sellerId });
    const seller = await Seller.findById(sellerId).select("name");

    if(!products){
      return res.json({
        success:false,
        messsage:"Products Not Found!"
      })
    }

    if(!seller){
      return res.json({
        success:false,
        message:"Seller not found!"
      })
    }

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

app.post("/api/seller/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!emailRegex.test(email)){
      return res.json({success:false,message:"Invalid Email Try Again"});
    }

    const seller = await Seller.findOne({ email });

    if (!seller) {
      return res.json({
        success: false,
        message: "No seller account found with this email"
      });
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    await Seller.findOneAndUpdate(
      {email},
      {
        $set:{
          verificationCode:resetCode,
          verificationExpires:Date.now() + 5 * 60 * 1000
        }
      },
      {new:true}
    );

    const name = seller.name || "Seller";

    await resend.emails.send({
      from: "Isonga Market <noreply@isongamarket.com>",
      to: email,
      subject: "Seller Password Reset",
      html: verifyEmailTemplate(name, resetCode),
    });

    res.json({
      success: true,
      message: "Code sent to seller email"
    });

  } catch (error) {
    console.error("Forgot password error:", error); 
    res.status(500).json({
      success: false,
      message: "Error sending email"
    });
  }
});
app.post("/api/seller/verify-reset-code", async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!code) {
      return res.json({
        success: false,
        message: "Code Required"
      });
    }

    const seller = await Seller.findOne({
      email,
      verificationCode: String(code).trim()
    });

    if (!seller) {
      return res.json({
        success: false,
        message: "Invalid code"
      });
    }

    if (seller.verificationExpires < Date.now()) {
      return res.json({
        success: false,
        message: "Code expired"
      });
    }

    res.json({ success: true });

  } catch (err) {
    console.log(err);

    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});
app.post("/api/seller/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    const seller = await Seller.findOne({ email, verificationCode: code });
    if (!seller || seller.verificationExpires < Date.now()) {
      return res.json({ success: false, message: "Invalid or expired code" });
    }

    const rule = /^(?=.{10,})(?:(?=.*[a-z])(?=.*[A-Z])(?=.*\d)|(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9])|(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9])|(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])).*$/;
     if(!rule.test(newPassword)){
      return res.json({success:false,messa:"Please use strong password"})
     }
     if(!newPassword){
      return res.json({success:false,message:"New Password Required!"})
     }
    const hashedPassword = await bcrypt.hash(newPassword,12);

    await Seller.findOneAndUpdate(
      { _id: seller._id }, 
      { 
        $set: { 
          password: hashedPassword,
          verificationCode: null,
          verificationExpires: null 
        } 
      },
      {new:true}
    );

    res.json({ success: true, message: "Seller password updated!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Reset failed" });
  }
});

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
      const numReviews=ratings.length
      const totalRating=ratings.reduce((sum,r)=>{
        return sum+r.rating
      },0)

      const averageRating=numReviews>0
      ?totalRating/numReviews
      :0
  
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
    
    const buyer = await Buyer.findById(req.userId).select("name profile");

    if (!buyer) {
      return res.status(404).json({ success: false, message: "Buyer not found" });
    }

    // 2. Fetch all sellers
    const sellers = await Seller.find().select(
      "name location category profile files description"
    );

    if(!sellers){
      return res.json({
        success:false,
        message:"Sellers not found!"
      })
    }
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

    const ratings = await Rating.find({ seller: sellerId })
      .populate("buyer", "name profile");

     const numReviews = ratings.length;

    const averageRating = numReviews>0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
      : 0;

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

    const updatedSeller = await Seller.findByIdAndUpdate(
      sellerId,
      {
         $inc: { views: 1 } 
        },
      { new: true }
    );

    if (!updatedSeller) {
      return res.status(404).json({ success: false, message: "Seller not found" });
    }

    // 2. FETCH PRODUCTS
    const products = await Product.find({ seller: sellerId });

    if(!products){
      return res.json({
        success:false,
        message:"Products not found!"
      })
    }

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

    const updatedSeller=await Seller.findByIdAndUpdate(
      sellerId,
      {
        $inc:{
          views:1
        }
      },
      {new:true}
    )
    if(!updatedSeller){
      return res.json({
        success:false,
        message:"Seller Not Found"
      })
    }

    const products = await Product.find({ seller: sellerId });

    if(!products){
      return res.json({
        success:false,
        message:"Products not found !"
      })
    }
    const sellerRoom = `Seller_${sellerId}`;
    
    // This sends the updated count to the Seller's dashboard immediately
    io.to(sellerRoom).emit("viewUpdate", {
      totalViews: updatedSeller.views,
      timestamp: new Date()
    });
    res.json({
      success: true,
      seller:updatedSeller,
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
   const updatedSeller = await Seller.findByIdAndUpdate(
      sellerId,
      {
         $inc: {
           views: 1 
          } 
        },
      { new: true }
    );

    if (!updatedSeller) {
      return res.status(404).json({ success: false, message: "Seller not found" });
    }

    // 2. FETCH PRODUCTS
    const products = await Product.find({ seller: sellerId });

    if(!products){
      return res.json({
        success:false,
        message:"Products not found!"
      })
    }
    // 3. EMIT REAL-TIME UPDATE TO SELLER
    const sellerRoom = `Seller_${sellerId}`;
    
    // This sends the updated count to the Seller's dashboard immediately
    io.to(sellerRoom).emit("viewUpdate", {
      totalViews: updatedSeller.views,
      timestamp: new Date()
    });

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

    if(!req.userId){
      return res.json({
        success:false,
        message:"Buyer not found !"
      })
    }

    // Attach ratings to each seller
    const sellersWithRatings = await Promise.all(
      sellers.map(async (seller) => {
        const ratings = await Rating.find({ seller: seller._id });
         const numReviews = ratings.length;
        const averageRating = ratings.length
          ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
          : 0;

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

app.get("/api/buyer_profile/update", auth, async (req, res) => {
  try {

    const buyer = await Buyer.findById(req.userId);
    if(!buyer){
      return res.json({
        success:false,
        message:"Buyer not found!"
      })
    }
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
      const regex = /^(07(8|9|2|3)\d{7})$/;

if (!regex.test(req.body.phone)) {
  return res.json({ success: false, message: "Invalid Phone Number" });
}
      //  BASIC DATA
      let updatedData = {
        name: req.body.name,
        location: req.body.location,
        phone: req.body.phone,
        description: req.body.description
      };

      // =============================
      //  UPDATE PROFILE IMAGE
      // =============================
      if (req.files && req.files["profileImage"]) {
        const profileFile=req.files["profileImage"][0];
         if(!profileFile.mimetype.startsWith("image/")){
        return res.json({
          success:false,
          message:"Only Image required!"
        })
      }
      updatedData.profile =profileFile.path; //  FIXED
      }
      // =============================
      //  ADD LOCATION IMAGES
      // =============================
      if (req.files && req.files["files"]) {
        const newImages = req.files["files"].map(file => file.path); //  FIXED
        
      for(const file of req.files["files"]){
        if(!file.mimetype.startsWith("image/")){
        return res.json({
          success:false,
          message:"Only Images required"
        })
      }
      }
       if(req.files["files"].length>10){
        return res.json({
          success:false,
          message:"Max Uploads 10 files"
        })
      }

        updatedData.files = [
          ...(seller.files || []),
          ...newImages
        ];
      }

      // =============================
      //  SAVE UPDATE
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

app.delete("/api/delete_location_image/:public_id", auth, async (req, res) => {
  try {
    const { public_id } = req.params;

    const seller = await Seller.findById(req.userId);

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller Not Found"
      });
    }

    // 1. Delete from Cloudinary
    await cloudinary.uploader.destroy(public_id, {
      resource_type: "image"
    });

    // 2. Remove from MongoDB
    await Seller.findByIdAndUpdate(
      req.userId,
      {
        $pull: {
           files: public_id 
          }
      }
    );

    res.json({
      success: true,
      message: "Image deleted successfully"
    });

  } catch (error) {
    console.log("DELETE ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

app.get("/api/product_views", auth, async (req, res) => {
  try {
    const result = await Product.aggregate([
      {
        $match: { seller: req.userId } // filter seller's products
      },
      {
        $group: {
          _id: null,
          totalViews: { $sum: "$views" }
        }
      }
    ]);

    const totalViews = result.length > 0 ? result[0].totalViews : 0;

    res.json({
      success: true,
      totalViews
    });

  } catch (error) {
    console.log("PRODUCT VIEWS ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
});

// Store online users
// Key = Buyer_<id> OR Seller_<id>
const onlineUsers = new Map();
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) return next(new Error("Unauthorized"));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    socket.userId = decoded.id; //  REQUIRED

    next();
  } catch (err) {
    next(new Error("Invalid token"));
  }
});
io.on("connection", (socket) => {

  console.log("New socket connected:", socket.id);
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

  console.log(" LIVE DASHBOARD ACTIVE:", key);
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

      // 4.  NEW: Count TOTAL unread messages for THIS USER (for the dashboard bubble)
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
      
      //  TARGET THE ROOM (More reliable than onlineUsers Map)
      // Since your userOnline logic joins socket.join(key), we can emit directly to the room
      io.to(receiverKey).emit("newMessageNotification", {
        room,
        sender,
        senderModel,
        receiver,
        receiverModel,
        message: message || "Sent an attachment",
        unreadChatCount: totalUnreadMessages,
         //  PASSING THE TOTAL COUNT 
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

      // 5.  DELETE FILTER: Remove if seller ID is in deletedFor array
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

// GET /api/buyer/conversations
app.get("/api/buyer/conversations", auth, async (req, res) => {
  try {
    const buyerObjectId = new mongoose.Types.ObjectId(req.userId);

    const conversations = await Message.aggregate([
      // 1. Get messages related to this buyer
      {
        $match: {
          $or: [
            { sender: buyerObjectId, senderModel: "Buyer" },
            { receiver: buyerObjectId, receiverModel: "Buyer" }
          ]
        }
      },

      { $sort: { createdAt: -1 } },

      // 2. Group into conversations and identify the Seller
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

      // 3. Join conversation table for deletion checks
      {
        $lookup: {
          from: "conversations",
          localField: "_id",
          foreignField: "room",
          as: "conv"
        }
      },
      {
        $addFields: {
          conv: { $arrayElemAt: ["$conv", 0] }
        }
      },

      // 4. Filter out conversations deleted by the buyer
      {
        $match: {
          $expr: {
            $not: {
              $in: [
                buyerObjectId,
                { $ifNull: ["$conv.deletedFor", []] }
              ]
            }
          }
        }
      },

      // 5. Lookup Seller details
      {
        $lookup: {
          from: "sellers",
          localField: "sellerId",
          foreignField: "_id",
          as: "seller"
        }
      },
      { $unwind: { path: "$seller", preserveNullAndEmptyArrays: true } },

      // 6. Final Shape
      {
        $project: {
          _id: 0,
          room: "$_id",
          lastMessage: 1,
          updatedAt: 1,
          unreadCount: 1,
          roomUnreadCount: "$unreadCount", // For socket consistency
          sellerId: 1,
          sellerName: { $ifNull: ["$seller.name", "Unknown Seller"] },
          sellerProfile: { $ifNull: ["$seller.profile", ""] }
        }
      },
      { $sort: { updatedAt: -1 } }
    ]);

    res.json({ success: true, conversations });
  } catch (err) {
    console.error("Buyer Conversation Error:", err);
    res.status(500).json({ success: false });
  }
});
// GET all sellers for public home
app.get("/api/home_sellers", async (req, res) => {
  try {
    const sellers = await Seller.find().select(
      "name location category profile files description"
    );
    if(!sellers){
      return res.json({
        success:false,
        message:"Sellers not found"
      })
    }
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
      return res.status(401).json({ success: false, message: "Buyer Not Found" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.json({ success: false, message: "Product unavailable" });
    }

    if(product.quantity < quantity){
            return res.json({ success: false, message: "insufficient stock" });
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
    const buyer = await Buyer.findById(req.userId).select("name phone profile");

    if(!buyer){
      return res.json({
        success:false,
        message:"Buyer not found"
      })
    }

    const cart = await Cart.findOne({ buyer: req.userId })
      .populate({
        path: "items.product",
        select: "name price files location seller",
        populate: {
          path: "seller",
          select: "phone name"
        }
      });

    if (!cart || cart.items.length === 0) {
      return res.json({ success: true, cart: null });
    }

    const sellersMap = new Map();

    cart.items.forEach(item => {
      if (!item.product || !item.product.seller) return;

      const seller = item.product.seller;
      const sellerId = seller._id ? seller._id.toString() : seller.toString();

      if (!sellersMap.has(sellerId)) {
        sellersMap.set(sellerId, {
          _id: seller._id,
          name: seller.name,
          phone: seller.phone
        });
      }
    });

    const sellers = Array.from(sellersMap.values());

    res.json({ success: true, cart, buyer, sellers });

  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false });
  }
});

app.put("/api/cart/update", auth, async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    if (quantity < 1) {
      return res.json({ success: false, message: "Invalid quantity" });
    }

    const cart = await Cart.findOne({ buyer: req.userId });
    if (!cart) return res.json({ success: false, message: "Cart not found" });

    const item = cart.items.find(
      i => i.product.toString() === productId
    );
    if (!item) return res.json({ success: false, message: "Item not found" });

    // Check stock
    const product = await Product.findById(productId);
    if (!product || product.quantity < quantity) {
      return res.json({ success: false, message: "Insufficient stock" });
    }

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
app.post("/api/order", auth, upload.any(), async (req, res) => {
  try {
    const buyerId = req.userId;

    const {
      name,
      phone,
      address,
      deliveryMethod,
      paymentMethod,
      notes,
      deliveryDate,
      sellerTotals
    } = req.body;

    // ===============================
    // GET CART
    // ===============================
    const cart = await Cart.findOne({ buyer: buyerId }).populate({
      path: "items.product",
      populate: { path: "seller", select: "name phone" }
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    // ===============================
    // BUILD PAYMENT PROOFS BY SELLER
    // ===============================
    const paymentProofsBySeller = {};

    for (const file of req.files) {
      if (!file.fieldname.startsWith("proof_")) continue;

      const sellerId = file.fieldname.replace("proof_", "");
      const result = await cloudinary.uploader.upload(file.path, {
        folder: "paymentProofs"
      });

      paymentProofsBySeller[sellerId] = result.secure_url;
    }

    // ===============================
    // BUILD ORDER ITEMS
    // ===============================
    const orderItems = cart.items.map(item => {
      const sellerId = item.product.seller._id.toString();

      return {
        product: item.product._id,
        seller: sellerId,
        quantity: item.quantity,
        price: item.price,
        status: "Pending",
        paymentProof: paymentProofsBySeller[sellerId] || null
      };
    });

    // ===============================
    // CREATE ORDER
    // ===============================
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
      notes,
      status: "Pending",
      sellerTotals: sellerTotals ? JSON.parse(sellerTotals) : {},
      paymentProofsBySeller // 👈 keep full mapping for later
    });

    // ===============================
    // NOTIFY SELLERS
    // ===============================
    const uniqueSellers = [...new Set(orderItems.map(i => i.seller))];

    uniqueSellers.forEach(sellerId => {
      const sellerRoom = `Seller_${sellerId}`;
      const sellerSubtotal = orderItems
        .filter(i => i.seller === sellerId)
        .reduce((sum, i) => sum + i.price * i.quantity, 0);

      io.to(sellerRoom).emit("newOrderNotification", {
        message: `New Order from ${name}!`,
        orderId: newOrder._id,
        total: sellerSubtotal
      });
    });

    // ===============================
    // CLEAR CART
    // ===============================
    await Cart.findOneAndDelete({ buyer: buyerId });

    return res.json({
      success: true,
      message: "Order placed successfully!",
      orderId: newOrder._id
    });

  } catch (error) {
    console.error("Order Creation Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
});
app.get("/api/seller/orders", auth, async (req, res) => {
  try {
    const sellerId = req.userId.toString();

    const orders = await Order.find({ "items.seller": sellerId })
      .populate("items.product", "name")
      .sort({ createdAt: -1 });

    const filteredOrders = orders
      .map(order => {
        // ✅ Filter only THIS seller's items
        const sellerItems = order.items.filter(
          item =>
            item.seller &&
            item.seller.toString() === sellerId &&
            item.status === "Pending"
        );

        if (sellerItems.length === 0) return null;

        const sellerTotalPrice = sellerItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );

        const proof =
          order.paymentProofsBySeller instanceof Map
            ? order.paymentProofsBySeller.get(sellerId)
            : order.paymentProofsBySeller?.[sellerId];

        return {
          _id: order._id,
          name: order.name,
          phone: order.phone,
          address: order.address,
          notes: order.notes,
          deliveryMethod: order.deliveryMethod,
          paymentMethod: order.paymentMethod,
          totalPrice: sellerTotalPrice,
          createdAt: order.createdAt,

          paymentProof: proof || null,

          items: sellerItems.map(item => ({
            _id: item._id,
            product: item.product,
            quantity: item.quantity,
            status: item.status,
            price: item.price
          }))
        };
      })
      .filter(order => order !== null);

    res.json({ success: true, orders: filteredOrders });

  } catch (err) {
    console.error("Seller Orders Error:", err.message);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

app.put("/api/order/status/:id", auth, async (req, res) => {
  try {
    const sellerId = req.userId.toString();
    const orderId = req.params.id;
    const { status } = req.body;

    // 🔒 Validate status
    if (!["Accepted", "Cancelled"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    const order = await Order.findById(orderId).populate("items.product");
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // 🔍 Get only this seller's items
    const sellerItems = order.items.filter(
      (i) => i.seller.toString() === sellerId
    );

    if (sellerItems.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    // ❌ Prevent duplicate updates
    const alreadyUpdated = sellerItems.every(
      (i) => i.status !== "Pending"
    );

    if (alreadyUpdated) {
      return res.json({
        success: false,
        message: `Already ${sellerItems[0].status}`,
      });
    }

    // ✅ Update ONLY this seller's pending items
    const updatedItems = [];

    order.items.forEach((item) => {
      if (
        item.seller.toString() === sellerId &&
        item.status === "Pending"
      ) {
        item.status = status;
        updatedItems.push(item);
      }
    });

    await order.save();

    // 🔥 IMPORTANT FIX: ONE notification per seller (NOT per item)
    const displayId = order._id.toString().slice(-6).toUpperCase();

    const newNotif = await Notification.create({
      recipient: order.buyer,
      sender: sellerId,
      orderId: order._id,
      items: updatedItems, // optional but useful
      message:
        status === "Accepted"
          ? `Your order #${displayId} items were accepted`
          : `Your order #${displayId} items were cancelled`,
      read: false,
      category: "Order",
    });

    // 📡 Emit single notification
    io.to(`Buyer_${order.buyer}`).emit("notification", {
      _id: newNotif._id,
      message: newNotif.message,
      orderId: order._id,
      status,
      createdAt: newNotif.createdAt,
    });

    // 🔢 Update unread count ONCE
    const unreadCount = await Notification.countDocuments({
      recipient: order.buyer,
      read: false,
    });

    io.to(`Buyer_${order.buyer}`).emit("notification_count", {
      unreadCount,
    });

    return res.json({
      success: true,
      message: `Order ${status.toLowerCase()} successfully`,
      updatedItems,
    });

  } catch (err) {
    console.error("Status Update Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});
app.get("/api/orders/:id", auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("items.product")
      .populate("items.seller");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    const userId = req.userId.toString();

    const isBuyer = order.buyer.toString() === userId;
    const isSeller = order.items.some(i => i.seller?.toString() === userId);

    if (!isBuyer && !isSeller) {
      return res.status(403).json({
        success: false,
        message: "Not authorized"
      });
    }

    // 🔥 SELLER VIEW (ONLY THEIR ITEMS BUT KEEP ORDER INFO)
    if (isSeller && !isBuyer) {
      const sellerItems = order.items.filter(
        i => i.seller?.toString() === userId
      );

      return res.json({
        success: true,
        order: {
          _id: order._id,
          name: order.name,
          phone: order.phone,
          address: order.address,
          paymentMethod: order.paymentMethod,
          createdAt: order.createdAt,

          items: sellerItems,
          totalPrice: sellerItems.reduce(
            (sum, i) => sum + i.price * i.quantity,
            0
          ),

          status: sellerItems.every(i => i.status === "Accepted")
            ? "Accepted"
            : sellerItems.some(i => i.status === "Cancelled")
            ? "Cancelled"
            : "Pending"
        }
      });
    }

    // 🔥 BUYER VIEW (FULL DATA ALWAYS CORRECT)
    return res.json({
      success: true,
      order: {
        _id: order._id,
        name: order.name,
        phone: order.phone,
        address: order.address,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt,
        items: order.items,
        totalPrice: order.items.reduce(
          (sum, i) => sum + i.price * i.quantity,
          0
        )
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});
    app.get("/api/seller/orders/history", auth, async (req, res) => {
  try {
    const sellerId = req.userId.toString();

    const orders = await Order.find({
      "items.seller": sellerId
    })
      .populate("items.product", "name")
      .sort({ createdAt: -1 });

    const history = [];

    for (const order of orders) {
      const sellerItems = order.items.filter(item => {
        if (!item.seller) return false;
        return (
          item.seller.toString() === sellerId &&
          (item.status === "Accepted" || item.status === "Cancelled")
        );
      });

      if (sellerItems.length === 0) continue;

      const totalPrice = sellerItems.reduce(
        (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
        0
      );

      // ✅ FIX: extract proof ONCE here
      const proof =
        order.paymentProofsBySeller instanceof Map
          ? order.paymentProofsBySeller.get(sellerId)
          : order.paymentProofsBySeller?.[sellerId];

      history.push({
        _id: order._id,
        name: order.name,
        phone: order.phone,
        address: order.address,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt,
        totalPrice,

        // 🔥 THIS is what your frontend needs
        paymentProof: proof || null,

        items: sellerItems.map(item => ({
          _id: item._id,
          product: item.product,
          quantity: item.quantity,
          price: item.price,
          status: item.status
        }))
      });
    }

    res.json({ success: true, orders: history });

  } catch (err) {
    console.error("History Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
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
            options: { strictPopulate: false } //  prevents crash from old data
          })
          .sort({ createdAt: -1 })
          .limit(20);

        res.json({
          success: true,
          notifications
        });

      } catch (error) {
        console.error(" Fetch Notif Error FULL:", error);
        res.status(500).json({ success: false, message: error.message });
      }
    });

    //  THIS ONE WAS ALREADY CORRECT
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
    
    //  CORRECTED: MARK ALL NOTIFICATIONS AS READ
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

        if(!buyer){
          return res.json({
            success:false,
            message:"Buyer not Found"
          })
        }
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
    app.post("/api/bookService", auth, upload.single("paymentProof",1), async (req, res) => {
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

//  USE ROOMS FOR RELIABLE NOTIFICATIONS
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

        //  CREATE NOTIFICATION
        const displayId = updatedBooking._id.toString().slice(-6).toUpperCase();

        const notificationMessage =
          status === "Accepted"
            ? ` Your booking #${displayId} has been accepted!`
            : ` Your booking #${displayId} was declined.`;

        const newNotif = await Notification.create({
          recipient: updatedBooking.buyer,   //  MUST exist in Booking schema
          sender: sellerId,
          message: notificationMessage,
          bookingId: updatedBooking._id,
          read: false,
          category: "Booking"
        });

        //  SOCKET REAL-TIME
       // ... inside app.put("/api/bookings/:id") after creating the Notification ...

//  USE ROOMS FOR BUYER NOTIFICATIONS
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
        console.error(" Booking Update Error:", error);
        res.status(500).json({ success: false, message: "Update Error" });
      }
    });

    //  GET SINGLE BOOKING (FIX)
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

        //  Security check (same as order)
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
        console.error(" Fetch Booking Error:", err);
        res.status(500).json({
          success: false,
          message: "Server error while fetching booking",
        });
      }
    });
    
    app.put(
  "/api/update_buyer_profile",
  auth,
  upload.single("profile"),
  async (req, res) => {
    try {
      const buyerId = req.userId;

      let updateData = {
        name: req.body.name
      };

      // =========================
      // PASSWORD VALIDATION FIRST
      // =========================
      if (req.body.password || req.body.confirmPassword) {
        if (req.body.password !== req.body.confirmPassword) {
          return res.json({
            success: false,
            message: "Passwords must match"
          });
        }

        updateData.password = await bcrypt.hash(req.body.password, 12);
      }

      if(!req.body.name||!req.body.password||!req.body.confirmPassword){
        return res.json({
          success:false,
          message:"All fields required"
        })
      }
      // =========================
      // PROFILE IMAGE UPDATE
      // =========================
      if (req.file) {
        const Max_Size = 5 * 1024 * 1024;

        if (req.file.size > Max_Size) {
          return res.json({
            success: false,
            message: "Profile image too large (Max 5MB)"
          });
        }

        if (!req.file.mimetype.startsWith("image/")) {
          return res.json({
            success: false,
            message: "Only images allowed"
          });
        }

        updateData.profile = req.file.path;
      }

      // =========================
      // UPDATE BUYER
      // =========================
      const buyer = await Buyer.findOneAndUpdate(
        { _id: buyerId },
        updateData,
        { new: true }
      );

      if (!buyer) {
        return res.json({
          success: false,
          message: "Buyer Not Found"
        });
      }

      res.json({ success: true, buyer });

    } catch (err) {
      console.log(err);
      res.json({ success: false, message: "Server error" });
    }
  }
);
    app.delete("/api/cart/remove/:id", auth, async (req, res) => {
      try {
        const buyerId = req.userId;

        const identifier = req.params.id;
        if(!identifier){
          return res.json({
            success:false,
            message:"Product not found"
          })
        }
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
          return res.status(401).json({
             success: false,
             message:"Sellers not found"
             });
        }

        const seller = await Seller.findById(sellerId);

        if (!seller) {
          return res.json({
             success: false,
             message:"Seller not found"
             });
        }

        if (seller.sellerType === "Service") {
          // BOOKINGS
          await Booking.updateMany(
            { seller: sellerId, status: "Pending" },
            { $set: { status: "Seen" } },
            {new:true}
          );
        } else {
          // ORDERS
          await Order.updateMany(
            { "items.seller": sellerId, status: "Pending" },
            { $set: { seen: true } },
            {new:true}
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
    if (!seller) return res.json({ 
      success: false,
      message:"Seller not found"
     });

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

    io.to(sellerKey).emit("viewUpdate", {
      totalViews: seller.views,
      todayViews: currentTodayEntry ? currentTodayEntry.buyers.length : 0
    });

    console.log(` View update broadcasted to room: ${sellerKey}`);

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

// --- UPDATE PRODUCT ROUTE ---
app.put("/api/products/update/:productId", auth, upload.array("files", 10), async (req, res) => {
  try {
    const productId = req.params.productId;
    const { name, price, description, quantity} = req.body;

    // 1. Find product and check ownership
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product Not Found" });
    }

    if (product.seller.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    // 2. Prepare Update Object
    let updatedData = {
      name,
      price,
      description,
      quantity
    };

    
    // 3. Handle New Images (If any are uploaded)
    if (req.files && req.files.length > 0) {
      const Max_Size=20*1024*1024;
      for(const file of req.files){
        if(file.size>Max_Size){
          return res.json({
            success:false,
            message:`File ${file.originalname} is too large. Max 20MB per file.`
          })
        }
      }
      for(const file of req.files){
        if(!file.mimetype.startsWith("image/")&&!file.mimetype.startsWith("video/")){
          return res.json({
            success:false,
            message:"Only Images and video Allowed"
          })
        }
      }
      const newFiles = req.files.map(file => file.path);
      // Option: Replace old images or append them. 
      // Most users expect to keep old ones + add new ones:
      updatedData.files = [...product.files, ...newFiles];
    }

    // 4. Save to Database
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { $set: updatedData },
      { new: true }
    );

    res.json({
      success: true,
      message: "Product Updated Successfully",
      product: updatedProduct
    });

  } catch (error) {
    console.error("Update Product Error:", error);
    res.status(500).json({ success: false, message: "Server Error during update" });
  }
});

app.get("/api/admin/dashboard",auth,async(req,res)=>{
  try {
    const totalSellers=await Seller.countDocuments();
    const totalProducts=await Product.countDocuments();
     const totalOrders=await Order.countDocuments();

     res.json({
      success:true,
      totalSellers,
      totalProducts,
      totalOrders
     })
  } catch (error) {
    console.log("Loading Data error")
  }
})
    const PORT = process.env.PORT;
    httpServer.listen(PORT, () => {
      console.log(` Server is running on port ${PORT}`);
    });