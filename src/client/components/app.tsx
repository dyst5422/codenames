import gql from 'graphql-tag';
import * as React from 'react';
import { Query } from 'react-apollo';

const allGamesQuery = gql`
  query {
    allGames {
      redTeam {
        operatives {
          name
        }
        spymaster {
          name
        }
      }
      blueTeam {
        operatives {
          name
        }
        spymaster {
          name
        }
      }
    }
  }
`;

interface Game {
  redTeam: {
    operatives: {
      name: string,
    },
    spyMaster: {
      name: string,
    },
  };
  blueTeam: {
    operatives: {
      name: string,
    },
    spyMaster: {
      name: string,
    },
  };
}

export class App extends React.Component<{}, {}> {
  public render () {
    return (
      <>
        <h1>Hello, world!</h1>
        <Query query={allGamesQuery}>
          {props => {
            return (
              props.loading ? 'Loading...'
              : props.error ? 'Error'
              : props.data ? (
                  <div>
                    {props.data.allGames.map((game: Game) => (
                      <div>
                        <pre>{JSON.stringify(game, undefined, 2)}</pre>
                      </div>
                    ))}
                  </div>
                )
              : 'Error'
            );
          }}
        </Query>
      </>
    );
  }
}
