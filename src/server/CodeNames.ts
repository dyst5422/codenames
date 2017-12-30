import { random, shuffle } from 'lodash';
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

export class CodeNames {
  public cards: ICard[];
  public stage: Stage;
  public lastHint: [string, number];

  constructor(numCards: number = 25) {
    const redTeamGoingFirst = random(1, false);

    this.stage = redTeamGoingFirst ? Stage.RED_HINT : Stage.BLUE_HINT;

    const firstTeam = redTeamGoingFirst ? Faction.RED : Faction.BLUE;
    const secondTeam = redTeamGoingFirst ? Faction.BLUE : Faction.RED;

    const wordlist = shuffle(nouns).slice(0, numCards);

    const thirdOfCards = Math.floor((numCards - 1) / 3);
    const numFirst = thirdOfCards + 1;
    const numSecond = thirdOfCards;
    const numLeft = thirdOfCards - 1;

    this.cards = shuffle(wordlist.map((word, idx) => ({
      word,
      faction:
        idx < thirdOfCards + 1 ? firstTeam :
        idx < 2 * thirdOfCards ? secondTeam :
        idx === 2 * thirdOfCards ? Faction.ASSASSIN :
        Faction.BYSTANDER,
      revealed: false,
    })));
  }

  public reveal(faction: Faction.RED | Faction.BLUE, word: string): ICard {
    if (!(
      (this.stage === Stage.BLUE_REVEAL && faction === Faction.BLUE)
      ||
      (this.stage === Stage.RED_REVEAL && faction === Faction.RED)
    )) {
      throw new Error('Not your turn to reveal a card.');
    }

    const revealedCard = assertOne(this.cards.filter(card => card.word === word));

    if (revealedCard.revealed === true) {
      throw new Error('Card already revealed.');
    }
    revealedCard.revealed = true;

    if (revealedCard.faction === Faction.ASSASSIN) {
      this._transitionStage(faction === Faction.RED ? Faction.BLUE : Faction.RED);
    }

    if (revealedCard.faction !== faction) {
      this._transitionStage();
    }

    if (this.cards.filter(card => card.faction === Faction.RED).some(card => card.revealed === false)) {
      this._transitionStage(Faction.RED);
    } else if (this.cards.filter(card => card.faction === Faction.BLUE).some(card => card.revealed === false)) {
      this._transitionStage(Faction.BLUE);
    }

    return revealedCard;
  }

  public hint(faction: Faction.RED | Faction.BLUE, word: string, numCard: number) {
    if (!(
      (this.stage === Stage.BLUE_HINT && faction === Faction.BLUE)
      ||
      (this.stage === Stage.RED_HINT && faction === Faction.RED)
    )) {
      throw new Error('Not your turn to provide a hint.');
    }
    if (this.cards.map(card => card.word).includes(word)) {
      throw new Error('Not allowed to hint any words on the cards.');
    }
    this.lastHint = [word, numCard];
    this._transitionStage();
  }

  private _transitionStage(stage: Stage, winner?: Faction.BLUE | Faction.RED): Stage {
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

}
