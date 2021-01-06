import Level from "../classes/level";

type ListName = "abandoned" | "readed" | "planing";

const listNames = ["readed", "abandoned", "planing"];

const lists = new Level("storage/stores/lists");

export {
    ListName,
    listNames
};

export default lists;
