import * as jwt from "express-jwt";

import {Request}from "express";
import User, {Role} from "../schemas/user";

export const JWT_SECRET = "test";

type Modify<T, R> = Pick<T, Exclude<keyof T, keyof R>> & R

export interface TokenPayload {
    userId: string;
    role: Role;
    sessionId: number;
}

export interface JwtRequest extends Modify<Request, {
    user: TokenPayload
}> {}

const jwtMiddleware = jwt({
    secret: JWT_SECRET,
    algorithms: [
        "HS256"
    ]
});

function jwtMiddlewareBuilder() {
    return [
        jwtMiddleware,
        (req: JwtRequest, res, done) => {
            User.findById(req.user.userId).then(user => {
                if (user == null) {
                    done(new Error("User not found"));
                    return;
                }

                if (user.sessionId !== req.user.sessionId) {
                    done(new Error("Token is recalled"));
                    return;
                }

                done();
            });
        }
    ];
}

export default jwtMiddlewareBuilder;