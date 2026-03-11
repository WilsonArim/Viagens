"use client";

import { useMemo } from "react";

import LeafletLocationsMap, { type LocationPoint } from "@/components/maps/LeafletLocationsMap";
import { useGeocodeQueries } from "@/components/maps/useGeocodeQueries";

interface RawMapPoint {
  period?: string;
  name?: string;
  query?: string;
  lat?: number;
  lng?: number;
}

interface ItineraryDay {
  day?: number;
  morning?: string;
  lunch?: string;
  afternoon?: string;
  mapPoints?: RawMapPoint[];
}

interface ItineraryMapProps {
  destination: string;
  days: ItineraryDay[];
}

interface CandidatePoint {
  id: string;
  name: string;
  query: string;
  description: string;
  markerTone: LocationPoint["markerTone"];
  lat?: number;
  lng?: number;
}

function trimSentence(input: string, maxLength = 72): string {
  const cleaned = input.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxLength)}...`;
}

export default function ItineraryMap({ destination, days }: ItineraryMapProps) {
  const candidates = useMemo(() => {
    const points: CandidatePoint[] = [];

    days.forEach((day, index) => {
      const dayLabel = day.day ?? index + 1;

      if (Array.isArray(day.mapPoints) && day.mapPoints.length > 0) {
        day.mapPoints.forEach((point, pointIndex) => {
          const name = (point.name ?? `${point.period ?? "Paragem"} dia ${dayLabel}`).trim();
          const query = (point.query ?? `${name}, ${destination}`).trim();
          const period = (point.period ?? "").toLowerCase();
          const markerTone =
            period === "morning"
              ? "gold"
              : period === "lunch"
                ? "orange"
                : period === "afternoon"
                  ? "blue"
                  : "neutral";

          points.push({
            id: `d${dayLabel}-custom-${pointIndex}`,
            name,
            query,
            description: `${point.period ?? "Paragem"} · Dia ${dayLabel}`,
            markerTone,
            lat: point.lat,
            lng: point.lng,
          });
        });

        return;
      }

      const fallbackPoints = [
        { key: "morning", label: "Manhã", text: day.morning ?? "" },
        { key: "lunch", label: "Almoço", text: day.lunch ?? "" },
        { key: "afternoon", label: "Tarde", text: day.afternoon ?? "" },
      ];

      fallbackPoints.forEach((item) => {
        const sentence = trimSentence(item.text);
        if (!sentence) {
          return;
        }

        points.push({
          id: `d${dayLabel}-${item.key}`,
          name: `${item.label} · Dia ${dayLabel}`,
          query: `${sentence}, ${destination}`,
          description: sentence,
          markerTone: item.key === "morning" ? "gold" : item.key === "lunch" ? "orange" : "blue",
        });
      });
    });

    return points;
  }, [days, destination]);

  const queriesToGeocode = useMemo(
    () => candidates
      .filter((point) => point.lat == null || point.lng == null)
      .map((point) => point.query),
    [candidates],
  );

  const { results: geocoded, loading } = useGeocodeQueries(queriesToGeocode);

  const points = useMemo<LocationPoint[]>(() => {
    const mapped: LocationPoint[] = [];

    for (const point of candidates) {
      const geocodedPoint = geocoded[point.query];
      const lat = point.lat ?? geocodedPoint?.lat;
      const lng = point.lng ?? geocodedPoint?.lng;

      if (lat == null || lng == null) {
        continue;
      }

      mapped.push({
        id: point.id,
        name: point.name,
        description: point.description,
        lat,
        lng,
        markerTone: point.markerTone,
      });
    }

    return mapped;
  }, [candidates, geocoded]);

  if (!points.length && loading) {
    return (
      <div className="trip-map-shell" style={{ minHeight: "220px", display: "grid", placeItems: "center", opacity: 0.65 }}>
        A preparar mapa do roteiro...
      </div>
    );
  }

  if (!points.length) {
    return null;
  }

  return (
    <div style={{ marginBottom: "0.9rem" }}>
      <LeafletLocationsMap points={points} height={280} className="trip-map-shell" />
    </div>
  );
}
