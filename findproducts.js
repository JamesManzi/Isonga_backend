const mongoose=require("mongoose");
const Product=require("./models/product");

mongoose.connect(process.env.MONGO_URL)

.then(async()=>{
    console.log("Database Connected");

    const result=await Product.find();
    console.log("Products Found",result);
    mongoose.disconnect();
})

.catch((error)=>console.log(error));