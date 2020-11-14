import * as fs from "fs";
import * as path from "path";
import * as sharp from "sharp";
import * as mkdirp from "mkdirp";

import {Router} from "express";
import Volume from "../../../schemas/volume";
import Character from "../../../schemas/character";
import Manga, {MangaState, validateGenres} from "../../../schemas/manga";
import {Role} from "../../../schemas/user";

import {param, query} from "express-validator";
import {genresQueryRegex} from "../../../classes/regex";

import uploader from "../../../modules/uploader";

import validationMiddleware from "../../../modules/validation";
import localeMiddleware from "../../../modules/locale";
import roleMiddleware from "../../../modules/role";
import jwtMiddleware from "../../../modules/jwt";

import {BadRequestError, NotFoundError} from "ts-http-errors";
import Storage, {PreviewType} from "../../../classes/storage";
import Team, {TeamInterface} from "../../../schemas/team";
import StreamZip = require("node-stream-zip");

import buildFullTextRegex from "../../../modules/search";

const mangaApi = (router: Router) => {
    router.post("/manga", jwtMiddleware, roleMiddleware([
            Role.Administrator,
            Role.Moderator,
            Role.Creator
        ]), query("name").isString().exists(),
        query("description").isString().exists(),
        query("explicit").isBoolean().toBoolean().exists(),
        query("genres").isArray().optional(),
        query("released").isNumeric().toInt().optional(),
        validationMiddleware,
        localeMiddleware,
        uploader.single("preview"),
        async (req, res) => {
            if (req.query.genres != null)
                if (!validateGenres(req.query.genres as any))
                    return res.status(400).send(new BadRequestError("Invalid genres"));
                else req.query.genres = [];

            if (req.file != null) {
                sharp(fs.readFileSync(req.file.path)).jpeg().toFile(path.join(process.cwd(), `/storage/preview/manga/${req.file.filename}.jpg`)).then(() => {
                    fs.unlinkSync(req.file.path);

                    new Manga({
                        names: [
                            {
                                locale: req.query.locale,
                                name: req.query.name
                            }
                        ],
                        preview: req.file.filename,
                        explicit: req.query.explicit,
                        description: req.query.description,
                        genres: req.query.genres,
                        released: req.query.released || undefined
                    }).save().then(manga => {
                        res.send({
                            id: manga._id,
                            preview: Storage.getPreview(PreviewType.Manga, manga.preview)
                        });
                    });
                });
            } else {
                new Manga({
                    names: [
                        {
                            locale: req.jwt.locale,
                            name: req.query.name
                        }
                    ],
                    explicit: req.query.explicit,
                    description: req.query.description,
                    genres: req.query.genres,
                    released: req.query.released || undefined
                }).save().then(manga => {
                    res.send({
                        id: manga._id,
                        preview: Storage.getPreview(PreviewType.Manga, manga.preview)
                    });
                });
            }
        });

    router.get("/manga/ongoing",
        query("count").isNumeric().toInt().optional(),
        query("offset").isNumeric().toInt().optional(),
        validationMiddleware,
        localeMiddleware,
        async (req, res) => {
            const count = req.query.count || 5;
            const offset = req.query.offset || 0;

            Manga.find({
                state: MangaState.Ongoing
            }).skip(offset).limit(count).then(list => {
                let result: Array<{
                    id: string;
                    name: string;
                    preview: string;
                }> = [];

                list.forEach(e => {
                    let locale = e.names.find(l => l === req.query.locale);

                    if (locale == null) locale = e.names[0];

                    result.push({
                        id: e._id,
                        name: locale.name,
                        preview: Storage.getPreview(PreviewType.Manga, e.preview)
                    });
                });

                res.send(result);
            });
        });

    router.get("/manga/search",
        query("count").isNumeric().toInt().optional(),
        query("explicit").isBoolean().optional(),
        query("genres").isString().optional(),
        query("offset").isNumeric().toInt().optional(),
        query("q").isString().optional(),
        validationMiddleware,
        localeMiddleware,
        async (req, res) => {
            if (req.query.genres == null && req.query.q == null) return res.status(400).send(new BadRequestError("genres or q must be defined"));

            const count = req.query.count || 5;
            const offset = req.query.offset || 0;
            const explicit = req.query.explicit || false;

            Manga.find({
                names: { $elemMatch: { name: { $regex: buildFullTextRegex(req.query.q) } } },
                explicit: explicit
            }).skip(offset).limit(count).then(list => {
                let result: Array<{
                    id: string;
                    name: string;
                    preview: string;
                    description: string;
                }> = [];

                list.forEach(e => {
                    let locale = e.names.find(l => l.locale === req.query.locale);

                    if (locale == null) locale = e.names[0];

                    result.push({
                        id: e._id,
                        name: locale.name,
                        preview: Storage.getPreview(PreviewType.Manga, e.preview),
                        description: e.description
                    });
                });

                res.send(result);
            });
        });

    router.get("/manga/:id",
        param("id").isString().isMongoId().exists(),
        query("extended").isBoolean().optional(),
        validationMiddleware,
        localeMiddleware,
        async (req, res) => {
            Manga.findById(req.params.id).then(async manga => {
                if (manga == null) return res.status(404).send(new BadRequestError("Manga not found"));

                const extended = req.query.extended || false;

                if (extended) {
                    const translators: Array<{
                        id: string;
                        name: string;
                    }> = [];

                    for (let i = 0; i < manga.translators.length; i++) {
                        try {
                            let team = await Team.findById(manga.translators[i].toHexString());

                            translators.push({
                                id: team._id,
                                name: team.name
                            });
                        } catch (e) {
                            return res.status(404).send(new NotFoundError("Not Found"));
                        }
                    }

                    const characters = manga.characters == null ? undefined : [];

                    if (manga.characters != null) {
                        for (let i = 0; i < manga.characters.length; i++) {
                            try {
                                const character = await Character.findById(manga.characters[i]);

                                let locale = character.names.find(e => e.locale === req.query.locale);

                                if (locale == null) locale = character.names[0];

                                characters.push({
                                    id: character._id,
                                    name: locale.name
                                });
                            } catch (e) {
                                return res.status(404).send(new NotFoundError("Not Found"));
                            }
                        }
                    }

                    let localeIndex = manga.names.findIndex(e => e.locale === req.query.locale);

                    if (localeIndex === -1) localeIndex = 0;

                    res.send({
                        names: [
                            manga.names[localeIndex].name,
                            ...[...manga.names].remove(localeIndex).map(e => e.name)
                        ],
                        characters: characters,
                        status: manga.state,
                        explicit: manga.explicit,
                        rating: {
                            total: Math.round(manga.rating.total),
                            reviews: manga.rating.reviews.length
                        },
                        release: {
                            date: manga.released
                        },
                        genres: manga.genres,
                        translators: translators,
                        preview: Storage.getPreview(PreviewType.Manga, manga.preview),
                        description: manga.description
                    });
                } else res.send({
                    name: manga.names[0].name,
                    status: manga.state,
                    explicit: manga.explicit,
                    rating: {
                        total: Math.round(manga.rating.total),
                        reviews: manga.rating.reviews.length
                    },
                    release: {
                        date: manga.released
                    },
                    genres: manga.genres,
                    translators: manga.translators,
                    preview: Storage.getPreview(PreviewType.Manga, manga.preview),
                    description: manga.description
                });
            });
        });

    router.post("/manga/:mangaId/characters",
        jwtMiddleware,
        roleMiddleware([
            Role.Moderator,
            Role.Administrator,
            Role.Creator
        ]),
        query("characterId").isString().exists(),
        validationMiddleware,
        async (req, res) => {
            Manga.findById(req.params.mangaId).then(manga => {
                if (manga == null) return res.status(404).send(new NotFoundError("Manga not found."));

                Character.findById(req.query.characterId).then(character => {
                    if (character == null) return res.status(404).send(new NotFoundError("Character not found."));

                    if (manga.characters == null) {
                        manga.characters = [ character._id ];
                    } else {
                        if (manga.characters.includes(req.query.characterId)) return res.status(400).send(new BadRequestError("Character already exists in this manga."));

                        manga.characters.push(req.query.characterId);
                        manga.save().then(() => {
                            res.status(204).send();
                        });
                    }
                });
            });
        });

    router.get("/manga/:mangaId/translators",
        query("extended").isBoolean().toBoolean().optional(),
        validationMiddleware,
        async (req, res) => {
            Manga.findById(req.params.mangaId).then(manga => {
                if (manga == null) return res.status(404).send(new NotFoundError("Manga not found"));

                if (req.query.extended === true) {
                    let queries = [];

                    manga.translators.forEach(e => queries.push(Team.findById(e)));

                    Promise.all<TeamInterface>(queries).then(teams => {
                        let result: Array<{
                            id: string;
                            name: string;
                            photo: string;
                            description: string;
                        }> = [];

                        teams.forEach(e => result.push({
                            id: e._id,
                            name: e.name,
                            photo: Storage.getTeamPhoto(e.photo),
                            description: e.description
                        }));

                        res.send(result);
                    });
                } else res.send(manga.translators);
            });
        });

    router.post("/teams/:teamId/manga/:mangaId/volumes/:volume/chapters/:chapter",
        jwtMiddleware,
        roleMiddleware([
            Role.Administrator,
            Role.Moderator,
            Role.Creator
        ]),
        param("mangaId").isMongoId().exists(),
        param("teamId").isMongoId().exists(),
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
                if (manga == null) return res.status(404).send(new BadRequestError("Manga not found"));

                Team.findById(req.params.teamId).then(team => {
                    if (team == null) return res.status(404).send(new NotFoundError("Team not found."));

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
                                let p = path.join(process.cwd(), `/storage/team/${team._id}/manga/${manga._id}/${req.params.volume}/${req.params.chapter}`);

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
                        teamId: team._id,
                        mangaId: manga._id,
                        number: req.params.volume,
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
        });

    router.get("/teams/:teamId/manga/:mangaId/volumes/:volume/chapters/:chapter",
        param("mangaId").isMongoId().exists(),
        param("teamId").isMongoId().exists().withMessage("teamId must be a id string"),
        param("volume").isNumeric().toInt(),
        param("chapter").isNumeric().toInt(),
        validationMiddleware,
        async (req, res) => {
            Team.findById(req.params.teamId).then(team => {
                if (team == null) return res.status(404).send(new NotFoundError("Team not found"));

                Manga.findById(req.params.mangaId).then(manga => {
                    if (manga == null) return res.status(404).send(new BadRequestError("Manga not found"));

                    Volume.findOne({
                        number: req.params.volume,
                        mangaId: manga._id,
                        teamId: team._id,
                    }).then(vol => {
                        if (vol == null) return res.status(404).send(new BadRequestError("Volume not found"));

                        let chapter = vol.chapters.find(e => e.number === req.params.chapter);

                        if (chapter == null) return res.status(404).send(new NotFoundError("Chapter not found"));

                        let pages: Array<string> = [];

                        chapter.pages.forEach(e => pages.push(Storage.getChapterPage(team._id, manga._id, vol.number, chapter.number, e)));

                        res.send({
                            name: chapter.name,
                            pages: pages
                        });
                    });
                });
            });
        });

    router.get("/teams/:teamId/manga/:mangaId/volumes",
        param("mangaId").isMongoId().exists(),
        param("teamId").isMongoId().exists(),
        query("extended").isBoolean().toBoolean().optional(),
        validationMiddleware,
        async (req, res) => {
            Manga.findById(req.params.mangaId).then(manga => {
                if (manga == null) return res.status(404).send(new BadRequestError("Manga not found"));

                Volume.find({
                    mangaId: manga._id,
                    teamId: req.params.teamId
                }).sort({ number: -1 }).then(volumes => {
                    const extended = req.query.extended || false;

                    let result: Array<{
                        id: number;
                        preview: string;
                        chapters?: Array<{
                            id: number;
                            name: string;
                        }>;
                    }> = [];

                    const callback = extended ? e => {
                        result.push({
                            id: e.number,
                            preview: e.preview,
                            chapters: e.chapters.map(c => {
                                return {
                                    id: c.number,
                                    name: c.name
                                };
                            })
                        });
                    } : e => {
                        result.push({
                            id: e.number,
                            preview: e.preview
                        });
                    };

                    volumes.forEach(callback);

                    res.send(result);
                });
            });
        });

    router.get("/teams/:teamId/manga/:mangaId/volumes/:volume/chapters",
        param("mangaId").isMongoId().exists(),
        param("teamId").isMongoId().exists(),
        param("volume").isNumeric().toInt(),
        async (req, res) => {
        Manga.findById(req.params.mangaId).then(manga => {
            if (manga == null) return res.status(404).send(new NotFoundError("Manga not found"));

            Volume.findOne({
                mangaId: manga._id,
                teamId: req.params.teamId,
                number: req.params.volume
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

    router.get("/explore",
        query("genres").isString().matches(genresQueryRegex).optional(),
        validationMiddleware,
        localeMiddleware,
        async (req, res) => {
            if (req.query.genres == null) {
                // TODO: Выводить общую ленту
                res.send([]);
            } else {
                const genres = req.query.genres.split(",").map(e => parseInt(e));
                const count = req.query.count || 5;

                if (validateGenres(genres)) {
                    Manga.find({
                        genres: { $in: genres }
                    }).limit(count).then(manga => {
                        const result: Array<{
                            id: string;
                            name: string;
                            description: string;
                            rating: {
                                total: number;
                                reviews: number;
                            };
                            preview: string;
                        }> = [];

                        manga.forEach(e => {
                            let locale = e.names.find(l => l.locale === req.query.locale);

                            if (locale == null) locale = e.names[0];

                            result.push({
                                id: e._id,
                                name: locale.name,
                                description: e.description,
                                rating: {
                                    total: e.rating.total,
                                    reviews: e.rating.reviews.length
                                },
                                preview: Storage.getPreview(PreviewType.Manga, e.preview)
                            });
                        });

                        res.send(result);
                    });
                } else res.status(400).send(new BadRequestError("Invalid genres"));
            }
        });
};

export default mangaApi;
