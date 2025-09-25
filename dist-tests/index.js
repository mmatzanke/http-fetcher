import ky from "ky";
import { createHttpFetcher as _createHttpFetcher } from "./http-fetcher.js";
export const createHttpFetcher = (dependencies, options) => {
    const { errorReporter } = dependencies;
    return _createHttpFetcher({ errorReporter, ky }, options);
};
