import {Router} from "express";
import {Role} from "../../../schemas/user";

import {BadRequestError, NotFoundError} from "ts-http-errors";

import Storage, {PreviewType} from "../../../classes/storage";
import Character from "../../../schemas/character";

import {body, query} from "express-validator";

import jwtMiddleware from "../../../modules/jwt";
import roleMiddleware from "../../../modules/role";
import localeMiddleware, {supportedLocales} from "../../../modules/locale";
import validationMiddleware from "../../../modules/validation";

import buildFullTextRegex from "../../../modules/search";

const charactersApi = (router: Router) => {
    router.post("/characters",
        jwtMiddleware,
        roleMiddleware([
            Role.Moderator,
            Role.Administrator,
            Role.Creator
        ]),
        body("name").isString().exists(),
        body("description").isString().optional(),
        validationMiddleware,
        localeMiddleware,
        async (req, res) => {
            new Character({
                names: [
                    {
                        locale: req.query.locale,
                        name: req.body.name
                    }
                ],
                descriptions: [
                    (req.query.description == null) ? undefined : {
                        locale: req.query.locale,
                        text: req.query.description
                    }
                ]
            }).save().then(character => {
                res.send({
                    id: character._id,
                    photo: Storage.getPreview(PreviewType.Character, character.photo)
                });
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
                    photo: Storage.getPreview(PreviewType.Character, character.photo),
                    description: descriptionLocale.text
                });
            } else {
                let locale = character.names.find(e => e.locale === req.query.locale);

                if (locale == null) locale = character.names[0];

                res.send({
                    name: locale.name,
                    photo: Storage.getPreview(PreviewType.Character, character.photo),
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
