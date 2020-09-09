import * as fs from "fs";
import * as path from "path";
import * as sharp from "sharp";
import * as mkdirp from "mkdirp";

import {Router} from "express";

import StreamZip = require("node-stream-zip");
import Volume from "../../../schemas/volume";
import Manga, {MangaState} from "../../../schemas/manga";
import {
    Role
} from "../../../schemas/user";

import {
    param,
    query
} from "express-validator";

import uploader from "../../../modules/uploader";

import validationMiddleware from "../../../modules/validation";
import jwtMiddlewareBuilder from "../../../modules/jwt";
import roleMiddleware from "../../../modules/role";

import {BadRequestError} from "ts-http-errors";
import Storage from "../../../classes/storage";

const mangaApi = (router: Router) => {
    router.post("/manga", jwtMiddlewareBuilder(), roleMiddleware([
        Role.Administrator,
        Role.Moderator,
        Role.Creator
    ]), query("name").isString().exists(),
        query("description").isString().exists(),
        query("releaseDate").isString().optional(),
        validationMiddleware,
        uploader.single("preview"),
        async (req, res) => {
        if (req.file != null) {
            sharp(fs.readFileSync(req.file.path)).jpeg().toFile(path.join(process.cwd(), `/storage/preview/${req.file.filename}.jpg`)).then(() => {
                fs.unlinkSync(req.file.path);

                new Manga({
                    name: req.query.name,
                    preview: req.file.filename,
                    description: req.query.description
                }).save().then(manga => {
                    res.send({
                        id: manga._id,
                        preview: manga.preview
                    });
                });
            });
        } else {
            new Manga({
                name: req.query.name,
                description: req.query.description
            }).save().then(manga => {
                res.send({
                    id: manga._id,
                    preview: manga.preview
                });
            });
        }
    });

    router.get("/manga/:id",
        param("id").isString().isMongoId().exists(),
        validationMiddleware,
        async (req, res) => {
        Manga.findById(req.params.id).then(manga => {
            if (manga == null) {
                res.status(404).send(new BadRequestError("Manga not found"));
                return;
            }

            res.send({
                name: manga.name,
                status: manga.state,
                rating: Math.round(manga.rating.sum),
                reviewsCount: manga.rating.reviews.length,
                releaseDate: manga.releaseDate,
                preview: Storage.getPreview(manga.preview),
                description: manga.description
            });
        });
    });

    router.post("/manga/:mangaId/volumes/:volume/chapters/:chapter",
        jwtMiddlewareBuilder(),
        roleMiddleware([
            Role.Administrator,
            Role.Moderator,
            Role.Creator
        ]),
        param("mangaId").isString().isMongoId().exists(),
        param("volume").isNumeric().toInt(),
        param("chapter").isNumeric().toInt(),
        // Данные главы
        query("name").isString().exists(),
        validationMiddleware,
        uploader.single("file"),
        async (req, res) => {
            Manga.findOne({
                _id: req.params.mangaId
            }).then(manga => {
                if (manga == null) {
                    res.status(404).send(new BadRequestError("Manga not found"));
                    return;
                }

                const c = (callback: (context: {
                    zip: StreamZip,
                    zipPath: string;
                    pages: Array<string>;
                }) => any) => {
                    let zip = new StreamZip({
                        file: req.file.path,
                        storeEntries: true
                    });

                    const supportedExtensions = [
                        ".jpg",
                        ".jpeg",
                        ".png"
                    ];

                    zip.on('ready', () => {
                        let error: string;
                        let pages: Array<string> = [];

                        for (const entry of Object.values(zip.entries())) {
                            if (entry.isDirectory) {
                                error = "The archive should not contain folders";
                                break;
                            } else if (!supportedExtensions.includes(path.extname(entry.name))) {
                                error = "Unsupported file found";
                                break;
                            } else pages.push(entry.name);
                        }

                        if (error != null) {
                            res.status(400).send(new BadRequestError(error));
                            zip.close();
                            fs.unlinkSync(req.file.path);
                        } else {
                            let p = path.join(process.cwd(), `/storage/manga/${manga._id}/${req.params.volume}/${req.params.chapter}`);

                            if (!fs.existsSync(p)) mkdirp.sync(p);

                            zip.extract(null, p, err => {
                                if (err) {
                                    return;
                                }

                                callback({
                                    zip: new Proxy(zip, {}),
                                    zipPath: req.file.path,
                                    pages
                                });
                            });
                        }
                    });
                }

                Volume.findOne({
                    number: req.params.volume,
                    mangaId: manga._id
                }).then(volume => {
                    if (volume == null) {
                        if (req.file == null) {
                            return;
                        }

                        c(({
                               pages,
                            zip,
                            zipPath
                        }) => {
                            new Volume({
                                number: req.params.volume,
                                mangaId: manga._id,
                                chapters: [
                                    {
                                        number: req.params.chapter,
                                        name: req.query.name,
                                        pages: pages
                                    }
                                ]
                            }).save().then(() => {
                                res.status(204).send();

                                zip.close();
                                fs.unlinkSync(zipPath);
                            });
                        });
                    } else {
                        c(({
                               pages,
                               zip,
                               zipPath
                        }) => {
                            volume.chapters.push({
                                number: req.params.chapter,
                                name: req.query.name,
                                pages: pages
                            });

                            volume.save().then(() => {
                                res.status(204).send();

                                zip.close();
                                fs.unlinkSync(zipPath);
                            });
                        });
                    }
                });
            });
        });

    router.get("/manga/:mangaId/volumes/:volume/chapters/:chapter",
        param("mangaId").isString().isMongoId().exists(),
        param("volume").isNumeric().toInt(),
        param("chapter").isNumeric().toInt(),
        async (req, res) => {
        Manga.findById(req.params.mangaId).then(manga => {
            if (manga == null) {
                res.status(404).send(new BadRequestError("Manga not found"));
                return;
            }

            Volume.findOne({
                number: req.params.volume,
                mangaId: manga._id
            }).then(vol => {
                if (vol == null) { // TODO: Добавит вывод ошибок)
                    return;
                }

                let chapter = vol.chapters.find(e => e.number === req.params.chapter);

                if (chapter == null) {
                    return;
                }

                let pages: Array<string> = [];

                chapter.pages.forEach(e => pages.push(Storage.getChapterPage(manga._id, vol.number, chapter.number, e)));

                res.send({
                    name: chapter.name,
                    pages: pages
                });
            });
        });
    });

    router.get("/manga/:mangaId/volumes",
        param("mangaId").isString().isMongoId().exists(),
        async (req, res) => {
            Manga.findById(req.params.mangaId).then(manga => {
                if (manga == null) {
                    res.status(404).send(new BadRequestError("Manga not found"));
                    return;
                }

                Volume.find({
                    mangaId: manga._id
                }).sort({ number: -1 }).then(volumes => {
                    let result: Array<{
                        number: number;
                        preview: string;
                    }> = [];

                    volumes.forEach(e => result.push({
                        number: e.number,
                        preview: e.preview
                    }));

                    res.send(result);
                });
            });
        });

    router.get("/manga/:mangaId/volumes/:volume/chapters",
        param("mangaId").isString().isMongoId().exists(),
        param("volume").isNumeric().toInt(),
        async (req, res) => {
        Manga.findById(req.params.mangaId).then(manga => {
            if (manga == null) {
                return;
            }

            Volume.findOne({
                number: req.params.volume,
                mangaId: manga._id
            }).sort({ number: -1 }).then(volume => {
                let result: Array<{
                    number: number;
                    name: string;
                }> = [];

                volume.chapters.forEach(e => result.push({
                    number: e.number,
                    name: e.name
                }));

                res.send(result);
            });
        });
    });

    router.get("/manga/search",
        query("count").isNumeric().toInt().optional(),
        query("q").isString().exists(),
        validationMiddleware,
        async (req, res) => {
        const count = req.query.count || 5;

        Manga.find({
            $text: { $search: req.query.q }
        }).limit(count).then(list => {
            let result: Array<{
                id: string;
                name: string;
                preview: string;
                description: string;
            }> = [];

            list.forEach(e => result.push({
                id: e._id,
                name: e.name,
                preview: Storage.getPreview(e.preview),
                description: e.description
            }));

            res.send(result);
        });
    });

    router.get("/manga/state/ongoing",
        query("count").isNumeric().toInt().optional(),
        validationMiddleware,
        async (req, res) => {
            const count = req.query.count || 3;

            Manga.find({
                state: MangaState.Ongoing
            }).limit(count).then(list => {
                let result: Array<{
                    id: string;
                    name: string;
                    preview: string;
                }> = [];

                list.forEach(e => result.push({
                    id: e._id,
                    name: e.name,
                    preview: Storage.getPreview(e.preview)
                }));

                res.send(result);
            });
        });
};

export default mangaApi;