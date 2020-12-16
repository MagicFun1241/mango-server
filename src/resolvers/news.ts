import News, {NewsInterface} from "../schemas/news";

import createResolver from "../modules/resolver";

const NewsResolver = createResolver<NewsInterface>(News, 2 * 60);

export default NewsResolver;
