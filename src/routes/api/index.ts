import {Router} from "express";

import usersApi from "./users";
import mangaApi from "./manga";
import ticketsApi from "./tickets";
import newsApi from "./news";
import teamsApi from "./teams";
import charactersApi from "./characters";

const router = Router();

newsApi(router);
usersApi(router);
mangaApi(router);
teamsApi(router);
ticketsApi(router);
charactersApi(router);

export default router;
