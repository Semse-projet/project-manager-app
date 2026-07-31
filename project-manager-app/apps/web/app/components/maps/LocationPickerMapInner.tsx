"use client";

import { useEffect, useRef, useState } from "react";
import { LocateFixed } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";

// Leaflet's default marker icon paths break under webpack/Next bundling —
// self-hosted copies live in public/leaflet/ (see apps/web/public/leaflet).
const markerIcon = new L.Icon({
  iconUrl: "/leaflet/marker-icon.png",
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  shadowUrl: "/leaflet/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const DEFAULT_CENTER: [number, number] = [19.4326, -99.1332]; // CDMX — arbitrary fallback when no coordinate exists yet

type LatLng = { latitude: number; longitude: number };

function ClickToPlace({ onPick }: { onPick: (coords: LatLng) => void }) {
  useMapEvents({
    click(event) {
      onPick({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    },
  });
  return null;
}

export default function LocationPickerMapInner({
  latitude,
  longitude,
  onChange,
  height = 220,
}: {
  latitude?: number | null;
  longitude?: number | null;
  onChange: (coords: LatLng) => void;
  height?: number;
}) {
  const hasCoords = typeof latitude === "number" && typeof longitude === "number";
  const [locating, setLocating] = useState(false);
  const markerRef = useRef<L.Marker | null>(null);

  const center: [number, number] = hasCoords ? [latitude, longitude] : DEFAULT_CENTER;

  function useCurrentLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  }

  return (
    <div style={{ display: "grid", gap: "6px" }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={locating}
          style={{
            display: "inline-flex", alignItems: "center", gap: "5px",
            height: "26px", padding: "0 10px", borderRadius: "8px",
            border: "1px solid var(--border)", background: "var(--bg)",
            color: "var(--muted)", fontSize: "11px", fontWeight: 700,
            cursor: locating ? "not-allowed" : "pointer", opacity: locating ? 0.6 : 1,
          }}
        >
          <LocateFixed size={12} /> {locating ? "Ubicando..." : "Usar mi ubicación"}
        </button>
      </div>
      <div style={{ height, borderRadius: "10px", overflow: "hidden", border: "1px solid var(--border)" }}>
        <MapContainer center={center} zoom={hasCoords ? 15 : 11} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickToPlace onPick={onChange} />
          {hasCoords ? (
            <Marker
              position={center}
              icon={markerIcon}
              draggable
              ref={markerRef}
              eventHandlers={{
                dragend: () => {
                  const marker = markerRef.current;
                  if (!marker) return;
                  const pos = marker.getLatLng();
                  onChange({ latitude: pos.lat, longitude: pos.lng });
                },
              }}
            />
          ) : null}
        </MapContainer>
      </div>
      {hasCoords ? (
        <p style={{ fontSize: "10px", color: "var(--muted)", margin: 0 }}>
          Arrastra el pin o toca el mapa para ajustar ({latitude.toFixed(5)}, {longitude.toFixed(5)})
        </p>
      ) : (
        <p style={{ fontSize: "10px", color: "var(--muted)", margin: 0 }}>
          Toca el mapa para fijar la ubicación, o usa tu ubicación actual.
        </p>
      )}
    </div>
  );
}
