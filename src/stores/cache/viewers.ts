import * as NodeCache from "node-cache";

import Manga from '../../schemas/manga';

const viewers = new NodeCache({
    stdTTL: 2 * 60
});

viewers.on( "expired", (key, value) => {
    Manga.findById(key).then(manga => {
        if (manga == null) return;

        manga.views = value;
        manga.save();
    });
});

export default viewers;
