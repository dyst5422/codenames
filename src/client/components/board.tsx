import * as React from 'React';

import { Card, Faction } from './card';

export interface BoardProps {
  words: string[][]
}
export class Board extends React.Component<BoardProps, {}> {
  public render () {
    return (
      <div>
        {this.props.words.map(row => (
          row.map(word => (
            <Card word={word} faction={Faction.Unknown} />
          ))
        ))};
      </div>
    );
  }
}
