import * as multer from "multer";
import * as path from "path";

const uploader = multer({
    dest: path.join(process.cwd(), "storage/temp")
});

export default uploader;