import {Router} from "express";
import {Role} from "../../../schemas/user";
import {NotFoundError} from "ts-http-errors";

import Ticket from "../../../schemas/ticket";

import jwtMiddleware from "../../../modules/jwt";
import roleMiddleware from "../../../modules/role";

const ticketsApi = (router: Router) => {
    router.get("/tickets/:id",
        jwtMiddleware,
        roleMiddleware([
            Role.Moderator,
            Role.Administrator,
            Role.Creator
        ]),
        async (req, res) => {
            Ticket.findById(req.query.id).then(ticket => {
                if (ticket == null) return res.status(404).send(new NotFoundError("Ticket not found."));

                res.send({
                    type: ticket.type,
                    state: ticket.state,
                    creatorId: ticket.creatorId
                });
            });
        });
};

export default ticketsApi;
