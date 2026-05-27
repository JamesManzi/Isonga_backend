const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({

  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Seller",
    index: true
  },

  type:{
    type:String,
    enum:["Product","Service","Asset"],
    required:true
  },

  name:{
    type:String,
    required:true
  },

  price:{
    type:Number,
  },

  files:[
    {
      type:String,
      required:true
    }
  ],


  description:{
    type:String
  },

  quantity:{
    type:Number,
    default:0
  },

  dailyViews:[
    {
      date:{ type:Date, default:()=>new Date().setHours(0,0,0,0)},
      buyers:[{ type:mongoose.Schema.Types.ObjectId, ref:"Buyer"}]
    }
  ],

  uniqueBuyers:[{ type:mongoose.Schema.Types.ObjectId, ref:"Buyer"}],

  views:{
    type:Number,
    default:0
  }

},{timestamps:true});

module.exports = mongoose.model("Product",productSchema);