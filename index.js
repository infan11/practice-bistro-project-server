const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require("jsonwebtoken")
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require("stripe")(process.env.VITE_STRIPE_SECRET_KEY);
const formData = require('form-data');
const Mailgun = require('mailgun.js');
const mailgun = new Mailgun(formData);
const mg = mailgun.client({ username: 'api', key: process.env.MAILGUN_API_KEY || 'key-yourkeyhere' });
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
    const paymentsCollection = client.db("bistroProjectDB").collection("payments");

    // jwt related api 
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1hr" })
      res.send({ token })
    })
    // middlewere
    const verifyToken = (req, res, next) => {
      console.log("inside Verify Token", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" })
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" })
        }
        req.decoded = decoded;
        next()
      })
    }
    // Verify Admin 
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" })

      }
      next()
    }
    // user related api 
    app.get("/users", verifyToken, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result)
    });

    // user admin api 
    app.get("/users/admin/:email", verifyToken, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" })
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let admin = false
      if (user) {
        admin = user?.role === "admin"
      }
      res.send({ admin })

    })

    app.post("/users", verifyToken, verifyAdmin, async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };
      const exitsInUser = await usersCollection.findOne(query);
      if (exitsInUser) {
        return res.send({ message: "user already exits", insertedId: null })
      }
      const result = await usersCollection.insertOne(user);
      res.send(result)
    })

    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result)
    })
    app.patch("/users/admin/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin"
        }
      }
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result)
    })
    // menu api
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result)
    })
    app.get("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await menuCollection.findOne(query);
      res.send(result)
    })
    app.post("/menu", async (req, res) => {
      const menuItem = req.body;
      const result = await menuCollection.insertOne(menuItem);
      res.send(result)
    })

    app.patch("/menu/:id", async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe,
          image: item.image
        }
      }
      const result = await menuCollection.updateOne(filter, updateDoc)
      res.send(result);
    })
    app.delete("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await menuCollection.deleteOne(query);
      res.send(result)
    })
    app.get("/reviews", async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result)
    })
    /// cart collection 
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const query = { email: email }
      const result = await cartsCollection.find(query).toArray();
      res.send(result)
    })
    app.post("/carts", async (req, res) => {
      const cartItem = req.body;
      const result = await cartsCollection.insertOne(cartItem);
      console.log("result found", result);
      res.send(result);
    })
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await cartsCollection.deleteOne(query);
      res.send(result)
    })
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, "payment intent");
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ['card']
      });
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })
    // payment stripe related api
    app.get("/payments/:email", async (req, res) => {
      const query = { email: req.params.email }
      // if (req.params.email !== req.decoded.email) {
      //   return res.status(403).send({ message: "forbidden access" })
      // }
      const result = await paymentsCollection.find(query).toArray()
      res.send(result)
    })
    app.post("/payments", async (req, res) => {
      const payment = req.body;

      try {
        const paymentResult = await paymentsCollection.insertOne(payment);

        // Delete each item from the cart
        const query = {
          _id: {
            $in: payment.cardId.map(id => new ObjectId(id))
          }
        };

        const deletedResult = await cartsCollection.deleteMany(query);

        mg.messages.create(process.env.MAIL_SENDING_DOMAIN, {
          from: "Mailgun Sandbox <postmastar@sandbox6aab7fc278744968b208d3b8fb989e6c.mailgun.org>",
          to: ["infanjiounrahman20606@gmail.com"],
          subject: "Bistro Boss Order Confirmation",
          text: "Testing some Mailgun awesomness!",
          html: `<div>
               <h1>Thank You for your order</h1>
               <h1>Your Transaction Id : <strong>${payment.transactionId}</strong></h1>
          </div>`
        })
          .then(msg => console.log(msg)) // logs response data
          .catch(err => console.error(err)); // logs any error


        res.send({ paymentResult, deletedResult });
      } catch (error) {
        console.error("Error processing payment:", error);
        res.status(500).send({ error: "An error occurred while processing the payment." });
      }
    });
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("bistro server is running")
})
app.listen(port, () => {
  console.log(`signel crud  sevber is running port ${port}`)
})