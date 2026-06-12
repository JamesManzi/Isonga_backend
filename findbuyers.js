const mongoose=require("mongoose");
const Buyer=require("./models/buyer");

mongoose.connect(process.env.MONGO_URL)

.then(async()=>{
    console.log("Database Connected");
    const result=await Buyer.find({});
    console.log("Buyers Found",result);
    mongoose.disconnect();
})

.catch((error)=>console.log(error));