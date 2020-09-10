import {
    Type,

    createSchema,
    typedModel
} from "ts-mongoose";

import {randomDigits} from "@hapi/cryptiles";

const SESSION_ID_SIZE = 12;

export function generateSessionId() {
    return parseInt(randomDigits(SESSION_ID_SIZE));
}

export enum Role {
    User,
    Moderator,
    Administrator,
    Creator
}

const UserSchema = createSchema({
    sessionId: Type.number({ default: generateSessionId() }),

    firstName: Type.string({ required: true }),
    lastName: Type.string({ required: true }),

    email: Type.string({ required: true }),
    userName: Type.string({ required: true }),
    password: Type.string({ required: true }),

    role: Type.number({ default: Role.User }),
    photo: Type.string({ default: "none" }),

    lists: Type.object({
        default: {
            favorite: [],
            reading: [],
            readed: []
        }
    }).of({
        favorite: Type.array().of(Type.objectId()),
        reading: Type.array().of(Type.objectId()),
        readed: Type.array().of(Type.objectId())
    }),
    subscribers: Type.array({ default: [] }).of(Type.objectId())
});

export default typedModel("user", UserSchema);