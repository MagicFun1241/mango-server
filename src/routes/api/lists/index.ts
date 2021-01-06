import {Router} from "express";
import {Types} from "mongoose";
import {BadRequestError, NotFoundError} from "ts-http-errors";

import User from "../../../schemas/user";
import Manga from "../../../schemas/manga";

import Storage, {PreviewType} from "../../../classes/storage";

import {param, query} from 'express-validator';

import validationMiddleware from "../../../modules/validation";
import {
    jwtMiddleware
} from "../../../modules/jwt";

import lists, {listNames} from "../../../stores/lists";

const listsApi = (router: Router) => {
    router.get("/lists/:name",
        jwtMiddleware,
        param("name").isIn(listNames),
        // Дополнительные параметры
        query("count").isNumeric().toInt().optional(),
        query("offset").isNumeric().toInt().optional(),
        query("extended").isBoolean().toBoolean().optional(),
        validationMiddleware,
        async (req, res) => {
            User.findById(req.jwt.userId).then(user => {
                const extended = req.query.extended || false;

                let count: number = 10;

                if (req.query.count != null) {
                    if (req.query.count < 1)
                        return res.status(400).send(new BadRequestError("count cant be lower than 1"));
                    else count = req.query.count;
                }

                let offset: number = 0;

                if (req.query.offset != null) {
                    if (req.query.offset < 0)
                        return res.status(400).send(new BadRequestError("offset cant be lower than zero"));
                    else offset = req.query.offset;
                }

                const items = (user.lists[req.params.name] as Array<Types.ObjectId>).slice(offset, offset + count);

                if (extended) Promise.all(items.map(e => (async () => {
                    const f = await Manga.findById(e);

                    return Promise.resolve({
                        id: f._id,
                        name: f.names[0].name,
                        preview: Storage.getPreview(PreviewType.Manga, f.preview),
                        description: f.descriptions[0].text
                    });
                })())).then(r => res.send(r));
                else res.send(items);
            });
        });

    router.post("/lists/:name/:mangaId",
        jwtMiddleware,
        param("name").isIn(listNames),
        param("mangaId").isMongoId(),
        validationMiddleware,
        async (req, res) => {
            User.findById(req.jwt.userId).then(user => {
                lists.get(`${req.jwt.userId}_${req.params.mangaId}`).then(list => {
                    if (list === req.params.name) return res.status(400).send(new BadRequestError("Item with this id already exist"));

                    lists.set(`${req.jwt.userId}_${req.params.mangaId}`, req.params.name).then(() => {
                        const oldIndex = user.lists[list].findIndex(e => e.toString() === req.params.mangaId);
                        user.lists[list].splice(oldIndex, 1);

                        user.lists[req.params.name].push(req.params.mangaId);
                        user.markModified("lists");
                        user.save().then(() => {
                            res.status(204).send();
                        });
                    });
                }).catch(e => {
                    if (e.notFound) {
                        lists.set(`${req.jwt.userId}_${req.params.mangaId}`, req.params.name).then(() => {
                            user.lists[req.params.name].push(req.params.mangaId);
                            user.markModified("lists");
                            user.save().then(() => {
                                res.status(204).send();
                            });
                        });
                    }
                });
            });
        });

    router.delete("/lists/:name/:id",
        jwtMiddleware,
        param("name").isIn(listNames),
        param("id").isMongoId(),
        validationMiddleware,
        async (req, res) => {
            User.findById(req.jwt.userId).then(user => {
                lists.delete(`${req.jwt.userId}_${req.params.id}`).then(() => {
                    const itemIndex: number = user.lists[req.params.name].findIndex(e => e === req.params.id);

                    if (itemIndex !== -1) {
                        user.lists[req.params.name].splice(itemIndex, 1);
                        user.markModified("lists");
                        user.save().then(() => {
                            res.status(204).send();
                        });
                    } else res.status(404).send(new NotFoundError("Item not found in this list"));
                });
            });
        });
};

export default listsApi;
