import {createSchema, Type, typedModel} from "ts-mongoose";

const VolumeSchema = createSchema({
    teamId: Type.objectId({ required: true }),
    mangaId: Type.objectId({ required: true }),

    number: Type.number({ required: true }),
    chapters: Type.array({ default: [] }).of({
        number: Type.number({ required: true }),
        name: Type.string({ required: true }),
        pages: Type.array({ required: true }).of(Type.string()),
        adaptation: Type.object().of({
            season: Type.number({ required: true }),
            series: Type.number({ required: true })
        })
    }),

    hasPreview: Type.boolean({ default: false })
});

export default typedModel("volume", VolumeSchema);
