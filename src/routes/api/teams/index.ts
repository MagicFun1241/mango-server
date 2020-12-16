import * as fs from "fs";
import * as path from "path";
import * as sharp from "sharp";

import {Router} from "express";

import {
    BadRequestError,
    NotFoundError
} from "ts-http-errors";

import Team, {TeamInterface} from "../../../schemas/team";
import TeamResolver from "../../../resolvers/team";

import config from "../../../classes/config";
import uploader from "../../../modules/uploader";

import jwtMiddleware from "../../../modules/jwt";

const teamsApi = (router: Router) => {
    router.post("/teams",
        jwtMiddleware,
        uploader.single("photo"),
        async (req, res) => {
            const create = (data) => {
                return new Promise((resolve, reject) => {
                    Team.countDocuments({
                        owner: req.jwt.userId
                    }).then(count => {
                        if (count > config.limits.maxTeamsCount) res.status(400).send(new BadRequestError("Max limit achieved"));
                        else {
                            new Team(data).save().then(team => {
                                resolve();

                                res.send({
                                    id: team._id
                                });
                            });
                        }
                    });
                });
            }

            if (req.file != null) {
                create({
                    name: req.body.name,
                    owner: req.jwt.userId,
                    photo: req.file.filename
                }).then(id => {
                    sharp(req.file.path).jpeg().toFile(path.join(process.cwd(), `/storage/team/${id}/photo.jpg`)).then(() => {
                        fs.unlinkSync(req.file.path);
                    });
                });
            } else await create({
                name: req.body.name,
                owner: req.jwt.userId
            });
        });

    router.get("/teams/:id", async (req, res) => {
        TeamResolver.findById<TeamInterface>(req.params.id).then(team => {
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
        TeamResolver.findById<TeamInterface>(req.params.id).then(team => {
            if (team == null) res.status(404).send(new NotFoundError("Team not found"));
            // @ts-ignore
            else if (team.owner.toHexString() !== req.jwt.userId) res.status(400).send(new BadRequestError("Access denied"));
            else team.remove().then(() => {
                res.status(204).send();
            });
        });
    });
};

export default teamsApi;
