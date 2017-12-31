import * as Mongo from 'mongodb';
import { Card, Faction, Game, GameProps, Stage } from './models/Game';
import { Model } from './models/Model';
import { Team, TeamProps } from './models/Team';
import { User, UserProps } from './models/User';

export function createResolvers(db: Mongo.Db) {
  const usersCollection = db.collection('users');
  const teamsCollection = db.collection('teams');
  const gamesCollection = db.collection('games');
  return {
    Queries: {
      user: async (_: undefined, args: { userId: string }) =>
        await User.createUser({ id: args.userId }, usersCollection),
      allUsers: async () =>
        (await usersCollection.find({}, { _id: 1 }).toArray()).map(user =>
          User.createUser({ id: user._id.toHexString() }, usersCollection),
        ),
      team: async (_: undefined, args: { userId: string }) =>
        await Team.createTeam({ id: args.userId }, teamsCollection),
      allTeams: async () =>
        (await teamsCollection.find({}, { _id: 1 }).toArray()).map(team =>
          Team.createTeam({ id: team._id.toHexString() }, teamsCollection),
        ),
      game: async (_: undefined, args: { userId: string }) =>
        await Game.createGame({ id: args.userId }, gamesCollection),
      allGames: async () =>
        (await gamesCollection.find({}, { _id: 1 }).toArray()).map(game =>
          Game.createGame({ id: game._id.toHexString() }, gamesCollection),
        ),
    },
    Mutations: {
      createUser: async (_: undefined, args: { name: string }) => await User.createUser(args, usersCollection),
      createTeam: async () => Team.createTeam({}, teamsCollection),
      createGame: async (_: undefined, args: { redId: string; blueId: string }) => Game.createGame(args, gamesCollection),
    },
    User: {
      name: (userObj: User) => userObj.props.name,
    },
    Team: {
      operativeIds: (teamObj: Team) => teamObj.props.operativeIds,
      operatives: async (teamObj: Team) =>
        await teamObj.props.operativeIds.map(async id => await User.createUser({ id }, usersCollection)),
      spymasterId: (teamObj: Team) => teamObj.props.spymasterId,
      spymaster: async (teamObj: Team) =>
        teamObj.props.spymasterId
          ? await User.createUser({ id: teamObj.props.spymasterId }, usersCollection)
          : undefined,
      addOperative: async (teamObj: Team, args: { operativeId: string }) =>
        await teamObj.addOperative(args.operativeId),
      promoteToSpymaster: async (teamObj: Team, args: { spymasterId: string }) =>
        await teamObj.promoteToSpymaster(args.spymasterId),
    },
    Game: {
      redTeamId: (gameObj: Game) => gameObj.props.redId,
      redTeam: async (gameObj: Game) => await Team.createTeam({ id: gameObj.props.redId }, teamsCollection),
      blueTeamId: (gameObj: Game) => gameObj.props.blueId,
      blueTeam: async (gameObj: Game) => await Team.createTeam({ id: gameObj.props.blueId }, teamsCollection),
      stage: (gameObj: Game) => gameObj.props.stage,
      cards: (gameObj: Game) => gameObj.props.cards,
      lastHint: (gameObj: Game) => gameObj.props.lastHint,
      reveal: async (gameObj: Game, args: { word: string }, context: { userId: string }) => {
        const redTeam = await Team.createTeam({ id: gameObj.props.redId }, teamsCollection);
        const blueTeam = await Team.createTeam({ id: gameObj.props.blueId }, teamsCollection);

        const faction = redTeam.props.operativeIds.includes(context.userId)
          ? Faction.RED
          : blueTeam.props.operativeIds.includes(context.userId) ? Faction.BLUE : undefined;
        if (faction == undefined) throw new Error('Not an operative in this game');

        return await gameObj.reveal(args.word, faction);
      },
      hint: async (gameObj: Game, args: { word: string; numCards: number }, context: { userId: string }) => {
        const redTeam = await Team.createTeam({ id: gameObj.props.redId }, teamsCollection);
        const blueTeam = await Team.createTeam({ id: gameObj.props.blueId }, teamsCollection);

        const faction =
          redTeam.props.spymasterId === context.userId
            ? Faction.RED
            : blueTeam.props.spymasterId === context.userId ? Faction.BLUE : undefined;
        if (faction == undefined) throw new Error('Not a spymaster in this game');
        return await gameObj.hint(args.word, args.numCards, faction);
      },
    },
  };
}
