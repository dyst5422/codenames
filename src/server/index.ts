import { graphiqlExpress, graphqlExpress } from 'apollo-server-express';
import * as bodyParser from 'body-parser';
import { ObjectID } from 'bson';
import * as cors from 'cors';
import * as express from 'express';
import * as fs from 'fs-extra';
import { execute, subscribe } from 'graphql';
import { parse } from 'graphql';
import gql from 'graphql-tag';
import { makeExecutableSchema } from 'graphql-tools';
import { createServer } from 'http';
import { random, shuffle } from 'lodash';
import { MongoClient } from 'mongodb';
import * as path from 'path';
import { SubscriptionServer } from 'subscriptions-transport-ws';
import { assertOne } from '../utils/assertions';
import { nouns } from './nouns';
import { createResolvers } from './resolvers';

async function main() {
  const mongoClient = await MongoClient.connect('mongodb://localhost:27017');
  const typeDef = (await fs.readFile(path.join(__dirname, 'schema.graphql'))).toString();
  const db = mongoClient.db('codenames');

  const resolvers = createResolvers(db);
  const schema = makeExecutableSchema({
    resolvers: [resolvers],
    typeDefs: [typeDef],
  } as any);

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
      path: '/graphql-subscriptions',
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
