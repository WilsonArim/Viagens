"use client";

import { useMemo } from "react";

import LeafletLocationsMap from "@/components/maps/LeafletLocationsMap";
import { useGeocodeQueries } from "@/components/maps/useGeocodeQueries";

interface TripPreviewMapProps {
  destination: string | null;
  height?: number;
}

export default function TripPreviewMap({ destination, height = 160 }: TripPreviewMapProps) {
  const cleanDestination = destination?.trim() ?? "";
  const { results, loading } = useGeocodeQueries(cleanDestination ? [cleanDestination] : []);

  const point = useMemo(() => {
    if (!cleanDestination) {
      return null;
    }

    const location = results[cleanDestination];
    if (!location) {
      return null;
    }

    return {
      id: cleanDestination,
      name: cleanDestination,
      lat: location.lat,
      lng: location.lng,
      markerTone: "gold" as const,
      description: "Destino principal",
    };
  }, [cleanDestination, results]);

  if (!cleanDestination) {
    return null;
  }

  if (!point && loading) {
    return <div className="trip-map-shell" style={{ minHeight: `${height}px`, display: "grid", placeItems: "center", opacity: 0.65 }}>A geocodificar destino...</div>;
  }

  if (!point) {
    return <div className="trip-map-shell" style={{ minHeight: `${height}px`, display: "grid", placeItems: "center", opacity: 0.65 }}>Mapa indisponível para este destino.</div>;
  }

  return <LeafletLocationsMap points={[point]} height={height} className="trip-map-shell" zoom={11} />;
}
