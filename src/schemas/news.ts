import {Types} from "mongoose";

import {createSchema, Type, typedModel} from "ts-mongoose";

const NewsSchema = createSchema({
    title: Type.string({ required: true }),
    preview: Type.string({ required: true }),
    creatorId: Type.objectId({ required: true }),
    text: Type.string({ required: true })
});

export interface NewsInterface {
    title: string;
    preview: string;
    creatorId: Types.ObjectId;
    text: string;
}

export default typedModel("news", NewsSchema);
