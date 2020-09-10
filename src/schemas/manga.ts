import {createSchema, Type, typedModel} from "ts-mongoose";
import Storage from "../classes/storage";

export enum MangaState {
    Ongoing = "ongoing",
    Released = "released"
}

export enum MangaGenre {
    Sport,
    Yuri,
    Garem,
    Thriller,
    Mecha
}

const Genres = [
    MangaGenre.Sport,
    MangaGenre.Yuri,
    MangaGenre.Garem
];

export function validateGenres(input: Array<number>) {
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
    name: Type.string({
        required: true,
        text: true
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
        sum: Type.number({ default: 0 }),
        reviews: Type.array({ default: [] }).of({
            userId: Type.string({ required: true })
        }),
    }),
    genres: Type.array({ default: [] }).of(Type.number({
        enum: Genres
    })),
    releaseDate: Type.string({ default: null }),
    preview: Type.string({ default: Storage.getEmptyPreview() }),
    description: Type.string({ default: "No" })
});

export default typedModel("manga", MangaSchema);