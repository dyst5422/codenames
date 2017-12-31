import { ObjectId } from 'bson';
import { shuffle } from 'lodash';
import * as Mongo from 'mongodb';
import { assertOne } from '../../utils/assertions';
import { nouns } from '../nouns';
import { Model } from './Model';

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

export interface Card {
  word: string;
  faction: Faction;
  revealed: boolean;
}

export interface GameProps {
  redId: string;
  blueId: string;
  stage: Stage;
  cards: Card[];
  lastHint: {
    word: string;
    numCards: number;
  } | undefined;
}

const NUM_CARDS = 25;
const thirdOfCards = Math.floor((NUM_CARDS - 1) / 3);
const numFirst = thirdOfCards + 1;
const numSecond = thirdOfCards;
const numLeft = thirdOfCards - 1;

export class Game extends Model<GameProps> {
  public async reveal(word: string, faction: Faction) {
    await this.syncProperties();
    if (!(
      (this.props.stage === Stage.BLUE_REVEAL && faction === Faction.BLUE)
      ||
      (this.props.stage === Stage.RED_REVEAL && faction === Faction.RED)
    )) {
      throw new Error('Not your turn to reveal a card.');
    }
    const revealedCard = assertOne(this.props.cards.filter(card => card.word === word));

    if (revealedCard.revealed === true) {
      throw new Error('Card already revealed.');
    }

    await this._collection.updateOne({
      '_id': new ObjectId(this.id),
      'props.cards.word': word,
    }, {
      $set: { 'props.cards.$.revealed': true }
    });

    if (revealedCard.faction === Faction.ASSASSIN) {
      await this._transitionStage(faction === Faction.RED ? Faction.BLUE : Faction.RED);
    } else if (revealedCard.faction !== faction) {
      await this._transitionStage();
    }

    if (this.props.cards.filter(card => card.faction === Faction.RED).some(card => card.revealed === false)) {
      await this._transitionStage(Faction.RED);
    } else if (this.props.cards.filter(card => card.faction === Faction.BLUE).some(card => card.revealed === false)) {
      await this._transitionStage(Faction.BLUE);
    }

    await this.syncProperties();

    return assertOne(this.props.cards.filter(card => card.word === word));
  }

  public async hint(word: string, numCards: number, faction: Faction) {
    if (!(
      (this.props.stage === Stage.BLUE_HINT && faction === Faction.BLUE)
      ||
      (this.props.stage === Stage.RED_HINT && faction === Faction.RED)
    )) {
      throw new Error('Not your turn to provide a hint.');
    }

    await this._collection.updateOne({
      _id: new ObjectId(this.id),
    }, {
      $set: {
        'props.lastHint': {
          word,
          numCard: numCards,
        },
      },
    });

    await this.syncProperties();
    return this.props.lastHint;
  }

  private async _transitionStage(winner?: Faction.BLUE | Faction.RED) {
    let newStage: Stage;
    if (winner != undefined) {
      if (winner === Faction.RED) {
        newStage = Stage.RED_WON;
      } else if (winner === Faction.BLUE) {
        newStage = Stage.BLUE_WON;
      }
    }
    switch (this.props.stage) {
      case Stage.BLUE_HINT: {
        newStage = Stage.BLUE_REVEAL;
        break;
      }
      case Stage.BLUE_REVEAL: {
        newStage = Stage.RED_HINT;
        break;
      }
      case Stage.RED_HINT: {
        newStage = Stage.RED_REVEAL;
        break;
      }
      case Stage.RED_REVEAL: {
        newStage = Stage.BLUE_HINT;
        break;
      }
      default:
        newStage = this.props.stage;
    }

    await this._collection.updateOne({
      _id: new ObjectId(this.id),
    }, {
      $set: { 'props.stage': newStage },
    });
  }

  public static async createGame(config: { id: string } | { redId: string, blueId: string }, mongoCollection: Mongo.Collection) {
    const that = new Game();
    return await Model.createModel<GameProps>(that, {
      stage: Stage.RED_HINT,
      cards: shuffle(shuffle(nouns).slice(0, NUM_CARDS).map((word, idx) => ({
          word,
          faction:
            idx < thirdOfCards + 1 ? Faction.RED :
            idx < 2 * thirdOfCards ? Faction.BLUE :
            idx === 2 * thirdOfCards ? Faction.ASSASSIN :
            Faction.BYSTANDER,
          revealed: false,
        }))),
      lastHint: undefined,
      ...config,
    }, mongoCollection);
  }
}
