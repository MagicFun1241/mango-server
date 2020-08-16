import {Router} from "express";

import usersApi from "./users";
import mangaApi from "./manga";

const router = Router();

usersApi(router);
mangaApi(router);

export default router;