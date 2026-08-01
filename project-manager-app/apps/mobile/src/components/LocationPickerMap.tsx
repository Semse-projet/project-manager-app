import { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

export interface LocationPickerMapProps {
  latitude?: number;
  longitude?: number;
  onChange: (coords: { latitude: number; longitude: number }) => void;
  height?: number;
}

// Mexico City — same fallback center as the web LocationPickerMap.
const DEFAULT_CENTER = { latitude: 19.4326, longitude: -99.1332 };

/**
 * Draggable-pin map for setting a FreeProject's exact site location.
 *
 * Implemented as a WebView running the same Leaflet + OpenStreetMap stack as
 * the web app's picker (apps/web/app/components/maps/LocationPickerMap.tsx) —
 * not a native map view. `react-native-maps` was considered, but on Android
 * it requires a Google Maps API key to even initialize, even when only OSM
 * tiles are rendered via UrlTile — exactly the per-platform key/billing setup
 * this approach avoids on both platforms. If a native map is ever wanted
 * later, this component's props (latitude/longitude/onChange) are the seam
 * to swap the implementation behind; nothing else in the app would change.
 */
export function LocationPickerMap({ latitude, longitude, onChange, height = 260 }: LocationPickerMapProps) {
  const webviewRef = useRef<WebView>(null);
  const hasInitialPin = typeof latitude === "number" && typeof longitude === "number";

  // Built once, at mount, from whatever coords were passed in first — later
  // prop changes are pushed into the already-loaded page via
  // injectJavaScript (see effect below) instead of rebuilding the HTML,
  // which would reload the WebView and flash the map.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => buildMapHtml(hasInitialPin ? { latitude: latitude as number, longitude: longitude as number } : DEFAULT_CENTER, hasInitialPin), []);

  useEffect(() => {
    if (typeof latitude !== "number" || typeof longitude !== "number") return;
    webviewRef.current?.injectJavaScript(`window.setPin && window.setPin(${latitude}, ${longitude}); true;`);
  }, [latitude, longitude]);

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { latitude?: unknown; longitude?: unknown };
      if (typeof data.latitude === "number" && typeof data.longitude === "number") {
        onChange({ latitude: data.latitude, longitude: data.longitude });
      }
    } catch {
      // Malformed message from the page — ignore, the picker just won't update this tap.
    }
  }

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={webviewRef}
        originWhitelist={["*"]}
        source={{ html }}
        onMessage={handleMessage}
        style={styles.webview}
      />
    </View>
  );
}

function buildMapHtml(center: { latitude: number; longitude: number }, hasPin: boolean): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>html, body, #map { height: 100%; margin: 0; padding: 0; }</style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map').setView([${center.latitude}, ${center.longitude}], ${hasPin ? 15 : 11});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    var marker = ${hasPin ? `L.marker([${center.latitude}, ${center.longitude}], { draggable: true })` : "null"};
    if (marker) { marker.addTo(map); attachDragHandler(marker); }

    function attachDragHandler(m) {
      m.on('dragend', function () { post(m.getLatLng()); });
    }

    function post(latlng) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ latitude: latlng.lat, longitude: latlng.lng }));
    }

    function upsertMarker(latlng) {
      if (marker) {
        marker.setLatLng(latlng);
      } else {
        marker = L.marker(latlng, { draggable: true }).addTo(map);
        attachDragHandler(marker);
      }
    }

    map.on('click', function (e) {
      upsertMarker(e.latlng);
      post(e.latlng);
    });

    // Called from React Native (injectJavaScript) when latitude/longitude change
    // externally — e.g. the "usar mi ubicación actual" button. Moves the pin and
    // recenters, but never posts back: the native side already has this value.
    window.setPin = function (lat, lng) {
      var latlng = { lat: lat, lng: lng };
      upsertMarker(latlng);
      map.setView(latlng, Math.max(map.getZoom(), 15));
    };
  </script>
</body>
</html>`;
}

const styles = StyleSheet.create({
  container: { borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "#e5e7eb" },
  webview: { flex: 1 },
});
