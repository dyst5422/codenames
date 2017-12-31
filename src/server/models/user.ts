import { ObjectId } from 'bson';
import * as Mongo from 'mongodb';
import { assertOne } from '../../utils/assertions';
import { Model } from './Model';

export interface UserProps {
  name: string;
}

export class User extends Model<UserProps> {
  public static async createUser(config: { id: string } | { name: string }, mongoCollection: Mongo.Collection) {
    const that = new User();
    return await Model.createModel<UserProps>(that, config, mongoCollection);
  }
}
