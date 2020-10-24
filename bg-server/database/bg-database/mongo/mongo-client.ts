const MongoClient = require('mongodb').MongoClient;
const username = 'bg-server-dev';
const password = 'kYPOlqM7s6r1iwNd';
const uri = `mongodb+srv://${username}:${password}@bg-cluster.7rn20.mongodb.net/<dbname>?retryWrites=true&w=majority`;

export const client = new MongoClient(uri, { useNewUrlParser: true });
// client.connect(err => {
//   const collection = client.db("test").collection("devices");
//   // perform actions on the collection object
//   client.close();
// });
