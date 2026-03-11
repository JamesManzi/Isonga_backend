const mongoose=require("mongoose");

const Seller=require("./models/seller");

mongoose.connect("mongodb://127.0.0.1:27017/Isonga")

.then(async()=>{
    console.log("Database Connected");
    const result=await Seller.deleteMany({});
    console.log("Deleted Sellers",result.deletedCount);

    mongoose.disconnect();
})

.catch((error)=>console.log(error));