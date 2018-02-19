import { InMemoryCache } from 'apollo-cache-inmemory';
import { ApolloClient } from 'apollo-client';
import { split } from 'apollo-link';
import { HttpLink } from 'apollo-link-http';
import { WebSocketLink } from 'apollo-link-ws';
import { getMainDefinition } from 'apollo-utilities';
import { OperationDefinitionNode } from 'graphql';
import gql from 'graphql-tag';

// Create an http link:
const httpLink = new HttpLink({
  uri: 'http://localhost:3000/graphql',
  fetch: fetch as any,
});

// Create a WebSocket link:
const wsLink = new WebSocketLink({
  uri: `ws://localhost:3000/graphql-subscriptions`,
  options: {
    reconnect: true,
    connectionParams: {
      'codenames-userid': '5a483b733fa60339cc3268ad',
    },
  },
  webSocketImpl: WebSocket,
});

// using the ability to split links, you can send data to each link
// depending on what kind of operation is being sent
const link = split(
  // split based on operation type
  ({ query }) => {
    const { kind, operation } = getMainDefinition(query) as OperationDefinitionNode;
    return kind === 'OperationDefinition' && operation === 'subscription';
  },
  wsLink,
  httpLink,
);

const client = new ApolloClient({
  link,
  cache: new InMemoryCache(),
});

client.subscribe({
  query: gql`
    subscription {
      gameHints(gameId: "5a4842a943ceb73a035a662b") {
        word
        numCards
      }
    }
  `,
});

