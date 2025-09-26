import { HTTPError } from 'ky';
import type { Options } from 'ky';
import type _ky from 'ky';
import Maybe from 'true-myth/maybe';
import Result from 'true-myth/result';
import { z } from 'zod';

import { HTTPErrorWithResponseBody } from './http-error-with-response-body.js';
import type { HTTPMethod } from './http-method.js';

export type RequestOptions = Pick<Options, 'body' | 'credentials' | 'headers' | 'searchParams' | 'signal' | 'timeout'>;

export type Pathname = `/${string}`;

type InternalFetchOptions = {
    readonly method: HTTPMethod;
    readonly payload?: unknown;
    readonly requestOptions: RequestOptions;
    readonly url: URL;
};

export type HttpFetcherOptions = {
    readonly baseUrl?: URL;
    readonly requestHeaders?: RequestHeaders;
};

export type ErrorReporter = {
    readonly reportError: (message: string, error: Error) => void;
};

type HttpFetcherDependencies = {
    readonly errorReporter: ErrorReporter;
    readonly ky: typeof _ky;
};

type ParametersWithoutPayloadBase = {
    readonly requestOptions?: RequestOptions;
};

export type ParametersWithUrl = {
    readonly url: URL;
};

export type ParametersWithPathname = {
    readonly pathname: Pathname;
};

type ParametersWithoutPayload<T extends HttpFetcherOptions> = T['baseUrl'] extends URL
    ? ParametersWithoutPayloadBase & ParametersWithPathname
    : ParametersWithoutPayloadBase & ParametersWithUrl;

type ParametersWithJsonPayload<T extends HttpFetcherOptions> = ParametersWithoutPayload<T> & {
    readonly payload: unknown;
};

export type RequestHeaders = Record<string, string>;

export const isParametersWithUrl = (
    parameters: ParametersWithPathname | ParametersWithUrl,
): parameters is ParametersWithUrl => {
    return 'url' in parameters && parameters.url instanceof URL;
};

type ErrorHandler = (error: HTTPError) => void;

export type HttpFetcherError = Error & { readonly errorCode?: string; readonly message?: string };

const backendErrorsSchema = z.object({
    errors: z
        .object({
            errorCode: z.string(),
            message: z.string(),
        })
        .array()
        .min(1),
});

const mapErrorToHttpFetcherError = (value: unknown, error: Error): HttpFetcherError => {
    const backendErrors = backendErrorsSchema.safeParse(value);

    if (backendErrors.success) {
        const errorCode = backendErrors.data.errors[0]?.errorCode ?? '';
        const errorMessage = backendErrors.data.errors[0]?.message ?? error.message;

        const message = `${errorCode}: ${errorMessage}`;

        return {
            ...error,
            errorCode,
            message,
        };
    }

    return error;
};

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export interface HttpFetcher<T extends HttpFetcherOptions = HttpFetcherOptions> {
    readonly addHttpErrorHandler: (errorHandler: ErrorHandler) => void;
    readonly delete: (options: ParametersWithoutPayload<T>) => Promise<Result<unknown, HttpFetcherError>>;
    readonly deleteJson: (options: ParametersWithJsonPayload<T>) => Promise<Result<unknown, HttpFetcherError>>;
    readonly get: (options: ParametersWithoutPayload<T>) => Promise<Result<unknown, HttpFetcherError>>;
    readonly patchJson: (options: ParametersWithJsonPayload<T>) => Promise<Result<unknown, HttpFetcherError>>;
    readonly post: (options: ParametersWithoutPayload<T>) => Promise<Result<unknown, HttpFetcherError>>;
    readonly postJson: (options: ParametersWithJsonPayload<T>) => Promise<Result<unknown, HttpFetcherError>>;
    readonly put: (options: ParametersWithoutPayload<T>) => Promise<Result<unknown, HttpFetcherError>>;
    readonly putJson: (options: ParametersWithJsonPayload<T>) => Promise<Result<unknown, HttpFetcherError>>;
    set requestHeaders(headers: RequestHeaders);
}

export const createHttpFetcher = <T extends HttpFetcherOptions>(
    { errorReporter, ky }: HttpFetcherDependencies,
    options?: T,
): HttpFetcher<T> => {
    const { baseUrl, requestHeaders: initialRequestHeaders } = options ?? {};
    let requestHeaders: Maybe<RequestHeaders> = Maybe.nothing();
    const httpErrorHandlers: ErrorHandler[] = [];

    const determineUrlToFetch = (urlParameters: ParametersWithPathname | ParametersWithUrl): URL => {
        if (isParametersWithUrl(urlParameters)) {
            return urlParameters.url;
        }

        const basePath = baseUrl?.pathname.replace(/\/+$/, '');
        const extendedPath = urlParameters.pathname.replace(/^\/+/, '');

        return new URL(`${basePath}/${extendedPath}`, baseUrl);
    };

    const fetch = async (options: InternalFetchOptions): Promise<Result<unknown, HttpFetcherError>> => {
        const { method, payload, requestOptions, url } = options;
        const kyOptions: Options = {
            ...requestOptions,
            headers: requestHeaders.mapOrElse(
                () => ({ ...initialRequestHeaders, ...requestOptions.headers }),
                (defaultHeaders) => ({ ...initialRequestHeaders, ...defaultHeaders, ...requestOptions.headers }),
            ),
            json: payload,
            method,
        };

        try {
            const response = await ky(url, kyOptions);
            const contentType = response.headers.get('content-type');

            if (contentType?.startsWith('application/json') === true) {
                return Result.ok(await response.json());
            }

            return Result.ok(await response.text());
        } catch (error: unknown) {
            if (error instanceof HTTPError) {
                errorReporter.reportError(error.message, error);

                for (const httpErrorHandler of httpErrorHandlers) {
                    httpErrorHandler(error);
                }

                try {
                    const responseJson = await error.response.json();

                    return Result.err(
                        mapErrorToHttpFetcherError(responseJson, new HTTPErrorWithResponseBody(error, responseJson)),
                    );
                } catch (_: unknown) {
                    return Result.err(error);
                }
            }

            if (error instanceof Error) {
                errorReporter.reportError(error.message, error);

                return Result.err(error);
            }
        }

        const error = new Error(`Could not fetch from ${url}`);

        errorReporter.reportError(error.message, error);

        return Result.err(error);
    };

    return {
        addHttpErrorHandler(httpErrorHandler) {
            httpErrorHandlers.push(httpErrorHandler);
        },
        async delete(parameters) {
            const { requestOptions = {} } = parameters;

            return fetch({ method: 'DELETE', requestOptions, url: determineUrlToFetch(parameters) });
        },
        async deleteJson(parameters) {
            const { payload, requestOptions = {} } = parameters;

            return fetch({ method: 'DELETE', payload, requestOptions, url: determineUrlToFetch(parameters) });
        },
        async get(parameters) {
            const { requestOptions = {} } = parameters;

            return fetch({ method: 'GET', requestOptions, url: determineUrlToFetch(parameters) });
        },
        async patchJson(parameters) {
            const { payload, requestOptions = {} } = parameters;

            return fetch({ method: 'PATCH', payload, requestOptions, url: determineUrlToFetch(parameters) });
        },
        async post(parameters) {
            const { requestOptions = {} } = parameters;

            return fetch({ method: 'POST', requestOptions, url: determineUrlToFetch(parameters) });
        },
        async postJson(parameters) {
            const { payload, requestOptions = {} } = parameters;

            return fetch({ method: 'POST', payload, requestOptions, url: determineUrlToFetch(parameters) });
        },
        async put(parameters) {
            const { requestOptions = {} } = parameters;

            return fetch({ method: 'PUT', requestOptions, url: determineUrlToFetch(parameters) });
        },
        async putJson(parameters) {
            const { payload, requestOptions = {} } = parameters;

            return fetch({ method: 'PUT', payload, requestOptions, url: determineUrlToFetch(parameters) });
        },
        set requestHeaders(_requestHeaders: RequestHeaders) {
            requestHeaders = requestHeaders.mapOrElse(
                () => Maybe.of(_requestHeaders),
                (headers) =>
                    Maybe.of<RequestHeaders>({
                        ...headers,
                        ..._requestHeaders,
                    }),
            );
        },
    };
};
