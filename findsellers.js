const mongoose=require("mongoose");
const Seller=require("./models/seller");

mongoose.connect(process.env.MONGO_URL)

.then(async()=>{
    console.log("Database Connected");
    const result=await Seller.find({});
    console.log("Sellers Founded",result);
    mongoose.disconnect();
})

.catch((error)=>console.log(error));