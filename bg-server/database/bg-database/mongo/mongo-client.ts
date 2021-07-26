const username = 'bg-server-dev';
const password = 'kYPOlqM7s6r1iwNd';

import * as Mongoose from "mongoose";

let database: Mongoose.Connection;

export const connect = () => {
  // add your own uri below
  const uri = `mongodb+srv://${username}:${password}@bg-cluster.7rn20.mongodb.net/myFirstDatabase?retryWrites=true;`
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
