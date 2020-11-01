import createLogger from '@magicfun1241/logging';
import {isDevelopment} from "./config";

const logger = createLogger('Manga');

export default class Logger {
    static info(...params) {
        if (isDevelopment) logger.info(...params);
    }

    static warning(...params) {
        if (isDevelopment) logger.warn(...params);
    }

    static error(...params) {
        logger.error(...params);
    }
}