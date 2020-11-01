import {Router} from "express";

import {
    BadRequestError,
    NotFoundError
} from "ts-http-errors";

import Team from "../../../schemas/team";

import config from "../../../classes/config";

import jwtMiddleware from "../../../modules/jwt";

const teamsApi = (router: Router) => {
    router.post("/teams", async (req, res) => {
        Team.countDocuments({
            owner: req.jwt.userId
        }).then(count => {
            if (count > config.limits.maxTeamsCount) res.status(400).send(new BadRequestError("Max limit achieved"));
            else {
                new Team({
                    name: req.body.name,
                    owner: req.jwt.userId
                }).save().then(team => {
                    res.send({
                        id: team._id
                    });
                });
            }
        });
    });

    router.get("/teams/:id", async (req, res) => {
        Team.findById(req.params.id).then(team => {
            if (team == null) res.status(404).send(new NotFoundError("Team not found"));
            else res.send({
                name: team.name,
                owner: team.owner
            });
        });
    });

    router.delete("/teams/:id",
        jwtMiddleware,
        async (req, res) => {
        Team.findById(req.params.id).then(team => {
            if (team == null) res.status(404).send(new NotFoundError("Team not found"));
            else if (team.owner.toHexString() !== req.jwt.userId) res.status(400).send(new BadRequestError("Access denied"));
            else team.remove().then(() => {
                    res.status(204).send();
                });
        });
    });
};

export default teamsApi;