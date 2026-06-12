const mongoose=require("mongoose");

const View=require("./models/ProductView");

mongoose.connect(process.env.MONGO_URL)

.then(async()=>{
    console.log("Database Connected");

    const result=await View.deleteMany({});
    console.log("Deleted Views",result.deletedCount);

    mongoose.disconnect();
})

.catch((error)=>console.log(error));