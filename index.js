const express = require('express');
const cors = require('cors');
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000;

// middle weres

app.use(express.json())
app.use(cors())


const uri = `mongodb+srv://${process.env.DBNAME}:${process.env.DBPASSWORD}@cluster0.lopynog.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const usersCollection = client.db("bistroProjectDB").collection("users");
    const menuCollection = client.db("bistroProjectDB").collection("menu");
    const reviewsCollection = client.db("bistroProjectDB").collection("reviews");
    const cartsCollection = client.db("bistroProjectDB").collection("carts");
   
    app.post("/users" , async (req, res) => {
      const userInfo = req.body;
      const result = await usersCollection.insertOne(userInfo);
      res.send(result)
    })
    // menu api
    app.get("/menu" , async (req, res) => {
       const result = await menuCollection.find().toArray();
       res.send(result)
    })
    app.get("/reviews" , async (req, res) => {
       const result = await reviewsCollection.find().toArray();
       res.send(result)
    })

    app.post("/carts" , async (req, res) => {
      const cartItem = req.body;
      const result = await cartsCollection.insertOne(cartItem);
      res.send(result);      
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/" , (req, res) => {
    res.send("bistro server is running")
})
app.listen(port , () => {
  console.log( `signel crud  sevber is running port ${port}` )
})