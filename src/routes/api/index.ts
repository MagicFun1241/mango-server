import {Router} from "express";

import usersApi from "./users";
import mangaApi from "./manga";
import ticketsApi from "./tickets";
import newsApi from "./news";
import teamsApi from "./teams";

const router = Router();

newsApi(router);
usersApi(router);
mangaApi(router);
teamsApi(router);
ticketsApi(router);

export default router;