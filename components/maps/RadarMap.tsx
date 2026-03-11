"use client";

import { useMemo } from "react";

import LeafletLocationsMap, { type LocationPoint } from "@/components/maps/LeafletLocationsMap";
import { useGeocodeQueries } from "@/components/maps/useGeocodeQueries";

interface RadarAlert {
  category?: string;
  risk?: "low" | "medium" | "high";
  title?: string;
  description?: string;
  pivoting?: string;
  locationHint?: string;
  lat?: number | null;
  lng?: number | null;
}

interface RadarMapProps {
  alerts: RadarAlert[];
  destination?: string;
}

function buildGeocodeQuery(alert: RadarAlert, destination?: string): string {
  const locationHint = alert.locationHint?.trim();
  if (locationHint) {
    return destination ? `${locationHint}, ${destination}` : locationHint;
  }

  const title = alert.title?.trim();
  if (title) {
    return destination ? `${title}, ${destination}` : title;
  }

  return destination?.trim() ?? "";
}

export default function RadarMap({ alerts, destination }: RadarMapProps) {
  const candidates = useMemo(() => {
    return alerts.map((alert, index) => ({
      id: `radar-${(alert.title ?? "").trim().toLowerCase().replace(/\s+/g, "-") || index}-${alert.risk ?? "low"}`,
      name: alert.title?.trim() || `Alerta ${index + 1}`,
      query: buildGeocodeQuery(alert, destination),
      description: alert.description?.trim() || "Sem descrição.",
      risk: alert.risk ?? "low",
      lat: alert.lat ?? null,
      lng: alert.lng ?? null,
    }));
  }, [alerts, destination]);

  const queriesToGeocode = useMemo(
    () => candidates
      .filter((alert) => (alert.lat == null || alert.lng == null) && alert.query)
      .map((alert) => alert.query),
    [candidates],
  );

  const { results: geocoded, loading } = useGeocodeQueries(queriesToGeocode);

  const points = useMemo<LocationPoint[]>(() => {
    const mapped: LocationPoint[] = [];

    for (const candidate of candidates) {
      const geocodedPoint = candidate.query ? geocoded[candidate.query] : undefined;
      const lat = candidate.lat ?? geocodedPoint?.lat;
      const lng = candidate.lng ?? geocodedPoint?.lng;

      if (lat == null || lng == null) {
        continue;
      }

      mapped.push({
        id: candidate.id,
        name: candidate.name,
        description: candidate.description,
        lat,
        lng,
        risk: candidate.risk,
        highlightRadiusMeters: candidate.risk === "high" ? 650 : candidate.risk === "medium" ? 420 : 0,
      });
    }

    return mapped;
  }, [candidates, geocoded]);

  if (!points.length && loading) {
    return (
      <div className="trip-map-shell" style={{ minHeight: "220px", display: "grid", placeItems: "center", opacity: 0.65 }}>
        A preparar mapa de alertas...
      </div>
    );
  }

  if (!points.length) {
    return (
      <div className="trip-map-shell" style={{ minHeight: "220px", display: "grid", placeItems: "center", opacity: 0.65 }}>
        Sem coordenadas disponíveis para o mapa de alertas.
      </div>
    );
  }

  return (
    <div>
      <LeafletLocationsMap points={points} height={350} className="trip-map-shell" />
      <div className="radar-legend">
        <span><i className="radar-dot high" /> Alto</span>
        <span><i className="radar-dot medium" /> Médio</span>
        <span><i className="radar-dot low" /> Baixo</span>
      </div>
    </div>
  );
}
