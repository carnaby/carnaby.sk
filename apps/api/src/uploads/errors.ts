export class UnsupportedMimeTypeError extends Error {}

export class UpstreamNotFoundError extends Error {}

export class UpstreamUnavailableError extends Error {}

export class InvalidImageError extends Error {}

/** The URL (or a redirect, or the address its host resolves to) is not allowed to be fetched. */
export class BlockedUrlError extends Error {}

/** The response body is larger than the caller's cap. */
export class ResponseTooLargeError extends Error {}

/** A project page has no usable og:image / twitter:image, or is not an HTML page. */
export class NoShareImageError extends Error {}
