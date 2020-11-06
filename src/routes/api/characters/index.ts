import {Router} from "express";
import {Role} from "../../../schemas/user";

import Character from "../../../schemas/character";

import {
    query,
    body
} from "express-validator";

import jwtMiddleware from "../../../modules/jwt";
import roleMiddleware from "../../../modules/role";
import validationMiddleware from "../../../modules/validation";
import {NotFoundError} from "ts-http-errors";
import localeMiddleware from "../../../modules/locale";

const charactersApi = (router: Router) => {
    router.post("/characters",
        jwtMiddleware,
        roleMiddleware([
            Role.Moderator,
            Role.Administrator,
            Role.Creator
        ]),
        body("name").isString().exists(),
        validationMiddleware,
        localeMiddleware,
        async (req, res) => {
            new Character({
                names: [
                    {
                        locale: req.query.locale,
                        name: req.body.name
                    }
                ]
            }).save().then(character => {
                res.send({
                    id: character._id
                });
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

            if (extended) {
                let localeIndex = character.names.findIndex(e => e.locale === req.query.locale);

                if (localeIndex === -1) localeIndex = 0;

                res.send({
                   names: [
                       character.names[localeIndex].name,
                       ...[ ...character.names ].remove(localeIndex).map(e => e.name)
                   ]
                });
            } else {
                let locale = character.names.find(e => e.locale === req.query.locale);

                if (locale == null) locale = character.names[0];

                res.send({
                    name: locale.name
                });
            }
        });
    });
};

export default charactersApi;
