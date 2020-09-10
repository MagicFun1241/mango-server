import config, {isDevelopment} from "./config";

export default class Storage {
    static getPreview(id: string) {
        return `${isDevelopment ? config.env.development.host : config.env.production.host}/storage/preview/${id}.jpg`;
    }

    static getEmptyPreview() {
        return `${isDevelopment ? config.env.development.host : config.env.production.host}/storage/preview/empty.jpg`;
    }

    static getPhoto(id: string) {
        return `${isDevelopment ? config.env.development.host : config.env.production.host}/storage/photo/${id}.jpg`;
    }

    static getChapterPage(mangaId: string, volume: number, chapter: number, file: string) {
        return `${isDevelopment ? config.env.development.host : config.env.production.host}/storage/manga/${mangaId}/${volume}/${chapter}/${file}`;
    }
}