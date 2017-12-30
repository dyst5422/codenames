import * as mongoose from 'mongoose';
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
}
