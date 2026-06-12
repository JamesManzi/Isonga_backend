const mongoose=require("mongoose");

const Buyer=require("./models/buyer");

mongoose.connect(process.env.MONGO_URL)

.then(async()=>{
    console.log("Database Connected");

    const result=await Buyer.deleteMany({});
    console.log("Deleted Buyers",result.deletedCount);

    mongoose.disconnect();
})

.catch((error)=>console.log(error));