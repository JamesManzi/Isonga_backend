const mongoose=require("mongoose");

const Message=require("./models/Message");

mongoose.connect("mongodb://127.0.0.1:27017/Isonga")

.then(async()=>{
    console.log("Database Connected");
    const result=await Message.deleteMany({});
    console.log("Deleted Ratings",result.deletedCount);

    mongoose.disconnect();
})

.catch((error)=>console.log(error));