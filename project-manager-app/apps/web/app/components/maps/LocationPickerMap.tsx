"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window`/`document` at module load time — must never run during SSR.
const LocationPickerMapInner = dynamic(() => import("./LocationPickerMapInner"), {
  ssr: false,
  loading: () => (
    <div style={{ height: 220, borderRadius: "10px", border: "1px solid var(--border)", display: "grid", placeItems: "center", color: "var(--muted)", fontSize: "12px" }}>
      Cargando mapa...
    </div>
  ),
});

export type LocationPickerCoords = { latitude: number; longitude: number };

export default function LocationPickerMap(props: {
  latitude?: number | null;
  longitude?: number | null;
  onChange: (coords: LocationPickerCoords) => void;
  height?: number;
}) {
  return <LocationPickerMapInner {...props} />;
}
