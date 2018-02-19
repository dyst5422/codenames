import * as React from 'react';

export enum Faction {
  Unknown,
  Blue,
  Red,
  Neutral,
  Assassin,
}

export interface CardProps {
  word: string;
  faction: Faction;
}
export class Card extends React.Component<CardProps, {}> {

  public render () {
    return (
      <div style={this.getStyle()}>
        <h3>{this.props.word}</h3>
      </div>
    );
  }

  private getStyle = () => {
    switch (this.props.faction) {
      case Faction.Unknown: {
        return { backgroundColor: 'White' };
      }
      case Faction.Blue: {
        return { backgroundColor: 'Blue' };
      }
      case Faction.Red: {
        return { backgroundColor: 'Red' };
      }
      case Faction.Neutral: {
        return { backgroundColor: 'Beige' };
      }
      case Faction.Assassin: {
        return { backgroundColor: 'Black', color: 'White' };
      }
      default: {
        return {};
      }
    }
  }
}
