import { ObjectId } from 'bson';
import * as Mongo from 'mongodb';
import { assertOne } from '../../utils/assertions';

function hasId(thing: any): thing is { id: string } {
  return typeof thing.id === 'string';
}

export class Model<Props extends object> {
  public _collection: Mongo.Collection;
  public id: string;
  public props: Props;

  public async syncProperties() {
    const dbRecord = await (this._collection.findOne({ _id: new ObjectId(this.id) }) as Promise<{
      _id: ObjectId;
      props: Props;
    }>);

    this.props = {
      ...(dbRecord.props as object),
    } as Props;
    return this;
  }

  public async getExistingRecord(id: string) {
    const dbRecord = await (this._collection.findOne({ _id: new ObjectId(id) }) as Promise<{
      _id: ObjectId;
      props: Props;
    }>);
    this.id = dbRecord._id.toHexString();

    this.props = {
      ...(dbRecord.props as object),
    } as Props;

    return this;
  }

  public async createNewRecord(props: Partial<Props>) {
    const dbRecord = assertOne((await this._collection.insertOne({ props: { ...(props as object) } })).ops) as {
      _id: ObjectId;
      props: Props;
    };

    this.id = dbRecord._id.toHexString();

    this.props = {
      ...(dbRecord.props as object),
    } as Props;
    return this;
  }

  public static fetch(id: string, mongoCollection: Mongo.Collection) {
    return this.prototype.constructor({ id }, mongoCollection);
  }

  public static async createModel<Props extends object>(
    that: Model<Props>,
    config: { id: string } | Partial<Props>,
    mongoCollection: Mongo.Collection,
  ) {
    that._collection = mongoCollection;

    return hasId(config) ? that.getExistingRecord(config.id) : that.createNewRecord(config);
  }
}
