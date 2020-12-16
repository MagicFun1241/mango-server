import * as NodeCache from "node-cache";

import {Document, Model} from "mongoose";
// import {Extract} from "ts-mongoose";

type Merge<T, U> = Omit<T, keyof U> & U;

interface Object {
    _id: string;

    remove(): Promise<void>;
    save(): Promise<void>;
}

interface Resolver<T> {
    findOne<T>(query: any): Promise<Merge<Object, T>>;
    findById<T>(id: string): Promise<Merge<Object, T>>;

    insert<T>(data: any): Promise<Merge<Object, T>>;
}

export default function createResolver<T>(model: Model<Document & any>, ttl: number = 0): Resolver<T> {
    const cache = new NodeCache({
        stdTTL: ttl
    });

    function createObject(obj: any) {
        return Object.assign({
            remove: () => {
                obj.remove().then(() => {
                    if (cache.has(obj._id)) cache.del(obj._id);
                });
            }
        }, obj);
    }

    return {
        insert<T>(data: any): Promise<Merge<Object, T>> {
            return new Promise<Merge<Object, T>>((resolve, reject) => {
                new model(data).then(o => resolve(o)).catch(e => reject(e));
            });
        },
        findById<T>(id: string): Promise<T> {
            return new Promise<T>((resolve) => {
                if (cache.has(id)) resolve(createObject(cache.get(id)));
                else model.findById(id).then(o => resolve(o));
            });
        },
        findOne<T>(query: any): Promise<T> {
            return Promise.resolve(undefined);
        }
    }
}
