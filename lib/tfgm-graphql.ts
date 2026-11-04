/**
 * Minimal client for TfGM's GraphQL API (the backend behind tfgm.com's live departure pages).
 *
 * The API is unauthenticated, allows cross-origin requests, has introspection disabled and masks error details, so the
 * queries used with this are taken from what tfgm.com itself uses.
 *
 * Kept free of browser/bundler specifics so it can be used from the site, Node scripts, or a proxy if ever needed.
 */
export const DEFAULT_TFGM_GRAPHQL_ENDPOINT = "https://apiary.tfgm.com/";

type GraphQLResponse<T> = {
  data?: T | null;
  errors?: { message: string; path?: (string | number)[]; extensions?: { code?: string } }[];
};

/** Extra request options. Browsers ignore some headers, such as user-agent */
export type TfgmRequestOptions = {
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export async function tfgmQuery<T>(
  document: string,
  variables: Record<string, unknown> = {},
  endpoint = DEFAULT_TFGM_GRAPHQL_ENDPOINT,
  { headers = {}, signal }: TfgmRequestOptions = {}
): Promise<T> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ query: document, variables }),
    signal,
  });

  // Errors come back as JSON even with non-2xx statuses (e.g. 500 with code TOO_COMPLEX for oversized queries)
  const { data, errors } = (await response.json().catch(() => ({}))) as GraphQLResponse<T>;

  // Partial errors are expected (e.g. an unknown ATCO code yields a null entry and a RESOURCE_NOT_FOUND error), so
  // only treat the response as a failure when there's no data at all
  if (!response.ok || !data) {
    const message = errors?.map(({ message, extensions }) => `${extensions?.code ?? ""} ${message}`).join("; ");
    throw new Error(`TfGM API request failed (${response.status}): ${message ?? response.statusText}`);
  }

  return data;
}
