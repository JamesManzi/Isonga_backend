const mongoose=require("mongoose");

const View=require("./models/ProductView");

mongoose.connect("mongodb://127.0.0.1:27017/Isonga")

.then(async()=>{
    console.log("Database Connected");

    const result=await View.deleteMany({});
    console.log("Deleted Views",result.deletedCount);

    mongoose.disconnect();
})

.catch((error)=>console.log(error));