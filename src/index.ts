import * as path from "path";
import * as express from "express";
import * as mongoose from "mongoose";

import * as cors from "cors";
import * as helmet from "helmet";
import * as bodyParser from "body-parser";
import * as serveStatic from "serve-static";

import apiRouter from "./routes/api";

mongoose.connect('mongodb://localhost:27017/manga', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true
}).then(() => {
    console.log("Successfully connected to DB");
});

const app = express();

app.use(cors());
app.use(helmet());
app.use(bodyParser.json());

app.use("/storage", serveStatic(path.join(__dirname, '../storage')));
app.use("/api", apiRouter);

app.listen(3200);