const mongoose=require("mongoose");

const Buyer=require("./models/buyer");

mongoose.connect("mongodb://127.0.0.1:27017/Isonga")

.then(async()=>{
    console.log("Database Connected");

    const result=await Buyer.deleteMany({});
    console.log("Deleted Buyers",result.deletedCount);

    mongoose.disconnect();
})

.catch((error)=>console.log(error));