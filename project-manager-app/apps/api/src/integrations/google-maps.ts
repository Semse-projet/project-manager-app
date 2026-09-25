import { Logger } from "@nestjs/common";

const logger = new Logger("GoogleMapsIntegration");

type GoogleGeocodeResponse = {
  results?: Array<{
    placeId?: string;
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
  }>;
};

export type GeocodeResult = {
  formattedAddress: string;
  placeId?: string;
  latitude?: number;
  longitude?: number;
};

function mapsApiKey(): string | null {
  return process.env.SEMSE_GOOGLE_MAPS_API_KEY?.trim()
    || process.env.GOOGLE_MAPS_API_KEY?.trim()
    || null;
}

export function isGoogleMapsConfigured(): boolean {
  return mapsApiKey() !== null;
}

async function readGoogleError(response: Response): Promise<string> {
  try {
    const payload = await response.json() as { error?: { message?: string } };
    return payload.error?.message?.trim() || `Google Maps request failed with ${response.status}`;
  } catch {
    return `Google Maps request failed with ${response.status}`;
  }
}

async function googleFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const key = mapsApiKey();
  if (!key) {
    throw new Error("Google Maps API key is not configured");
  }

  const response = await fetch(input, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(await readGoogleError(response));
  }

  return response.json() as Promise<T>;
}

/**
 * Geocodes an address, never throwing — callers use this to opportunistically
 * populate lat/lng on Job/FreeProject creation and must never block on it.
 */
export async function geocodeAddressSafe(address: string | undefined | null): Promise<GeocodeResult | null> {
  const trimmed = address?.trim();
  if (!trimmed || !isGoogleMapsConfigured()) {
    return null;
  }

  try {
    const payload = await googleFetch<GoogleGeocodeResponse>(
      `https://geocode.googleapis.com/v4/geocode/address/${encodeURIComponent(trimmed)}`,
      {
        method: "GET",
        headers: {
          "X-Goog-FieldMask": [
            "results.placeId",
            "results.formattedAddress",
            "results.location",
          ].join(","),
        },
      }
    );

    const first = payload.results?.[0];
    if (!first?.location) {
      return null;
    }

    return {
      formattedAddress: String(first.formattedAddress ?? trimmed),
      placeId: typeof first.placeId === "string" ? first.placeId : undefined,
      latitude: typeof first.location.latitude === "number" ? first.location.latitude : undefined,
      longitude: typeof first.location.longitude === "number" ? first.location.longitude : undefined,
    };
  } catch (error) {
    logger.warn(`Geocoding failed for "${trimmed}": ${(error as Error).message}`);
    return null;
  }
}
