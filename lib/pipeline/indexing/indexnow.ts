export interface IndexNowPayload {
  host: string;
  key: string;
  keyLocation?: string;
  urlList: string[];
}

export interface IndexNowOptions {
  siteUrl: string;
  key?: string;
  keyLocation?: string;
  urlList: string[];
  endpoint?: string;
  fetchFn?: typeof fetch;
}

export interface IndexNowResult {
  success: boolean;
  status: 'submitted' | 'error';
  httpStatus?: number;
  message?: string;
  payload?: IndexNowPayload;
}

export async function submitIndexNow(options: IndexNowOptions): Promise<IndexNowResult> {
  const key = options.key ?? process.env.INDEXNOW_KEY;

  if (!key || !/^[a-zA-Z0-9_-]{8,128}$/.test(key)) {
    return {
      success: false,
      status: 'error',
      message: 'Invalid or missing IndexNow key. Must be 8-128 alphanumeric/dash characters.',
    };
  }

  let host: string;
  try {
    const parsed = new URL(options.siteUrl);
    host = parsed.hostname;
    if (!host) {
      throw new Error('Missing hostname');
    }
  } catch {
    return {
      success: false,
      status: 'error',
      message: `Invalid siteUrl: ${options.siteUrl}`,
    };
  }

  if (!Array.isArray(options.urlList) || options.urlList.length === 0) {
    return {
      success: false,
      status: 'error',
      message: 'urlList must contain at least one URL.',
    };
  }

  if (options.urlList.length > 10000) {
    return {
      success: false,
      status: 'error',
      message: `urlList exceeds 10,000 URLs limit (got ${options.urlList.length}).`,
    };
  }

  const cleanSiteUrl = options.siteUrl.replace(/\/+$/, '');
  const keyLocation = options.keyLocation ?? `${cleanSiteUrl}/${key}.txt`;

  const payload: IndexNowPayload = {
    host,
    key,
    keyLocation,
    urlList: options.urlList,
  };

  const endpoint = options.endpoint ?? 'https://api.indexnow.org/indexnow';
  const fetcher = options.fetchFn ?? fetch;

  try {
    const res = await fetcher(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Host': 'api.indexnow.org',
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 200 || res.status === 202) {
      return {
        success: true,
        status: 'submitted',
        httpStatus: res.status,
        payload,
      };
    }

    return {
      success: false,
      status: 'error',
      httpStatus: res.status,
      message: `IndexNow API error: HTTP ${res.status} ${res.statusText || ''}`.trim(),
      payload,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      status: 'error',
      message: `IndexNow dispatch network failure: ${message}`,
      payload,
    };
  }
}
