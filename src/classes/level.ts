import level = require("level");

export default class Level {
    private storage;

    constructor(path: string) {
        this.storage = level(path);
    }

    get(key: string) {
        return new Promise<string>((resolve, reject) => {
            this.storage.get(key, function (err, value) {
                if (err) return reject(err);

                resolve(value);
            });
        });
    }

    set(key: string, value: string) {
        return new Promise<void>((resolve, reject) => {
            this.storage.put(key, value, function (err) {
                if (err) return reject(err);

                resolve();
            });
        });
    }

    has(key: string) {
        return new Promise<boolean>((resolve, reject) => {
            this.get(key).then(() => resolve(true)).catch(e => {
               if (e.notFound) resolve(false);
               else reject(e);
            });
        });
    }

    delete(key: string) {
        return new Promise<void>((resolve, reject) => {
            this.storage.del(key, function (err) {
                if (err) return reject(err);

                resolve();
            });
        });
    }
}
