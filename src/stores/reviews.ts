import * as fs from 'fs';
import * as path from "path";

import * as NodeCache from "node-cache";

import Datastore = require("nedb-promises");

import {
    Types
} from "mongoose";

interface Review {
    _id?: string;

    userId: string;
    created: number;
}

const cache = new NodeCache({
    stdTTL: 1 * 60
});

cache.on("expired", (key, value) => {
    console.log("expired")
    stores.delete(key);
});

const stores = new Map<string, Datastore>();

function load(id: string): Promise<Datastore> {
    return new Promise<Datastore>((resolve) => {
        const storesDir = path.join(process.cwd(), "storage", "stores");

        if (!fs.existsSync(storesDir)) fs.mkdirSync(storesDir, { recursive: true });

        const proxy = new Proxy(Datastore.create({
            autoload: true,
            filename: path.join(storesDir, id)
        }), {});

        stores.set(id, proxy);

        resolve(proxy);
    });
}

export default class ReviewsStorage {
    static getLast(id: string | Types.ObjectId, count: number): Promise<Review[]> {
        // @ts-ignore
        const rid: string = (id instanceof Types.ObjectId) ? id.toString() : id;

        return new Promise<Review[]>((resolve) => {
            if (stores.has(rid)) {
                stores.get(rid).find<Review>({}).limit(count).then(reviews => {
                    resolve(reviews);
                });
            } else {
                load(rid).then(store => {
                    store.find<Review>({}).limit(count).then(reviews => {
                        resolve(reviews);
                    });
                });
            }
        });
    }

    static has(mangaId: string | Types.ObjectId, userId: string): Promise<boolean> {
        return new Promise<boolean>((resolve, _) => {
            // @ts-ignore
            const rid: string = (mangaId instanceof Types.ObjectId) ? mangaId.toString() : mangaId;

            if (stores.has(rid)) {
                stores.get(rid).findOne<Review>({ userId: userId }).then(d => resolve(d != null));
            } else {
                load(rid).then(store => {
                    store.findOne<Review>({ userId: userId }).then(d => resolve(d != null));
                });
            }
        });
    }

    static insert(mangaId: string | Types.ObjectId, item: Review): Promise<Review> {
        return new Promise<Review>((resolve) => {
            // @ts-ignore
            const rid: string = (mangaId instanceof Types.ObjectId) ? mangaId.toString() : mangaId;

            if (stores.has(rid)) {
                stores.get(rid).insert(item).then(d => resolve(d));
            } else {
                load(rid).then(store => {
                    store.insert(item).then(d => resolve(d));
                });
            }
        });
    }

    static remove(mangaId: string | Types.ObjectId, userId: string | Types.ObjectId) {
        return new Promise<void>((resolve) => {
            // @ts-ignore
            const rid: string = (mangaId instanceof Types.ObjectId) ? mangaId.toString() : mangaId;

            // @ts-ignore
            const uid: string = (userId instanceof Types.ObjectId) ? userId.toString() : userId;

            if (stores.has(rid)) {
                stores.get(rid).remove({ userId: uid }, {}).then(() => resolve());
            } else {
                load(rid).then(store => {
                    store.remove({ userId: uid }, {}).then(() => resolve());
                });
            }
        });
    }
}
