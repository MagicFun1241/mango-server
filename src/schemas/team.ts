import {createSchema, Type, typedModel} from "ts-mongoose";

const TeamSchema = createSchema({
    name: Type.string({ required: true }),
    owner: Type.objectId({ required: true }),
    members: Type.array({ default: [] }).of(Type.objectId())
});

export interface TeamInterface {
    _id: string;
    name: string;
    owner: string;
    members: Array<string>;
}

export default typedModel("team", TeamSchema);