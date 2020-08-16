import {createSchema, Type, typedModel} from "ts-mongoose";

const MangaSchema = createSchema({
    name: Type.string({
        required: true,
        text: true
    }),
    preview: Type.string({ default: "http://localhost:3000/storage/preview/empty.jpg" }),
    description: Type.string({ default: "No" })
});

export interface MangaInterface {
    name: string;
    preview?: string;
    description: string;
}

export default typedModel("manga", MangaSchema);