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
    isVerified: { type: Boolean, default: false },
verificationCode: String,
verificationExpires: Date,
})

module.exports=mongoose.model("Buyer",buyerSchema);