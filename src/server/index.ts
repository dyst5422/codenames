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

async function main() {
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
