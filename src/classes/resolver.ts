import * as NodeCache from "node-cache";

export function Test<T extends { new (...args: any[]): {} }>(
    constructor: T
) {
    return class extends constructor {
        constructor(...args) {
            super(...args);
        }

        static findById() {

        }
    };
}

export default class Resolver<T> {
    private model;
    private cache: NodeCache;

    constructor(model) {
        this.model = model;
    }

    findById(id: string): Promise<T> {
        return new Promise<any>((resolve, reject) => {
            if (this.cache.has(id)) resolve(this.cache.get(id));
            else {
                this.model.findById(id).then(doc => {
                    if (doc == null) return reject(new Error("Not found"));

                    resolve(doc);

                    this.cache.set(id, doc, 5 * 60);
                });
            }
        });
    }
}