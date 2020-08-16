import validator from "validator";
import * as jwt from "jsonwebtoken";

import {Router} from "express";
import {BadRequestError} from "ts-http-errors";

import Hash from "../../../classes/hash";
import User from "../../../schemas/user";

import {body} from "express-validator";

import {JWT_SECRET} from "../../../modules/jwt";
import validationMiddleware from "../../../modules/validation";

const usersApi = (router: Router) => {
    router.post("/users",
        body("email").isEmail().exists(),
        body("userName").isString().isLength({
            min: 4,
            max: 12
        }).withMessage("").exists(),
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
        async (req, res) => {
        User.findOne(validator.isEmail(req.body.login) ? {
            email: req.body.login,
            password: Hash.create(req.body.password)
        } : {
            userName: req.body.login,
            password: Hash.create(req.body.password)
        }).then(user => {
            if (user == null) {
                return;
            }

            res.send({
                userName: user.userName,
                token: jwt.sign({
                    userId: user._id,
                    role: user.role,
                    sessionId: user.sessionId
                }, JWT_SECRET)
            });
        });
    });
}

export default usersApi;