import {createSchema, Type, typedModel} from "ts-mongoose";

export enum MangaState {
    Ongoing = "ongoing",
    Released = "released"
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
    rating: Type.object().of({
        sum: Type.number({ default: 0 }),
        reviews: Type.array({ default: [] }).of({
            userId: Type.string({ required: true })
        }),
    }),
    releaseDate: Type.string({ default: null }),
    preview: Type.string({ default: "http://localhost:3000/storage/preview/empty.jpg" }),
    description: Type.string({ default: "No" })
});

export default typedModel("manga", MangaSchema);