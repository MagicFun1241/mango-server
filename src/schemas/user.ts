import {
    Type,

    createSchema,
    typedModel
} from "ts-mongoose";

import {randomDigits} from "@hapi/cryptiles";
import {supportedLocales} from "../modules/locale";

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

    email: Type.string({
        required: true,
        index: true
    }),
    userName: Type.string({
        required: true,
        index: true
    }),
    password: Type.string({ required: true }),

    role: Type.number({ default: Role.User }),
    locale: Type.string({
        required: true,
        enum: supportedLocales
    }),
    photo: Type.string({ default: "none" }),

    lists: Type.object({
        default: {
            abandoned: [],
            readed: [],
            planing: []
        }
    }).of({
        abandoned: Type.array().of(Type.objectId()),
        readed: Type.array().of(Type.objectId()),
        planing: Type.array().of(Type.objectId())
    }),
    subscribers: Type.array({ default: [] }).of(Type.objectId())
});

export default typedModel("user", UserSchema);
