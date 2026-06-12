const mongoose=require("mongoose");

const Seller=require("./models/seller");

mongoose.connect(process.env.MONGO_URL)

.then(async()=>{
    console.log("Database Connected");
    const result=await Seller.deleteMany({});
    console.log("Deleted Sellers",result.deletedCount);

    mongoose.disconnect();
})

.catch((error)=>console.log(error));