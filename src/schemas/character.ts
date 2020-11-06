import {createSchema, Type, typedModel} from "ts-mongoose";

import Storage from "../classes/storage";

const CharacterSchema = createSchema({
    names: Type.array({ required: true }).of({
        locale: Type.string({ required: true }),
        name: Type.string({ required: true })
    }),
    photo: Type.string({ default: Storage.getEmptyPreview() })
});

export default typedModel("character", CharacterSchema);
