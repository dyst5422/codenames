import { ObjectId } from 'bson';
import { MongoClient } from 'mongodb';

async function main() {
  const mongoClient = await MongoClient.connect('mongodb://localhost:27017');

  const db = mongoClient.db('codenames');

  const games = db.collection('games');

  const val = await (await games.aggregate([
    { $match: { _id: new ObjectId('5a46e135e96eb226899d94b6') } },
    { $project: {
        _id: 0,
        cards: {
          $filter: { input: '$cards', as: 'card', cond: { $eq: ['$$card.word', 'something'] }}
        }
      }
    },
    { $unwind: '$cards' },
    { $project: { word: '$cards.word', faction: '$cards.faction', revealed: '$cards.revealed'} }
  ])).toArray();


  console.log(JSON.stringify(val, null, 2));
  mongoClient.close();
}

main();
