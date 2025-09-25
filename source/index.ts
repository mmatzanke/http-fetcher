import ky from "ky";

import { createHttpFetcher as _createHttpFetcher } from "./http-fetcher.js";

import type { HttpFetcher, HttpFetcherOptions } from "./http-fetcher.js";

export type HttpFetcherWithBaseUrl = HttpFetcher<{ readonly baseUrl: URL }>;
export type ErrorReporter = {
  readonly reportError: (message: string, error: Error) => void;
};
export type HttpFetcherDependencies = {
  readonly errorReporter: ErrorReporter;
};

export const createHttpFetcher = <T extends HttpFetcherOptions>(
  dependencies: HttpFetcherDependencies,
  options?: T
): HttpFetcher<T> => {
  const { errorReporter } = dependencies;

  return _createHttpFetcher({ errorReporter, ky }, options);
};
