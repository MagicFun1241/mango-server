import config, {isDevelopment} from "./config";

export enum PreviewType {
    Manga = "manga",
    News = "news"
}

export default class Storage {
    static getPreview(type: PreviewType, id: string) {
        return `${isDevelopment ? config.env.development.host : config.env.production.host}/storage/preview/${type}/${id}.jpg`;
    }

    static getEmptyPreview() {
        return `${isDevelopment ? config.env.development.host : config.env.production.host}/storage/preview/empty.jpg`;
    }

    static getPhoto(id: string) {
        return `${isDevelopment ? config.env.development.host : config.env.production.host}/storage/photo/${id}.jpg`;
    }

    static getChapterPage(teamId: string, mangaId: string, volume: number, chapter: number, file: string) {
        return `${isDevelopment ? config.env.development.host : config.env.production.host}/storage/teams/${teamId}/manga/${mangaId}/${volume}/${chapter}/${file}`;
    }
}