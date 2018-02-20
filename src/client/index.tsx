
import { InMemoryCache } from 'apollo-cache-inmemory';
import { ApolloClient } from 'apollo-client';
import { split } from 'apollo-link';
import { HttpLink } from 'apollo-link-http';
import { WebSocketLink } from 'apollo-link-ws';
import { getMainDefinition } from 'apollo-utilities';
import { OperationDefinitionNode } from 'graphql';
import gql from 'graphql-tag';
import * as React from 'react';
import { ApolloProvider } from 'react-apollo';
import * as ReactDOM from 'react-dom';
import { App } from './components/app';

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

// Using the ability to split links, you can send data to each link
// Depending on what kind of operation is being sent
const link = split(
  // Split based on operation type
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
      gameHints(gameId: "5a8b4cec965db7dc4b3be246") {
        word
        numCards
      }
    }
  `,
}).subscribe(thing => console.log(thing));

client.subscribe({
  query: gql`
    subscription {
      gameCards(gameId: "5a8b4cec965db7dc4b3be246") {
        word
        faction
        revealed
      }
    }
  `,
}).subscribe(thing => console.log(thing));

ReactDOM.render(
  <ApolloProvider client={client}>
    <App />
  </ApolloProvider>,
    document.getElementById('mount')
);
