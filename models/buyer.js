const  mongoose=require("mongoose");

const buyerSchema=new mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    email:{
        type:String,
        unique:true,
        required:true
    },
    password:{
        type:String,
        required:true
    },
    profile:{
        type:String,
        required:true
    },
    failedAttempts:{
        type:Number,
        default:0
    },
    role:{
        type:String,
        enum:["buyer","admin"],
        default:"buyer"
    },
    lockUntil:{
        type:Date,
        default:null
    },
    isVerified: {
         type: Boolean,
          default: false 
        },
        lastVerificationSent:{
            type:Date,
            default:null
        },
verificationCode: String,
verificationExpires: Date,
failedAttempts: { type: Number, default: 0 },
lockUntil: { type: Date, default: null }
})

module.exports=mongoose.model("Buyer",buyerSchema);