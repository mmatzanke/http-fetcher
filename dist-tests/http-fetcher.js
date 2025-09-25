import { HTTPError } from "ky";
import { Maybe as MaybeModule, Result } from "true-myth";
import { z } from "zod";
import { HTTPErrorWithResponseBody } from "./http-error-with-response-body.js";
export const isParametersWithUrl = (parameters) => {
    return "url" in parameters && parameters.url instanceof URL;
};
const backendErrorsSchema = z.object({
    errors: z
        .object({
        errorCode: z.string(),
        message: z.string(),
    })
        .array()
        .min(1),
});
const mapErrorToHttpFetcherError = (value, error) => {
    const backendErrors = backendErrorsSchema.safeParse(value);
    if (backendErrors.success) {
        const errorCode = backendErrors.data.errors[0]?.errorCode ?? "";
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
export const createHttpFetcher = ({ errorReporter, ky }, options) => {
    const { baseUrl, requestHeaders: initialRequestHeaders } = options ?? {};
    let requestHeaders = MaybeModule.nothing();
    const httpErrorHandlers = [];
    const determineUrlToFetch = (urlParameters) => {
        if (isParametersWithUrl(urlParameters)) {
            return urlParameters.url;
        }
        const basePath = baseUrl?.pathname.replace(/\/+$/, "");
        const extendedPath = urlParameters.pathname.replace(/^\/+/, "");
        return new URL(`${basePath}/${extendedPath}`, baseUrl);
    };
    const fetch = async (options) => {
        const { method, payload, requestOptions, url } = options;
        const kyOptions = {
            ...requestOptions,
            headers: requestHeaders.mapOrElse(() => ({ ...initialRequestHeaders, ...requestOptions.headers }), (defaultHeaders) => ({
                ...initialRequestHeaders,
                ...defaultHeaders,
                ...requestOptions.headers,
            })),
            json: payload,
            method,
        };
        try {
            const response = await ky(url, kyOptions);
            const contentType = response.headers.get("content-type");
            if (contentType?.startsWith("application/json") === true) {
                return Result.ok(await response.json());
            }
            return Result.ok(await response.text());
        }
        catch (error) {
            if (error instanceof HTTPError) {
                errorReporter.reportError(error.message, error);
                for (const httpErrorHandler of httpErrorHandlers) {
                    httpErrorHandler(error);
                }
                try {
                    const responseJson = await error.response.json();
                    return Result.err(mapErrorToHttpFetcherError(responseJson, new HTTPErrorWithResponseBody(error, responseJson)));
                }
                catch (_) {
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
            return fetch({
                method: "DELETE",
                requestOptions,
                url: determineUrlToFetch(parameters),
            });
        },
        async deleteJson(parameters) {
            const { payload, requestOptions = {} } = parameters;
            return fetch({
                method: "DELETE",
                payload,
                requestOptions,
                url: determineUrlToFetch(parameters),
            });
        },
        async get(parameters) {
            const { requestOptions = {} } = parameters;
            return fetch({
                method: "GET",
                requestOptions,
                url: determineUrlToFetch(parameters),
            });
        },
        async patchJson(parameters) {
            const { payload, requestOptions = {} } = parameters;
            return fetch({
                method: "PATCH",
                payload,
                requestOptions,
                url: determineUrlToFetch(parameters),
            });
        },
        async post(parameters) {
            const { requestOptions = {} } = parameters;
            return fetch({
                method: "POST",
                requestOptions,
                url: determineUrlToFetch(parameters),
            });
        },
        async postJson(parameters) {
            const { payload, requestOptions = {} } = parameters;
            return fetch({
                method: "POST",
                payload,
                requestOptions,
                url: determineUrlToFetch(parameters),
            });
        },
        async put(parameters) {
            const { requestOptions = {} } = parameters;
            return fetch({
                method: "PUT",
                requestOptions,
                url: determineUrlToFetch(parameters),
            });
        },
        async putJson(parameters) {
            const { payload, requestOptions = {} } = parameters;
            return fetch({
                method: "PUT",
                payload,
                requestOptions,
                url: determineUrlToFetch(parameters),
            });
        },
        set requestHeaders(_requestHeaders) {
            requestHeaders = requestHeaders.mapOrElse(() => MaybeModule.of(_requestHeaders), (headers) => MaybeModule.of({
                ...headers,
                ..._requestHeaders,
            }));
        },
    };
};
