import type { PlausibleCountryRow } from './types';

export interface FetchPlausibleStatsOptions {
  siteId: string;
  apiKey?: string;
  period?: string;
}

export async function fetchPlausibleStats(
  options: FetchPlausibleStatsOptions
): Promise<PlausibleCountryRow[] | null> {
  const apiKey = (options.apiKey ?? process.env.PLAUSIBLE_API_KEY)?.trim();

  if (!apiKey || apiKey === 'undefined') {
    return null;
  }

  const period = options.period || '30d';
  const url = `https://plausible.io/api/v1/stats/breakdown?site_id=${encodeURIComponent(
    options.siteId
  )}&period=${encodeURIComponent(
    period
  )}&property=visit:country&metrics=visitors,visits,bounce_rate,visit_duration`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!res.ok) {
      console.warn(
        `[plausible] Non-OK response from Plausible API: ${res.status} ${res.statusText}`
      );
      return null;
    }

    const data = await res.json();
    const results = Array.isArray(data?.results) ? data.results : [];

    return results.map((r: any) => {
      let country = String(r.country || '').trim().toUpperCase();
      if (country === 'GB') {
        country = 'UK';
      }
      return {
        country,
        visitors: Number(r.visitors || 0),
        visits: Number(r.visits || 0),
        bounceRate: Number(r.bounce_rate ?? r.bounceRate ?? 0),
        visitDuration: Number(r.visit_duration ?? r.visitDuration ?? 0),
      };
    });
  } catch (err) {
    console.warn(
      '[plausible] Error fetching Plausible stats:',
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}
