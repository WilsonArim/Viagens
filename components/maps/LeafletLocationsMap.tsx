"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Circle,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

export type MarkerTone = "gold" | "blue" | "green" | "red" | "orange" | "neutral";

export interface LocationPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  description?: string;
  markerTone?: MarkerTone;
  risk?: "low" | "medium" | "high";
  highlightRadiusMeters?: number;
}

interface LeafletLocationsMapProps {
  points: LocationPoint[];
  height?: number;
  zoom?: number;
  className?: string;
}

const TONE_COLORS: Record<MarkerTone, string> = {
  gold: "#c9a96e",
  blue: "#74b0d4",
  green: "#22c55e",
  red: "#ef4444",
  orange: "#f59e0b",
  neutral: "#94a3b8",
};

const RISK_COLORS: Record<"low" | "medium" | "high", string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
};

const iconCache = new Map<string, L.DivIcon>();

function createMarkerIcon(color: string): L.DivIcon {
  const cached = iconCache.get(color);
  if (cached) return cached;

  const icon = L.divIcon({
    className: "leaflet-pin",
    html: `<span style="display:block;width:16px;height:16px;border-radius:999px;background:${color};border:2px solid rgba(255,255,255,0.95);box-shadow:0 0 0 3px ${color}30;"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
  iconCache.set(color, icon);
  return icon;
}

function FitBounds({ points }: { points: LocationPoint[] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (points.length <= 1 || fitted.current) {
      return;
    }

    const bounds = L.latLngBounds(points.map((point) => [point.lat, point.lng]));
    map.fitBounds(bounds, { padding: [40, 40] });
    fitted.current = true;
  }, [map, points]);

  return null;
}

export default function LeafletLocationsMap({
  points,
  height = 340,
  zoom = 12,
  className,
}: LeafletLocationsMapProps) {
  const validPoints = points.filter((point) => !Number.isNaN(point.lat) && !Number.isNaN(point.lng));

  const initialCenter: [number, number] = validPoints.length
    ? [validPoints[0].lat, validPoints[0].lng]
    : [38.7223, -9.1393];

  if (!validPoints.length) {
    return (
      <div className={className} style={{ padding: "1rem", opacity: 0.65 }}>
        Sem coordenadas disponíveis para renderizar o mapa.
      </div>
    );
  }

  return (
    <div className={className}>
      <MapContainer
        center={initialCenter}
        zoom={zoom}
        style={{ height, width: "100%", borderRadius: "14px" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        />

        <FitBounds points={validPoints} />

        {validPoints.map((point) => {
          const toneColor = point.risk ? RISK_COLORS[point.risk] : TONE_COLORS[point.markerTone ?? "neutral"];
          return (
            <Marker key={point.id} position={[point.lat, point.lng]} icon={createMarkerIcon(toneColor)}>
              <Popup>
                <strong>{point.name}</strong>
                {point.description ? <p style={{ margin: "0.35rem 0 0" }}>{point.description}</p> : null}
              </Popup>
            </Marker>
          );
        })}

        {validPoints
          .filter((point) => point.highlightRadiusMeters && point.highlightRadiusMeters > 0)
          .map((point) => (
            <Circle
              key={`${point.id}-zone`}
              center={[point.lat, point.lng]}
              radius={point.highlightRadiusMeters as number}
              pathOptions={{
                color: point.risk ? RISK_COLORS[point.risk] : "#ef4444",
                fillColor: point.risk ? RISK_COLORS[point.risk] : "#ef4444",
                fillOpacity: 0.15,
              }}
            />
          ))}
      </MapContainer>
    </div>
  );
}
