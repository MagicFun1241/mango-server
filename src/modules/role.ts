import {Role} from "../schemas/user";
import {BadRequestError} from "ts-http-errors";

const roleMiddleware = (roles: Array<Role>) => {
    return (req, res, done) => {
        if (req.jwt == null) {
            return res.status(400).send(new BadRequestError("Authorization required"));
        }

        if (roles.includes(req.jwt.role)) done();
        else res.status(400).send(new BadRequestError("Access denied."));
    };
}

export default roleMiddleware;
