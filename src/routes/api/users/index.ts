import validator from "validator";
import * as jwt from "jsonwebtoken";

import {Router} from "express";
import {BadRequestError} from "ts-http-errors";

import Hash from "../../../classes/hash";
import User from "../../../schemas/user";
import Team from "../../../schemas/team";

import Storage from "../../../classes/storage";

import {body} from "express-validator";

import validationMiddleware from "../../../modules/validation";
import {
    jwtMiddleware
} from "../../../modules/jwt";

import {resolveLocale, supportedLocales} from "../../../modules/locale";

import config from "../../../classes/config";

const usersApi = (router: Router) => {
    router.post("/users",
        body("email").isEmail().exists(),
        body("firstName").isString().isLength({
            min: 4,
            max: 12
        }).withMessage("Firstname").exists(),
        body("lastName").isString().isLength({
            min: 4,
            max: 12
        }).withMessage("Lastname").exists(),
        body("userName").isString().isLength({
            min: 4,
            max: 12
        }).withMessage("Username").exists(),
        body("password").isString().isLength({
            min: 8,
            max: 25
        }).withMessage("Password must be min 8 chars").exists(),
        validationMiddleware,
        async (req, res) => {
        User.countDocuments({
            userName: req.body.userName
        }).then(count => {
            if (count > 0) {
                return;
            }

            User.countDocuments({
                email: req.body.email
            }).then(count => {
                if (count > 0) {
                    return;
                }

                if (count > 0) return res.status(400).send(new BadRequestError("email already taken"));

                let locale = resolveLocale(req.ip);

                if (locale == null) locale = supportedLocales[0];

                new User({
                    email: req.body.email,
                    userName: req.body.userName,
                    firstName: req.body.firstName,
                    lastName: req.body.lastName,
                    password: Hash.create(req.body.password),
                    locale: locale
                }).save().then(usr => {
                    res.send({
                        token: jwt.sign({
                            userId: usr._id,
                            role: usr.role,
                            locale: usr.locale,
                            sessionId: usr.sessionId
                        }, config.secrets.jwt)
                    });
                });
            });
        });
    });

    router.post("/users/signin",
        body("login").isString(),
        body("password").isString().isLength({
            min: 8
        }),
        validationMiddleware,
        async (req, res) => {
        User.findOne(validator.isEmail(req.body.login) ? {
            email: req.body.login,
            password: Hash.create(req.body.password)
        } : {
            userName: req.body.login,
            password: Hash.create(req.body.password)
        }).then(user => {
            if (user == null) return res.status(400).send(new BadRequestError("Invalid user data"));

            res.send({
                firstName: user.firstName,
                lastName: user.lastName,
                userName: user.userName,
                photo: Storage.getPhoto(user.photo),
                token: jwt.sign({
                    userId: user._id,
                    role: user.role,
                    locale: user.locale,
                    sessionId: user.sessionId
                }, config.secrets.jwt)
            });
        });
    });

    router.get("/users/me",
        jwtMiddleware,
        async (req, res) => {
        User.findById(req.jwt.userId).then(user => {
            res.send({
                userName: user.userName,
                photo: user.photo
            });
        });
    });

    router.get("/users/me/lists",
        jwtMiddleware,
        async (req, res) => {
            User.findById(req.jwt.userId).then(user => {
                res.send(user.lists);
            });
        });

    router.get("/users/me/teams",
        jwtMiddleware,
        async (req, res) => {
            Team.find({
                owner: req.jwt.userId
            }).then(teams => {
                let result: Array<{
                    id: string;
                    name: string;
                }> = [];

                teams.forEach(e => result.push({
                    id: e._id,
                    name: e.name
                }));

                res.send(result);
            });
        });
}

export default usersApi;
