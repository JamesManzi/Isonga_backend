const mongoose=require("mongoose");
const Product=require("./models/product");

mongoose.connect("mongodb://127.0.0.1:27017/Isonga")

.then(async()=>{
    console.log("Database Connected");

    const result=await Product.find();
    console.log("Found Products",result);
    mongoose.disconnect();
})

.catch((error)=>console.log(error));