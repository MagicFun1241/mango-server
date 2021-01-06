import * as fs from "fs";
import * as path from "path";

import {Router} from "express";

import usersApi from "./users";
import mangaApi from "./manga";
import ticketsApi from "./tickets";
import newsApi from "./news";
import teamsApi from "./teams";
import charactersApi from "./characters";
import listsApi from "./lists";

const router = Router();

listsApi(router);
newsApi(router);
usersApi(router);
mangaApi(router);
teamsApi(router);
ticketsApi(router);
charactersApi(router);

router.get("/agreement", async (req, res) => {
    // res.sendFile();

    res.send(fs.readFileSync(path.join(process.cwd(), "AGREEMENT.md"), { encoding: "utf8" }));
});

export default router;
