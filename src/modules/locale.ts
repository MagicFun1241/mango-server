import * as geoip from "geoip-lite";

import {BadRequestError} from "ts-http-errors";
import {
    Request,
    Response,
    NextFunction
} from "express";

export enum Locale {
    English = "en",
    Russian = "ru"
}

export const supportedLocales = [
    Locale.English,
    Locale.Russian
];

export function resolveLocale(ip: string): string | null {
    const geo = geoip.lookup(ip);

    if (geo == null) return null;

    return geo.country.toLowerCase();
}

export default function localeMiddleware(request: Request, response: Response, next: NextFunction) {
    if (request.query.locale == null) {
        request.query.locale = supportedLocales[0];
        next();
    } else if (typeof request.query.locale != "string") {
        response.status(400).send(new BadRequestError("locale must be string"));
    } else {
        if (supportedLocales.includes(request.query.locale as any)) next();
        else response.status(400).send(new BadRequestError("locale is not supported"));
    }
}