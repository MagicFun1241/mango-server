import {createSchema, Type, typedModel} from "ts-mongoose";

const NewsSchema = createSchema({
    title: Type.string({ required: true }),
    preview: Type.string({ required: true }),
    creatorId: Type.objectId({ required: true }),
    text: Type.string({ required: true })
});

export default typedModel("news", NewsSchema);