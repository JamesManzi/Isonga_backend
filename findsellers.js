const mongoose=require("mongoose");
const Seller=require("./models/seller");

mongoose.connect("mongodb://127.0.0.1:27017/Isonga")

.then(async()=>{
    console.log("Database Connected");
    const result=await Seller.find({});
    console.log("Found Sellers",result);
    mongoose.disconnect();
})

.catch((error)=>console.log(error));