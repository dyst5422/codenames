import { graphiqlExpress, graphqlExpress } from 'apollo-server-express';
import * as bodyParser from 'body-parser';
import { ObjectID } from 'bson';
import * as cors from 'cors';
import * as express from 'express';
import { read } from 'fs-extra';
import { execute, subscribe } from 'graphql';
import { parse } from 'graphql';
import gql from 'graphql-tag';
import { makeExecutableSchema } from 'graphql-tools';
import { createServer } from 'http';
import { random, shuffle } from 'lodash';
import { MongoClient } from 'mongodb';
import { SubscriptionServer } from 'subscriptions-transport-ws';
import { assertOne } from '../utils/assertions';
import { nouns } from './nouns';

export enum Faction {
  RED = 'RED',
  BLUE = 'BLUE',
  ASSASSIN = 'ASSASSIN',
  BYSTANDER = 'BYSTANDER',
}

export enum Stage {
  RED_HINT = 'RED_HINT',
  BLUE_HINT = 'BLUE_HINT',
  RED_REVEAL = 'RED_REVEAL',
  BLUE_REVEAL = 'BLUE_REVEAL',
  RED_WON = 'RED_WON',
  BLUE_WON = 'BLUE_WON',
}

export interface ICard {
  word: string;
  faction: Faction;
  revealed: boolean;
}

async function main() {
  const mongoClient = await MongoClient.connect('mongodb://localhost:27017');

  const db = mongoClient.db('codenames');

  const users = db.collection('users');

  users.createIndex({ name: 1 }, { unique: true });

  const teams = db.collection('teams');
  const games = db.collection('games');

  const resolvers = {
    Queries: {
      user: (_: undefined, args: { id?: string; name?: string }) => {
        if (args.id != undefined) {
          return users.findOne({ _id: new ObjectID(args.id) });
        }
        if (args.name != undefined) {
          return users.findOne({ name: args.name });
        }
        throw new Error('Must provide name or id for user.');
      },
      allUsers: () => users.find().toArray(),
      team: (_: undefined, args: { id: string }) => teams.findOne({ _id: new ObjectID(args.id) }),
      allTeams: () => teams.find().toArray(),
      game: async (_: undefined, args: { id: string }, context: { userId: string, faction?: Faction }) => {

        const game = await games.findOne({ _id: new ObjectID(args.id) });

        const redTeam = await teams.findOne({ _id: new ObjectID(game.redTeamID) });
        const blueTeam = await teams.findOne({ _id: new ObjectID(game.blueTeamID) });
        let faction: Faction.RED | Faction.BLUE | undefined;
        if (redTeam.players.includes(context.userId) || redTeam.spymasterID !== context.userId) {
          faction = Faction.RED;
        }
        if (blueTeam.players.includes(context.userId) || blueTeam.spymasterID !== context.userId) {
          faction = Faction.BLUE;
        }

        context.faction = faction;

        return game;
      },
      allGames: () => games.find().toArray(),
    },
    Mutations: {
      createUser: async (_: undefined, args: { name: string }) => {
        const res = await users.insertOne({
          name: args.name,
        });

        return assertOne(res.ops);
      },
      createTeam: async (_: undefined, args: {}) => {
        const res = await teams.insertOne({
          playerIDs: [],
          spymasterID: undefined,
        });

        return assertOne(res.ops);
      },
      createGame: async (_: undefined, args: { team1ID: string; team2ID: string }) => {
        const redTeamID = random(1, false) ? args.team1ID : args.team2ID;
        const blueTeamID = random(1, false) ? args.team2ID : args.team1ID;

        const numCards = 25;
        const wordlist = shuffle(nouns).slice(0, numCards);

        const thirdOfCards = Math.floor((numCards - 1) / 3);
        const numFirst = thirdOfCards + 1;
        const numSecond = thirdOfCards;
        const numLeft = thirdOfCards - 1;
        const cards = shuffle(wordlist.map((word, idx) => ({
          word,
          faction:
            idx < thirdOfCards + 1 ? Faction.RED :
            idx < 2 * thirdOfCards ? Faction.BLUE :
            idx === 2 * thirdOfCards ? Faction.ASSASSIN :
            Faction.BYSTANDER,
          revealed: false,
        })));
        const res = await games.insertOne({
          redTeamID,
          blueTeamID,
          stage: Stage.RED_HINT,
          cards,
          lastHint: {
            word: undefined,
            numCards: undefined,
          }
        });

        return assertOne(res.ops);
      },
    },
    User: {
      id: (rootObj: { _id: ObjectID }) => rootObj._id.toHexString(),
    },
    Team: {
      id: (rootObj: { _id: ObjectID }) => rootObj._id.toHexString(),
      players: (rootObj: { playerIDs: string[] }) => {
        return users.find({ _id: { $in: rootObj.playerIDs.map(id => new ObjectID(id)) } }).toArray();
      },
      spymaster: (rootObj: { spymasterID: string }) => users.findOne({ _id: new ObjectID(rootObj.spymasterID) }),
      addPlayer: async (rootObj: { _id: string }, args: { playerID: string }) => {
        const res = await teams.updateOne({ _id: rootObj._id }, { $addToSet: { playerIDs: args.playerID } });

        return teams.findOne({ _id: rootObj._id });
      },
      promoteToSpymaster: async (rootObj: { _id: string }, args: { playerID: string }) => {
        const res = await teams.updateOne(
          { _id: rootObj._id },
          {
            $pull: { playerIDs: args.playerID },
            $set: { spymasterID: args.playerID },
          },
        );

        return await teams.findOne({ _id: rootObj._id });
      },
    },
    Game: {
      id: (rootObj: { _id: ObjectID }) => rootObj._id.toHexString(),
      redTeam: (rootObj: { redTeamID: string }) => teams.findOne({ _id: new ObjectID(rootObj.redTeamID) }),
      blueTeam: (rootObj: { blueTeamID: string }) => teams.findOne({ _id: new ObjectID(rootObj.blueTeamID) }),
      reveal: async (rootObj: { _id: ObjectID, cards: ICard[], stage: Stage }, args: { word: string }, context: { faction: Faction }) => {
        if (!(
          (rootObj.stage === Stage.BLUE_REVEAL && context.faction === Faction.BLUE)
          ||
          (rootObj.stage === Stage.RED_REVEAL && context.faction === Faction.RED)
        )) {
          throw new Error('Not your turn to reveal a card.');
        }

        const revealedCard = assertOne(rootObj.cards.filter(card => card.word === args.word));

        if (revealedCard.revealed === true) {
          throw new Error('Card already revealed.');
        }

        await games.updateOne({
          '_id': rootObj._id,
          'cards.word': args.word,
        }, {
          $set: { 'cards.$.revealed': true }
        });

        if (revealedCard.faction === Faction.ASSASSIN) {
          const newStage = transitionStage(rootObj.stage, context.faction === Faction.RED ? Faction.BLUE : Faction.RED);
          await games.updateOne({
            _id: rootObj._id,
          }, {
            $set: { stage: newStage },
          });
        }

        if (revealedCard.faction !== context.faction) {
          const newStage = transitionStage(rootObj.stage);
          await games.updateOne({
            _id: rootObj._id,
          }, {
            $set: { stage: newStage },
          });
        }

        if (rootObj.cards.filter(card => card.faction === Faction.RED).some(card => card.revealed === false)) {
          const newStage = transitionStage(rootObj.stage, Faction.RED);
          await games.updateOne({
            _id: rootObj._id,
          }, {
            $set: { stage: newStage },
          });
        } else if (rootObj.cards.filter(card => card.faction === Faction.BLUE).some(card => card.revealed === false)) {
          const newStage = transitionStage(rootObj.stage, Faction.BLUE);
          await games.updateOne({
            _id: rootObj._id,
          }, {
            $set: { stage: newStage },
          });
        }

        return assertOne(await (await games.aggregate([
          { $match: { _id: new ObjectID('5a46e135e96eb226899d94b6') } },
          { $project: {
              _id: 0,
              cards: {
                $filter: { input: '$cards', as: 'card', cond: { $eq: ['$$card.word', 'something'] }}
              }
            }
          },
          { $unwind: '$cards' },
          { $project: { word: '$cards.word', faction: '$cards.faction', revealed: '$cards.revealed'} }
        ])).toArray());
      },
      hint: async (
        rootObj: { _id: ObjectID, cards: ICard[], stage: Stage },
        args: { word: string, numCard: number },
        context: { faction: Faction }
      ) => {
        if (!(
          (rootObj.stage === Stage.BLUE_HINT && context.faction === Faction.BLUE)
          ||
          (rootObj.stage === Stage.RED_HINT && context.faction === Faction.RED)
        )) {
          throw new Error('Not your turn to provide a hint.');
        }
        if (rootObj.cards.map(card => card.word).includes(args.word)) {
          throw new Error('Not allowed to hint any words on the cards.');
        }
        await games.updateOne({
          _id: rootObj._id,
        }, {
          $set: {
            lastHint: {
              word: args.word,
              numCard: args.numCard,
            },
            stage: transitionStage(rootObj.stage),
          },
        });
        return {
          word: args.word,
          numCard: args.numCard,
        };
      }
    },
  };

  const typeDef = gql`
    type User {
      id: String!
      name: String!
    }

    type Team {
      id: String!
      playerIDs: [String!]!
      spymasterID: String
      players: [User!]!
      spymaster: User
      addPlayer(playerID: String): Team
      promoteToSpymaster(playerID: String): Team
    }

    enum Stage {
      RED_HINT
      BLUE_HINT
      RED_REVEAL
      BLUE_REVEAL
      RED_WON
      BLUE_WON
    }

    enum Faction {
      RED
      BLUE
      ASSASSIN
      BYSTANDER
    }

    type Card {
      word: String!
      faction: Faction!
      revealed: Boolean!
    }

    type Hint {
      word: String
      numCards: Int
    }

    type Game {
      id: String!
      redTeamID: String!
      blueTeamID: String!
      redTeam: Team
      blueTeam: Team
      stage: Stage
      cards: [Card!]!
      lastHint: Hint
      reveal(word: String!): Card
      hint(word: String!, numCards: Int!): Hint
    }

    type Queries {
      user(id: String, name: String): User
      allUsers: [User!]!
      team(id: String!): Team
      allTeams: [Team!]!
      game(id: String!): Game
      allGames: [Game!]!
    }

    type Mutations {
      createUser(name: String!): User
      createTeam: Team
      createGame(redTeamID: String!, blueTeamID: String!): Game
    }

    schema {
      query: Queries
      mutation: Mutations
    }
  `;

  const schema = makeExecutableSchema({
    resolvers,
    typeDefs: [typeDef],
  });

  const server = createServer();
  const expressRouter = express();

  expressRouter.use(cors());
  expressRouter.use(
    bodyParser.urlencoded({
      extended: true,
    }),
  );
  expressRouter.use(bodyParser.json());
  expressRouter.use(
    '/graphql',
    graphqlExpress((req, res) => {
      const context: { userId?: string } = {};
      if(req != undefined && req.headers) {
        context.userId = req.headers['codenames-userid'] as string;
      }

      return {
        schema,
        context,
      };
    }),
  );

  // tslint:disable-next-line:no-unused-expression
  new SubscriptionServer(
    {
      execute,
      subscribe,
      schema,
    },
    {
      server,
      path: 'graphql-subscriptions',
    },
  );
  expressRouter.use('/graphiql', graphiqlExpress({ endpointURL: '/graphql' }));
  server.on('request', expressRouter);
  server.listen(3000, () => {
    // tslint:disable-next-line:no-console
    console.log('Listening on http://localhost:3000/graphiql');
  });
}

main();


function transitionStage(stage: Stage, winner?: Faction.BLUE | Faction.RED): Stage {
  if (winner != undefined) {
    if (winner === Faction.RED) {
      return Stage.RED_WON;
    } else if (winner === Faction.BLUE) {
      return Stage.BLUE_WON;
    }
  }
  switch (stage) {
    case Stage.BLUE_HINT: {
      return Stage.BLUE_REVEAL;
    }
    case Stage.BLUE_REVEAL: {
      return Stage.RED_HINT;
    }
    case Stage.RED_HINT: {
      return Stage.RED_REVEAL;
    }
    case Stage.RED_REVEAL: {
      return Stage.BLUE_HINT;
    }
    default:
      return stage;
  }
}
