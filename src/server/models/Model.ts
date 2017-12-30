import * as Mongo from 'mongodb';
import { ObjectId } from 'bson';
import { assertOne } from '../../utils/assertions';

function hasId(thing: any): thing is { id: string } {
	return typeof thing.id === 'string';
}

export class Model<Props extends object> {
	public _collection: Mongo.Collection;
	public id: string;
  public props: Props;
	public defaultProps: Partial<Props>;

	constructor(props: { id: string } | Partial<Props>, mongoCollection: Mongo.Collection) {
		this._collection = mongoCollection;
		hasId(props)
			? this.getExistingRecord(props.id)
			: this.createNewRecord(props);
	}

	public async syncProperties() {
		const dbRecord = await (this._collection.findOne({ _id: new ObjectId(this.id) }) as Promise<{ _id: ObjectId, props: Props, }>);

		this.props = {
			...this.props as object,
			...dbRecord.props as object,
		} as Props;
		return this;
	}

	public async getExistingRecord(id: string) {
		const dbRecord = await (this._collection.findOne({ _id: new ObjectId(id) }) as Promise<{ _id: ObjectId, props: Props, }>);
		this.id = dbRecord._id.toHexString();
		
		this.props = {
			...this.props as object,
			...dbRecord.props  as object,
		}	as Props;
	}

	public async createNewRecord(props: Partial<Props>) {
		const dbRecord = assertOne((await this._collection.insertOne({ props: { ...this.defaultProps as object, ...props as object }})).ops) as { _id: ObjectId, props: Props, };
		this.id = dbRecord._id.toHexString();
		
		this.props = {
			...this.props as object,
			...dbRecord.props  as object,
		}	as Props;
	}

	public static fetch(id: string, mongoCollection: Mongo.Collection) {
		return this.prototype.constructor({ id }, mongoCollection);
	}
}