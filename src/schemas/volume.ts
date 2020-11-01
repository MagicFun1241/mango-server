import {createSchema, Type, typedModel} from "ts-mongoose";

const VolumeSchema = createSchema({
    teamId: Type.objectId({ required: true }),
    mangaId: Type.objectId({ required: true }),

    number: Type.number({ required: true }),
    preview: Type.string({ default: "" }),
    chapters: Type.array({ default: [] }).of({
        number: Type.number({ required: true }),
        name: Type.string({ required: true }),
        pages: Type.array({ required: true }).of(Type.string())
    })
});

export default typedModel("volume", VolumeSchema);