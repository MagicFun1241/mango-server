import * as jwt from "jsonwebtoken";

import User, {Role} from "../schemas/user";
import {BadRequestError, ForbiddenError, UnauthorizedError} from "ts-http-errors";

import config from "../classes/config";

export interface TokenPayload {
    userId: string;
    role: Role;
    locale: string;
    sessionId: number;
}

declare global {
    namespace Express {
        interface Request {
            jwt: TokenPayload
        }
    }
}

const jwtMiddleware = (request, response, next) => {
    const authorization = request.headers["authorization"];

    if (authorization == null) response.status(401).send(new UnauthorizedError());
    else {
        if (typeof authorization !== "string") {
            response.status(400).send(new BadRequestError("Authorization must be string"));
            return;
        }

        const parts = authorization.split(" ");

        if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
            response.status(400).send(new BadRequestError("Authorization must be in format"));
            return;
        }

        try {
            const user: TokenPayload = jwt.verify(parts[1], config.secrets.jwt) as any;

            User.findById(user.userId).then(usr => {
                if (usr == null) {
                    next(new Error("User not found"));
                    return;
                }

                if (usr.sessionId !== user.sessionId) {
                    next(new Error("Token is recalled"));
                    return;
                }

                request.jwt = user;

                next();
            });
        } catch (e) {
            response.status(403).send(new ForbiddenError("Invalid token"));
        }
    }
}

export default jwtMiddleware;
