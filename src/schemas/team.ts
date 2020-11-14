import {createSchema, Type, typedModel} from "ts-mongoose";

const TeamSchema = createSchema({
    name: Type.string({ required: true }),
    owner: Type.objectId({ required: true }),
    photo: Type.string({ default: "empty" }),
    description: Type.string({ default: "empty" }),
    members: Type.array({ default: [] }).of(Type.objectId())
});

export interface TeamInterface {
    _id: string;
    name: string;
    owner: string;
    photo: string;
    description: string;
    members: Array<string>;
}

export default typedModel("team", TeamSchema);
