import * as path from "path";
import * as express from "express";
import * as mongoose from "mongoose";

import * as cors from "cors";
import * as helmet from "helmet";
import * as bodyParser from "body-parser";
import * as morganBody from 'morgan-body';
import * as serveStatic from "serve-static";

import apiRouter from "./routes/api";
import config, {isDevelopment} from "./classes/config";

mongoose.connect(isDevelopment ? config.env.development.mongodbUrl : config.env.production.mongodbUrl, {
    user: "manga",
    pass: "6~6zVDh]<jM-B5K?",
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true
}).then(() => {
    console.log("Successfully connected to DB");
});

const app = express();

if (isDevelopment) {
    morganBody(app);
}

app.use(cors());
app.use(helmet());
app.use(bodyParser.json());

app.use("/storage", serveStatic(path.join(__dirname, '../storage')));
app.use("/api", apiRouter);

app.listen(3200);