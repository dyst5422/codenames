import { PubSub } from 'graphql-subscriptions';
import * as Mongo from 'mongodb';
import { Card, Faction, Game, GameProps, Hint, Stage } from './models/Game';
import { Model } from './models/Model';
import { Team, TeamProps } from './models/Team';
import { User, UserProps } from './models/User';

const pubsub = new PubSub();

export function createResolvers(db: Mongo.Db) {
  const usersCollection = db.collection('users');
  const teamsCollection = db.collection('teams');
  const gamesCollection = db.collection('games');
  return {
    Queries: {
      user: async (_: undefined, args: { userId: string }) =>
        User.createUser({ id: args.userId }, usersCollection),
      allUsers: async () =>
        (await usersCollection.find({}, { projection: { _id: 1 } }).toArray()).map(user =>
          User.createUser({ id: user._id.toHexString() }, usersCollection),
        ),
      team: async (_: undefined, args: { teamId: string }) =>
        Team.createTeam({ id: args.teamId }, teamsCollection),
      allTeams: async () =>
        (await teamsCollection.find({}, { projection: { _id: 1 } }).toArray()).map(team =>
          Team.createTeam({ id: team._id.toHexString() }, teamsCollection),
        ),
      game: async (_: undefined, args: { gameId: string }) =>
        Game.createGame({ id: args.gameId }, gamesCollection),
      allGames: async () =>
        (await gamesCollection.find({}, { projection: { _id: 1 } }).toArray()).map(game =>
          Game.createGame({ id: game._id.toHexString() }, gamesCollection),
        ),
    },
    Mutations: {
      createUser: async (_: undefined, args: { name: string }) => User.createUser(args, usersCollection),
      createTeam: async () => Team.createTeam({}, teamsCollection),
      createGame: async (_: undefined, args: { redId: string; blueId: string }) =>
        Game.createGame(args, gamesCollection),
    },
    Subscriptions: {
      gameCards: {
        subscribe: (_: undefined, args: { gameId: string }) => pubsub.asyncIterator(`${args.gameId}.cards`),
        resolve: (payload: Card) => payload,
      },
      gameHints: {
        subscribe: (_: undefined, args: { gameId: string }) => pubsub.asyncIterator(`${args.gameId}.hints`),
        resolve: (payload: Hint) =>  payload,
      },
    },
    User: {
      name: (userObj: User) => userObj.props.name,
    },
    Team: {
      operativeIds: (teamObj: Team) => teamObj.props.operativeIds,
      operatives: async (teamObj: Team) =>
        Promise.all(teamObj.props.operativeIds.map(async id => await User.createUser({ id }, usersCollection))),
      spymasterId: (teamObj: Team) => teamObj.props.spymasterId,
      spymaster: async (teamObj: Team) =>
        teamObj.props.spymasterId
          ? await User.createUser({ id: teamObj.props.spymasterId }, usersCollection)
          : undefined,
      addOperative: async (teamObj: Team, args: { operativeId: string }) =>
        teamObj.addOperative(args.operativeId),
      promoteToSpymaster: async (teamObj: Team, args: { spymasterId: string }) =>
        teamObj.promoteToSpymaster(args.spymasterId),
    },
    Game: {
      redTeamId: (gameObj: Game) => gameObj.props.redId,
      redTeam: async (gameObj: Game) => Team.createTeam({ id: gameObj.props.redId }, teamsCollection),
      blueTeamId: (gameObj: Game) => gameObj.props.blueId,
      blueTeam: async (gameObj: Game) => Team.createTeam({ id: gameObj.props.blueId }, teamsCollection),
      stage: (gameObj: Game) => gameObj.props.stage,
      cards: async (gameObj: Game, _args: undefined, context: { userId: string }) => {
        const redTeam = await Team.createTeam({ id: gameObj.props.redId }, teamsCollection);
        const blueTeam = await Team.createTeam({ id: gameObj.props.blueId }, teamsCollection);

        const isSpymaster =
          redTeam.props.spymasterId === context.userId
          || blueTeam.props.spymasterId === context.userId;

        if (isSpymaster) return gameObj.props.cards;

        return gameObj.props.cards.map(card => ({
          word: card.word,
          revealed: card.revealed,
          faction: card.revealed ? card.faction : undefined,
        }));
      },
      lastHint: (gameObj: Game) => gameObj.props.lastHint,
      reveal: async (gameObj: Game, args: { word: string }, context: { userId: string }) => {
        const redTeam = await Team.createTeam({ id: gameObj.props.redId }, teamsCollection);
        const blueTeam = await Team.createTeam({ id: gameObj.props.blueId }, teamsCollection);

        const faction =
          redTeam.props.operativeIds.includes(context.userId) ? Faction.RED
          : blueTeam.props.operativeIds.includes(context.userId) ? Faction.BLUE
          : undefined;

        if (faction == undefined) throw new Error('Not an operative in this game');
        const card = await gameObj.reveal(args.word, faction);
        pubsub.publish(`${gameObj.id}.cards`, card);
        return gameObj;
      },
      hint: async (gameObj: Game, args: { word: string; numCards: number }, context: { userId: string }) => {
        const redTeam = await Team.createTeam({ id: gameObj.props.redId }, teamsCollection);
        const blueTeam = await Team.createTeam({ id: gameObj.props.blueId }, teamsCollection);

        const faction =
          redTeam.props.spymasterId === context.userId ? Faction.RED
          : blueTeam.props.spymasterId === context.userId ? Faction.BLUE
          : undefined;

        if (faction == undefined) throw new Error('Not a spymaster in this game');
        const hint = await gameObj.hint(args.word, args.numCards, faction);
        pubsub.publish(`${gameObj.id}.hints`, hint);
        return gameObj;
      },
    },
  };
}


pubsub.subscribe('5a4842a943ceb73a035a662b.hints', dat => console.log('hints', dat));
pubsub.subscribe('5a4842a943ceb73a035a662b.cards', dat => console.log('cards', dat));
