import * as Mongo from 'mongodb';
import { ObjectId } from 'bson';
import { assertOne } from '../../utils/assertions';
import { Model } from './Model';



export interface TeamProps {
	operativeIds: string[],
	spymasterId: string | undefined,
}

export class Team extends Model<TeamProps> {
	public defaultProps = {
		operativeIds: [],
		spymasterId: undefined,
	}

	public async addOperative(operativeId: string) {
		await this._collection.updateOne({ _id: this.id }, { $addToSet: { operativeIds: operativeId }});
		return await this.syncProperties();
	}
}

