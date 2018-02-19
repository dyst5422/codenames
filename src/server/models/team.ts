import { ObjectId } from 'bson';
import { PubSub } from 'graphql-subscriptions/dist/pubsub';
import * as Mongo from 'mongodb';
import { assertOne } from '../../utils/assertions';
import { Model } from './Model';

export interface TeamProps {
  operativeIds: string[];
  spymasterId: string | undefined;
}

export class Team extends Model<TeamProps> {
  public async addOperative(operativeId: string) {
    await this._collection.updateOne({ _id: new ObjectId(this.id) }, { $addToSet: { 'props.operativeIds': operativeId } });
    return await this.syncProperties();
  }

  public async promoteToSpymaster(spymasterId: string) {
    await this._collection.updateOne(
      { _id: new ObjectId(this.id) },
      {
        $pull: { 'props.operativeIds': spymasterId },
        $set: { 'props.spymasterId': spymasterId },
      },
    );

    return await this.syncProperties();
  }

  public static async createTeam(config: { id: string } | Partial<TeamProps>, mongoCollection: Mongo.Collection) {
    const that = new Team();

    return await Model.createModel<TeamProps>(
      that,
      {
        operativeIds: [],
        spymasterId: undefined,
        ...config,
      },
      mongoCollection,
    );
  }
}
