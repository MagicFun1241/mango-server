import {createSchema, Type, typedModel} from "ts-mongoose";
import {supportedLocales} from "../modules/locale";

import Storage from "../classes/storage";
import {Types} from "mongoose";

export enum MangaState {
    Ongoing = "ongoing",
    Released = "released"
}

export enum MangaGenre {
    Sport,
    Hentai,
    Harem,
    Thriller,
    Mecha,
    School,
    Drama,
    Fantasy,
    Shounen,
    Romance,
    Comedy
}

const Genres = [
    MangaGenre.Sport,
    MangaGenre.Hentai,
    MangaGenre.Harem,
    MangaGenre.Thriller,
    MangaGenre.Mecha,
    MangaGenre.School,
    MangaGenre.Drama,
    MangaGenre.Fantasy,
    MangaGenre.Shounen,
    MangaGenre.Romance,
    MangaGenre.Comedy
];

export function validateGenres(input: Array<any>) {
    let rep: Array<number> = [];

    for (let i = 0; i < input.length; i++) {
        let value = input[i];

        if (Genres.includes(value) && !rep.includes(value)) rep.push(value);
        else return false;
    }

    return true;
}

const MangaSchema = createSchema({
    names: Type.array({ required: true }).of({
        locale: Type.string({
            required: true,
            enum: supportedLocales
        }),
        name: Type.string({
            required: true,
            text: true
        })
    }),
    characters: Type.array({ default: null }).of(Type.objectId()),
    state: Type.string({
        default: MangaState.Ongoing,
        enum: [
            MangaState.Ongoing,
            MangaState.Released
        ]
    }),
    explicit: Type.boolean({ required: true }),
    rating: Type.object({
        default: {
            total: 0,
            reviews: []
        }
    }).of({
        total: Type.number({ required: true }),
        reviews: Type.array({ required: true }).of({
            userId: Type.string({ required: true })
        })
    }),
    translators: Type.array({ default: [] }).of(Type.objectId()),
    genres: Type.array({ default: [] }).of(Type.number({
        enum: Genres
    })),
    released: Type.number({ default: null }),
    views: Type.number({ default: 0 }),
    preview: Type.string({ default: Storage.getEmptyPreview() }),
    descriptions: Type.array({ default: [] }).of({
        locale: Type.string({
            required: true,
            enum: supportedLocales
        }),
        text: Type.string({ required: true })
    })
});

export interface MangaInterface {
    names: Array<{
        locale: string;
        name: string;
    }>;
    explicit: boolean;
    released: number;
    preview?: string;
    state: MangaState;
    translators: Array<Types.ObjectId>;
    genres: Array<MangaGenre>;
    rating: {
        total: number;
        reviews: Array<any>;
    },
    descriptions: Array<{
        locale: string;
        text: string;
    }>;
    characters: Array<Types.ObjectId>;
}

export default typedModel("manga", MangaSchema);
