import validator from "validator";
import * as jwt from "jsonwebtoken";

import {Router} from "express";
import {BadRequestError} from "ts-http-errors";

import Hash from "../../../classes/hash";
import User from "../../../schemas/user";

import Storage from "../../../classes/storage";

import {body} from "express-validator";

import jwtMiddlewareBuilder, {JWT_SECRET, JwtRequest} from "../../../modules/jwt";
import validationMiddleware from "../../../modules/validation";

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

                new User({
                    email: req.body.email,
                    userName: req.body.userName,
                    firstName: req.body.firstName,
                    lastName: req.body.lastName,
                    password: Hash.create(req.body.password)
                }).save().then(usr => {
                    res.send({
                        token: jwt.sign({
                            userId: usr._id,
                            role: usr.role,
                            sessionId: usr.sessionId
                        }, JWT_SECRET)
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
            if (user == null) {
                return res.status(400).send(new BadRequestError("Invalid user data"));
            }

            res.send({
                firstName: user.firstName,
                lastName: user.lastName,
                userName: user.userName,
                photo: Storage.getPhoto(user.photo),
                token: jwt.sign({
                    userId: user._id,
                    role: user.role,
                    sessionId: user.sessionId
                }, JWT_SECRET)
            });
        });
    });

    router.get("/users/me",
        jwtMiddlewareBuilder(),
        async (req: JwtRequest, res) => {
        User.findById(req.user.userId).then(user => {
            res.send({
                userName: user.userName,
                photo: user.photo
            });
        });
    });

    router.get("/users/me/lists",
        jwtMiddlewareBuilder(),
        async (req: JwtRequest, res) => {
            User.findById(req.user.userId).then(user => {
                res.send(user.lists);
            });
        });
}

export default usersApi;