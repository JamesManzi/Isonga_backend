const mongoose=require("mongoose");
const Product=require("./models/product");

mongoose.connect(process.env.MONGO_URL)

.then(async()=>{
    console.log("Database Connected");

    const result=await Product.deleteMany({});
    console.log("Deleted Products",result.deletedCount);
    mongoose.disconnect();
})

.catch((error)=>console.log(error));