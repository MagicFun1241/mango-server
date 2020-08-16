import {validationResult} from "express-validator";

export default (req, res, done) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    } done();
};