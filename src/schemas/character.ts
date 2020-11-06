import {createSchema, Type, typedModel} from "ts-mongoose";

const CharacterSchema = createSchema({
    names: Type.array({ required: true }).of({
        locale: Type.string({ required: true }),
        name: Type.string({ required: true })
    }),
    descriptions: Type.array({ required: true }).of({
        locale: Type.string({ required: true }),
        text: Type.string({ required: true })
    }),
    photo: Type.string({ default: "empty" })
});

export default typedModel("character", CharacterSchema);
