import {createSchema, Type, typedModel} from "ts-mongoose";
import Storage from "../classes/storage";
import {supportedLocales} from "../modules/locale";

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
    Fantasy
}

const Genres = [
    MangaGenre.Sport,
    MangaGenre.Hentai,
    MangaGenre.Harem,
    MangaGenre.Thriller,
    MangaGenre.Mecha,
    MangaGenre.School,
    MangaGenre.Drama,
    MangaGenre.Fantasy
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

export interface MangaInterface {
    name: string;
    preview?: string;
    description: string;
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
    state: Type.string({
        default: MangaState.Ongoing,
        enum: [
            MangaState.Ongoing,
            MangaState.Released
        ]
    }),
    explicit: Type.boolean({ required: true }),
    rating: Type.object().of({
        total: Type.number({ default: 0 }),
        reviews: Type.array({ default: [] }).of({
            userId: Type.string({ required: true })
        })
    }),
    translators: Type.array({ default: [] }).of(Type.objectId()),
    genres: Type.array({ default: [] }).of(Type.number({
        enum: Genres
    })),
    released: Type.string({ default: null }),
    preview: Type.string({ default: Storage.getEmptyPreview() }),
    description: Type.string({ default: "No" })
});

export default typedModel("manga", MangaSchema);