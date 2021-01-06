import * as fs from "fs";
import * as path from "path";
import * as sharp from "sharp";
import * as mkdirp from "mkdirp";

import {Router} from "express";
import Volume from "../../../schemas/volume";
import Character from "../../../schemas/character";
import Manga, {MangaInterface, MangaState, validateGenres} from "../../../schemas/manga";
import {Role} from "../../../schemas/user";

import {param, query} from "express-validator";
import {genresQueryRegex} from "../../../classes/regex";

import uploader from "../../../modules/uploader";

import validationMiddleware from "../../../modules/validation";
import localeMiddleware from "../../../modules/locale";
import roleMiddleware from "../../../modules/role";
import {
    jwtMiddleware,
    optionalJwtMiddleware
} from "../../../modules/jwt";

import Reviews from '../../../stores/reviews';

import {BadRequestError, ForbiddenError, NotFoundError} from "ts-http-errors";
import Storage, {PreviewType} from "../../../classes/storage";
import Team, {TeamInterface} from "../../../schemas/team";
import StreamZip = require("node-stream-zip");
import TimSort = require("timsort");

import MangaResolver from "../../../resolvers/manga";
import TeamResolver from "../../../resolvers/team";

import buildFullTextRegex from "../../../modules/search";
import lists, {ListName} from "../../../stores/lists";

function searchList(userId: string, mangaId: string) {
    return new Promise<ListName>(resolve => {
        lists.get(`${userId}_${mangaId}`).then(v => {
            resolve(v as any);
        }).catch(e => {
            if (e.notFound) resolve(null);
        });
    })
}

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
                        descriptions: [
                            {
                                locale: req.query.locale,
                                text: req.query.description
                            }
                        ],
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
                    descriptions: [
                        {
                            locale: req.query.locale,
                            text: req.query.description
                        }
                    ],
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
                    let localeIndex = e.names.findIndex(l => l.locale === req.query.locale);
                    if (localeIndex === -1) localeIndex = 0;

                    let descriptionIndex = e.descriptions.findIndex(l => l.locale === req.query.locale);
                    if (descriptionIndex === -1) descriptionIndex = 0;

                    result.push({
                        id: e._id,
                        name: e.names[localeIndex].name,
                        preview: Storage.getPreview(PreviewType.Manga, e.preview),
                        description: e.descriptions[descriptionIndex].text
                    });
                });

                res.send(result);
            });
        });

    router.get("/manga/:id",
        optionalJwtMiddleware,
        param("id").isString().isMongoId().exists(),
        query("extended").isBoolean().optional(),
        validationMiddleware,
        localeMiddleware,
        async (req, res) => {
            MangaResolver.findById<MangaInterface>(req.params.id).then(async manga => {
                if (manga == null) return res.status(404).send(new BadRequestError("Manga not found"));

                const extended = req.query.extended || false;
                const authorized = req.jwt != null;

                let localeIndex = manga.names.findIndex(e => e.locale === req.query.locale);
                if (localeIndex === -1) localeIndex = 0;

                let descriptionIndex = manga.descriptions.findIndex(e => e.locale === req.query.locale);
                if (descriptionIndex === -1) descriptionIndex = 0;

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

                    res.send({
                        names: [
                            manga.names[localeIndex].name,
                            ...[...manga.names].remove(localeIndex).map(e => e.name)
                        ],
                        list: authorized ? await (() => {
                            return new Promise<string | null>(async resolve => {
                                resolve(await searchList(req.jwt.userId, manga._id));
                            });
                        })() : undefined,
                        characters: characters,
                        status: manga.state,
                        explicit: manga.explicit,
                        rating: {
                            total: Math.round(manga.rating.total),
                            reviewsCount: manga.rating.reviews.length,
                            correlation: []
                        },
                        release: {
                            date: manga.released
                        },
                        genres: manga.genres,
                        translators: translators,
                        preview: Storage.getPreview(PreviewType.Manga, manga.preview),
                        description: manga.descriptions[descriptionIndex].text
                    });
                } else res.send({
                    name: manga.names[localeIndex].name,
                    list: authorized ? await (() => {
                        return new Promise<string | null>(async resolve => {
                            resolve(await searchList(req.jwt.userId, manga._id));
                        });
                    })() : undefined,
                    status: manga.state,
                    explicit: manga.explicit,
                    rating: {
                        total: Math.round(manga.rating.total),
                        reviewsCount: manga.rating.reviews.length,
                        correlation: [ 0.8, 0.1, 0.05, 0.03, 0.02 ]
                    },
                    release: {
                        date: manga.released
                    },
                    genres: manga.genres,
                    translators: manga.translators,
                    characters: manga.characters,
                    preview: Storage.getPreview(PreviewType.Manga, manga.preview),
                    description: manga.descriptions[descriptionIndex].text
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
                            photo: (e.photo === "empty") ? Storage.getEmptyTeamPhoto() : Storage.getTeamPhoto(e._id),
                            description: e.description
                        }));

                        res.send(result);
                    });
                } else res.send(manga.translators);
            });
        });

    router.get("/manga/:mangaId/reviews",
        param("mangaId").isMongoId().exists(),
        query("count").isNumeric().toInt(),
        validationMiddleware,
        async (req, res) => {
            Manga.findById(req.params.mangaId).then(manga => {
                if (manga == null) return res.status(404).send(new NotFoundError("Manga not found"));

                let count = 5;

                if (req.query.count && req.query.count < 20) {
                    count = req.query.count;
                } else res.status(400).send(new BadRequestError("count can't be greater than 20"));

                Reviews.getLast(manga._id, count).then(reviews => {
                   res.send(reviews);
                });
            });
        });

    router.post("/manga/:mangaId/reviews",
        jwtMiddleware,
        param("mangaId").isMongoId().exists(),
        validationMiddleware,
        async (req, res) => {
            Manga.findById(req.params.mangaId).then(manga => {
                if (manga == null) return res.status(404).send(new NotFoundError("Manga not found"));

                Reviews.has(manga._id, req.jwt.userId).then(has => {
                    if (has) return res.status(400).send(new BadRequestError("review already exist"));

                    Reviews.insert(manga._id, {
                        userId: req.jwt.userId,
                        created: new Date().getTime()
                    }).then(() => {
                        res.status(204).send();
                    });
                });
            });
        });

    router.delete("/manga/:mangaId/review",
        jwtMiddleware,
        param("mangaId").isMongoId().exists(),
        validationMiddleware,
        async (req, res) => {
            Manga.findById(req.params.mangaId).then(manga => {
                if (manga == null) return res.status(404).send(new NotFoundError("Manga not found"));

                Reviews.has(manga._id, req.jwt.userId).then(has => {
                   if (has) {
                       Reviews.remove(manga._id, req.jwt.userId).then(() => {
                          res.status(204).send();
                       });
                   } else res.status(400).send(new BadRequestError("Review does not exist"));
                });
            });
        });

    router.post("/teams/:teamId/manga/:mangaId/volumes/:volume/chapters/:chapter",
        jwtMiddleware,
        param("mangaId").isMongoId().exists(),
        param("teamId").isMongoId().exists(),
        param("volume").isNumeric().toInt(),
        param("chapter").isNumeric({ no_symbols: true }).toFloat(),
        // Данные главы
        query("name").isString().exists(),
        query("season").isNumeric().toInt(),
        query("series").isNumeric().toInt(),
        validationMiddleware,
        uploader.single("file"),
        async (req, res) => {
            Manga.findById(req.params.mangaId).then(manga => {
                if (manga == null) return res.status(404).send(new NotFoundError("Manga not found"));

                Team.findById(req.params.teamId).then(team => {
                    if (team == null) return res.status(404).send(new NotFoundError("Team not found."));

                    if (team.owner.toHexString() != req.jwt.userId && !team.members.includes(req.jwt.userId as any))
                        return res.status(403).send(new ForbiddenError("Access denied"));

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
                                    if (err) return;

                                    if (!manga.translators.includes(team._id)) {
                                        manga.translators.push(team._id);
                                        manga.save().then(() => {
                                            callback({
                                                zip: new Proxy(zip, {}),
                                                zipPath: req.file.path,
                                                pages: pages
                                            });
                                        });
                                    } else callback({
                                        zip: new Proxy(zip, {}),
                                        zipPath: req.file.path,
                                        pages: pages
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
                        const includesAdaptation = (req.query.series != null) && (req.query.season != null);

                        if (volume == null) {
                            if (req.file == null) return;

                            c(({
                               pages,
                               zip,
                               zipPath
                            }) => {
                                new Volume({
                                    number: req.params.volume,
                                    mangaId: manga._id,
                                    teamId: team._id,
                                    chapters: [
                                        {
                                            number: req.params.chapter,
                                            name: req.query.name,
                                            adaptation: includesAdaptation ? {
                                                season: req.query.season,
                                                series: req.query.series
                                            } : undefined,
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
                                const chapterIndex = volume.chapters.findIndex(e => e.number === req.params.chapter);

                                if (chapterIndex === -1) {
                                    volume.chapters.push({
                                        number: req.params.chapter,
                                        name: req.query.name,
                                        adaptation: includesAdaptation ? {
                                            season: req.query.season,
                                            series: req.query.series
                                        } : undefined,
                                        pages: pages
                                    });

                                    TimSort.sort(volume.chapters, (a, b) => (a.number - b.number));

                                    volume.save().then(() => {
                                        res.status(204).send();

                                        zip.close();
                                        fs.unlinkSync(zipPath);
                                    });
                                } else res.status(400).send(new BadRequestError("Chapter already exists"));
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
            TeamResolver.findById<TeamInterface>(req.params.teamId).then(team => {
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
                            adaptation: chapter.adaptation || undefined,
                            pages: pages
                        });
                    });
                });
            });
        });

    router.post("/teams/:teamId/manga/:mangaId/volumes/:volume/preview",
        jwtMiddleware,
        param("mangaId").isMongoId().exists(),
        param("teamId").isMongoId().exists(),
        param("volume").isNumeric().toInt(),
        validationMiddleware,
        uploader.single("preview"),
        async (req, res) => {
            Team.findById(req.params.teamId).then(team => {
                if (team == null) return res.status(404).send(new NotFoundError("Team not found."));

                if (team.owner.toHexString() != req.jwt.userId && !team.members.includes(req.jwt.userId as any))
                    return res.status(403).send(new ForbiddenError("Access denied."));

                Manga.findById(req.params.mangaId).then(manga => {
                    if (manga == null) return res.status(404).send(new NotFoundError("Manga not found."));

                    Volume.findOne({
                        teamId: team._id,
                        mangaId: manga._id,
                        number: req.params.volume
                    }).then(volume => {
                        if (volume == null) {
                            res.status(404).send(new NotFoundError("Volume not found."));
                            fs.unlinkSync(req.file.path);
                            return;
                        }

                        if (req.file != null) {
                            sharp(req.file.path).jpeg().toFile(path.join(process.cwd(), `/storage/team/${team._id}/manga/${manga._id}/${req.params.volume}/preview.jpg`)).then(() => {
                                fs.unlinkSync(req.file.path);

                                const sendRequest = () => {
                                    res.send({
                                        url: Storage.getVolumePreview(team._id, manga._id, volume.number)
                                    });
                                };

                                if (!volume.hasPreview) {
                                    volume.hasPreview = true;
                                    volume.save().then(() => sendRequest());
                                } else sendRequest();
                            });
                        } else res.status(400).send(new BadRequestError("preview must be defined"));
                    })
                });
            });
        });

    router.get("/teams/:teamId/manga/:mangaId/volumes/:volume",
        param("teamId").isMongoId(),
        param("mangaId").isMongoId(),
        param("volume").isNumeric().toInt(),
        // Дополнительные парметры
        query("extended").isBoolean().toBoolean().optional(),
        validationMiddleware,
        async (req, res) => {
            Manga.findById(req.params.mangaId).then(manga => {
               if (manga == null) return res.status(404).send(new NotFoundError("Manga not found."));

               Team.findById(req.params.teamId).then(team => {
                   if (team == null) return res.status(404).send(new NotFoundError("Team not found."));

                   Volume.findOne({
                       teamId: team._id,
                       mangaId: manga._id,
                       number: req.params.volume
                   }).then(volume => {
                       if (volume == null) return res.status(404).send(new NotFoundError("Volume not found."));

                       const extended = req.query.extended || false;

                       if (extended) {
                           res.send({
                               id: volume.number,
                               preview: volume.hasPreview ? Storage.getVolumePreview(team._id, manga._id, volume.number) : Storage.getEmptyPreview(),
                               chapters: volume.chapters.map(e => {
                                   return {
                                       id: e.number,
                                       name: e.name
                                   };
                               })
                           });
                       } else res.send({
                           id: volume.number,
                           preview: volume.hasPreview ? Storage.getVolumePreview(team._id, manga._id, volume.number) : Storage.getEmptyPreview()
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
            Team.findById(req.params.teamId).then(team => {
                if (team == null) return res.status(404).send(new NotFoundError("Team not found"));

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
                                preview: e.hasPreview ? Storage.getVolumePreview(team._id, manga._id, e.number) : Storage.getEmptyPreview(),
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
                                preview: e.hasPreview ? Storage.getVolumePreview(team._id, manga._id, e.number) : Storage.getEmptyPreview()
                            });
                        };

                        volumes.forEach(callback);

                        res.send(result);
                    });
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
                            let localeIndex = e.names.findIndex(l => l.locale === req.query.locale);
                            if (localeIndex === -1) localeIndex = 0;

                            let descriptionIndex = e.descriptions.findIndex(l => l.locale === req.query.locale);
                            if (descriptionIndex === -1) descriptionIndex = 0;

                            result.push({
                                id: e._id,
                                name: e.names[localeIndex].name,
                                description: e.descriptions[descriptionIndex].text,
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
