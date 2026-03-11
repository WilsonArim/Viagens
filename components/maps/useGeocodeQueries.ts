"use client";

import { useEffect, useMemo, useState } from "react";

interface GeocodeResult {
  query: string;
  lat: number;
  lng: number;
  displayName: string;
}

declare global {
  interface Window {
    __detetiveGeocodeCache?: Map<string, GeocodeResult | null>;
  }
}

const globalCache =
  typeof window !== "undefined"
    ? (window.__detetiveGeocodeCache ??= new Map<string, GeocodeResult | null>())
    : new Map<string, GeocodeResult | null>();

function normalize(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function areResultsEqual(
  a: Record<string, GeocodeResult>,
  b: Record<string, GeocodeResult>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  if (aKeys.length !== bKeys.length) {
    return false;
  }

  for (const key of aKeys) {
    const av = a[key];
    const bv = b[key];

    if (!bv) {
      return false;
    }

    if (av.query !== bv.query || av.lat !== bv.lat || av.lng !== bv.lng || av.displayName !== bv.displayName) {
      return false;
    }
  }

  return true;
}

export function useGeocodeQueries(queries: string[]) {
  const [results, setResults] = useState<Record<string, GeocodeResult>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rawSignature = useMemo(
    () => JSON.stringify(queries.map((query) => query.trim()).filter(Boolean)),
    [queries],
  );

  const uniqueQueries = useMemo(() => {
    const source = rawSignature ? (JSON.parse(rawSignature) as string[]) : [];
    const seen = new Set<string>();
    const output: string[] = [];

    for (const query of source) {
      const trimmed = query.trim();
      if (!trimmed) {
        continue;
      }

      const normalized = normalize(trimmed);
      if (seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      output.push(trimmed);
    }

    return output;
  }, [rawSignature]);

  useEffect(() => {
    if (!uniqueQueries.length) {
      setResults((previous) => (Object.keys(previous).length === 0 ? previous : {}));
      setLoading(false);
      setError(null);
      return;
    }

    let mounted = true;
    const fromCache: Record<string, GeocodeResult> = {};
    const missing: string[] = [];

    for (const query of uniqueQueries) {
      const cached = globalCache.get(normalize(query));
      if (cached) {
        fromCache[query] = cached;
      } else if (cached === null) {
        continue;
      } else {
        missing.push(query);
      }
    }

    setResults((previous) => (areResultsEqual(previous, fromCache) ? previous : fromCache));

    if (!missing.length) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    void fetch("/api/maps/geocode", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ queries: missing }),
    })
      .then((response) => response.json().then((json) => ({ ok: response.ok, json })))
      .then(({ ok, json }) => {
        if (!mounted) {
          return;
        }
        if (!ok) {
          setError(json?.error === "rate_limit" ? "Limite de pedidos atingido. Tenta novamente em breve." : "Erro ao geocodificar localizações.");
          return;
        }

        const payload = Array.isArray(json?.results)
          ? (json.results as GeocodeResult[])
          : [];

        const merged: Record<string, GeocodeResult> = { ...fromCache };

        for (const item of payload) {
          const key = normalize(item.query);
          globalCache.set(key, item);
          merged[item.query] = item;
        }

        const matched = new Set(payload.map((item) => normalize(item.query)));
        for (const query of missing) {
          const key = normalize(query);
          if (!matched.has(key)) {
            globalCache.set(key, null);
          }
        }

        setResults(merged);
      })
      .catch(() => {
        if (mounted) {
          setError("Falha de rede ao geocodificar.");
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [uniqueQueries]);

  return { results, loading, error };
}
