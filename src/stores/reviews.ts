import * as path from "path";

import * as NodeCache from "node-cache";

import Datastore = require("nedb-promises");

interface Review {

}

const cache = new NodeCache({
    stdTTL: 2 * 60
});

cache.on("expired", (key, value) => {
    stores.delete(key);
});

const stores = new Map<string, Datastore>();

function load(id: string): Promise<Datastore> {
    return new Promise<Datastore>((resolve) => {
        const proxy = new Proxy(Datastore.create({
            autoload: true,
            filename: path.join(process.cwd(), "stores", id)
        }), {});

        stores.set(id, proxy);

        resolve(proxy);
    });
}

export function get(id: string, count: number): Promise<Review[]> {
    return new Promise<Review[]>((resolve) => {
        if (stores.has(id)) {
            stores.get(id).find({}).limit(count).then(reviews => {
                resolve(reviews);
            });
        } else {
            load(id).then(store => {
                store.find({}).limit(count).then(reviews => {
                    resolve(reviews);
                });
            });
        }
    });
}

export function insert(id: string, item: Review): Promise<void> {
    return new Promise<void>((resolve) => {
        if (stores.has(id)) {
            stores.get(id).insert(item).then(() => resolve());
        } else {
            load(id).then(store => {
                store.insert(item).then(() => resolve());
            });
        }
    });
}
