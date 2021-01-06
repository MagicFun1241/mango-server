import * as fs from "fs";
import * as path from "path";
import * as sharp from "sharp";

import {Router} from "express";

import {
    NotFoundError,
    BadRequestError
} from "ts-http-errors";

import {Role} from "../../../schemas/user";
import News, {NewsInterface} from "../../../schemas/news";
import Storage, {PreviewType} from "../../../classes/storage";

import validationMiddleware from "../../../modules/validation";
import roleMiddleware from "../../../modules/role";
import {
    jwtMiddleware
} from "../../../modules/jwt";

import {query} from "express-validator";

import uploader from "../../../modules/uploader";
import NewsResolver from "../../../resolvers/news";

const newsApi = (router: Router) => {
    router.post("/news",
        jwtMiddleware,
        roleMiddleware([
            Role.Moderator,
            Role.Administrator,
            Role.Creator
        ]),
        query("title").isString().exists(),
        query("text").isString().exists(),
        validationMiddleware,
        uploader.single("preview"),
        async (req, res) => {
            if (req.file == null) return res.status(400).send(new BadRequestError("preview must be defined"));

            sharp(fs.readFileSync(req.file.path)).jpeg().toFile(path.join(process.cwd(), `/storage/preview/news/${req.file.filename}.jpg`)).then(() => {
                new News({
                    title: req.query.title,
                    text: req.query.text,
                    preview: req.file.filename,
                    creatorId: req.jwt.userId
                }).save().then(news => {
                    res.send({
                        id: news._id
                    });
                });
            });
        });

    router.get("/news", async (req, res) => {
        News.find().limit(5).then(news => {
            let result: Array<{
                id: string;
                title: string;
                preview: string;
                text: string;
            }> = [];

            news.forEach(e => result.push({
                id: e._id,
                title: e.title,
                preview: Storage.getPreview(PreviewType.News, e.preview),
                text: e.text
            }));

            res.send(result);
        });
    });

    router.get("/news/:id", async (req, res) => {
        NewsResolver.findById<NewsInterface>(req.params.id).then(news => {
            if (news == null) return res.status(404).send(new NotFoundError("News not found"));

            res.send({
                title: news.title,
                preview: news.preview,
                creatorId: news.creatorId,
                text: news.text
            });
        });
    });
};

export default newsApi;
