// TODO: don't store the creds in text :)
const username = 'bg-server-dev';
const password = '9rScxm4IRq4jnL9D';

import * as Mongoose from "mongoose";

let database: Mongoose.Connection;

export const connect = () => {
  const uri = `mongodb+srv://${username}:${password}@bg-cluster.7rn20.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`
  if (database) {
    return;
  }
  Mongoose.connect(uri, {
    useNewUrlParser: true,
    useFindAndModify: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
  });
  database = Mongoose.connection;
  database.once("open", async () => {
    console.log("Connected to database");
  });
  database.on("error", () => {
    console.log("Error connecting to database");
  });
};

export const disconnect = () => {
  if (!database) {
    return;
  }
  Mongoose.disconnect();
};
