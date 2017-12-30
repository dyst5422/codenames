import * as Mongo from 'mongodb';
import { ObjectId } from 'bson';
import { assertOne } from '../../utils/assertions';
import { Model } from './Model';

export interface UserProps {
	name: string;
}

export class User extends Model<UserProps> {
	public name: string;
}


