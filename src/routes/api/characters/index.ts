import * as fs from "fs";
import * as path from "path";
import * as sharp from "sharp";

import {Router} from "express";
import {Role} from "../../../schemas/user";

import {BadRequestError, NotFoundError} from "ts-http-errors";

import Storage from "../../../classes/storage";
import Character from "../../../schemas/character";

import {body, query} from "express-validator";

import {
    jwtMiddleware
} from "../../../modules/jwt";
import roleMiddleware from "../../../modules/role";
import localeMiddleware, {supportedLocales} from "../../../modules/locale";
import validationMiddleware from "../../../modules/validation";

import buildFullTextRegex from "../../../modules/search";
import uploader from "../../../modules/uploader";

const charactersApi = (router: Router) => {
    router.post("/characters",
        jwtMiddleware,
        roleMiddleware([
            Role.Moderator,
            Role.Administrator,
            Role.Creator
        ]),
        query("name").isString().exists(),
        query("description").isString().optional(),
        validationMiddleware,
        localeMiddleware,
        uploader.single("photo"),
        async (req, res) => {
            const create = (data) => {
                new Character(data).save().then(character => {
                    res.send({
                        id: character._id,
                        photo: Storage.getCharacterPhoto(character.photo)
                    });
                });
            };

            if (req.file != null) {
                sharp(req.file.path).jpeg().toFile(path.join(process.cwd(), `/storage/character/${req.file.filename}.jpg`)).then(() => {
                    fs.unlinkSync(req.file.path);

                    create({
                        names: [
                            {
                                locale: req.query.locale,
                                name: req.query.name
                            }
                        ],
                        descriptions: [
                            (req.query.description == null) ? undefined : {
                                locale: req.query.locale,
                                text: req.query.description
                            }
                        ],
                        photo: req.file.filename
                    });
                });
            } else create({
                names: [
                    {
                        locale: req.query.locale,
                        name: req.query.name
                    }
                ],
                descriptions: [
                    (req.query.description == null) ? undefined : {
                        locale: req.query.locale,
                        text: req.query.description
                    }
                ]
            });
        });

    router.post("/characters/:id/photo",
        jwtMiddleware,
        roleMiddleware([
            Role.Moderator,
            Role.Administrator,
            Role.Creator
        ]),
        uploader.single("photo"),
        async (req, res) => {
            Character.findById(req.params.id).then(character => {
                if (character == null) return res.status(404).send(new NotFoundError("Character not found."));

                if (req.file != null) {
                    sharp(req.file.path).jpeg().toFile(path.join(process.cwd(), `/storage/character/${req.file.filename}.jpg`)).then(() => {
                        character.photo = req.file.filename;
                        character.save().then(() => {
                           res.send({
                               photo: Storage.getCharacterPhoto(req.file.filename)
                           });
                        });
                    });
                } else res.status(400).send(new BadRequestError("photo must be passed"));
            });
        });

    router.get("/characters/search",
        query("q").isString().exists(),
        validationMiddleware,
        localeMiddleware,
        async (req, res) => {
            Character.find({
                names: { $elemMatch: { name: { $regex: buildFullTextRegex(req.query.q) } } }
            }).then(characters => {
                const items = [];

                characters.forEach(e => {
                    let localeIndex = e.names.findIndex(l => l.locale === req.query.locale);

                    if (localeIndex === -1) localeIndex = 0;

                    items.push({
                        id: e._id,
                        names: [
                            e.names[localeIndex].name,
                            ...[ ...e.names ].remove(localeIndex).map(n => n.name)
                        ]
                    });
                });

                res.send(items);
            });
        });

    router.get("/characters/:id",
        query("extended").isBoolean().toBoolean().optional(),
        validationMiddleware,
        localeMiddleware,
        async (req, res) => {
        Character.findById(req.params.id).then(character => {
            if (character == null) return res.status(404).send(new NotFoundError("Character not found."));

            const extended = req.query.extended || false;

            let descriptionLocale = character.descriptions.find(e => e.locale === req.query.locale);

            if (descriptionLocale == null) {
                if (character.descriptions.length === 0) descriptionLocale = null;
                else descriptionLocale = character.descriptions[0];
            }

            if (extended) {
                let nameLocaleIndex = character.names.findIndex(e => e.locale === req.query.locale);

                if (nameLocaleIndex === -1) nameLocaleIndex = 0;

                res.send({
                    names: [
                       character.names[nameLocaleIndex].name,
                       ...[ ...character.names ].remove(nameLocaleIndex).map(e => e.name)
                    ],
                    photo: Storage.getCharacterPhoto(character.photo),
                    description: descriptionLocale.text
                });
            } else {
                let locale = character.names.find(e => e.locale === req.query.locale);

                if (locale == null) locale = character.names[0];

                res.send({
                    name: locale.name,
                    photo: Storage.getCharacterPhoto(character.photo),
                    description: descriptionLocale.text
                });
            }
        });
    });

    router.delete("/characters/:id",
        jwtMiddleware,
        roleMiddleware([
            Role.Moderator,
            Role.Administrator,
            Role.Creator
        ]), async (req, res) => {
            Character.findById(req.query.id).then(character => {
               if (character == null) return res.status(404).send(new NotFoundError("Character not found"));

               character.remove().then(() => {
                   res.status(204).send();
               });
            });
        });

    router.patch("/characters/:id",
        jwtMiddleware,
        roleMiddleware([
            Role.Moderator,
            Role.Administrator,
            Role.Creator
        ]),
        query("locale").isIn(supportedLocales).exists(),
        body("description").isString().optional(),
        validationMiddleware,
        async (req, res) => {
            Character.findById(req.query.id).then(character => {
                if (character == null) return res.status(404).send(new NotFoundError("Character not found."));

                let modified = false;

                if (req.body.description != null) {
                    let localeIndex = character.descriptions.findIndex(e => e.locale === req.query.locale);

                    if (localeIndex === -1) return res.status(400).send(new BadRequestError("Description for this locale is not exists"));

                    character.descriptions[localeIndex].text = req.query.description;

                    modified = true;
                }

                if (modified) character.save().then(() => res.status(204).send());
            });
        });
};

export default charactersApi;
