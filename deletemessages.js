const mongoose=require("mongoose");

const Message=require("./models/Message");

mongoose.connect(process.env.MONGO_URL)

.then(async()=>{
    console.log("Database Connected");
    const result=await Message.deleteMany({});
    console.log("Deleted Ratings",result.deletedCount);

    mongoose.disconnect();
})

.catch((error)=>console.log(error));