import Manga, {MangaInterface} from "../schemas/manga";

import createResolver from "../modules/resolver";

const MangaResolver = createResolver<MangaInterface>(Manga, 2 * 60);

export default MangaResolver;
