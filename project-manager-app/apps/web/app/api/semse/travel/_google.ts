type GooglePlaceSearchResponse = {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    googleMapsUri?: string;
    rating?: number;
    userRatingCount?: number;
    primaryType?: string;
    location?: { latitude?: number; longitude?: number };
  }>;
};

type GooglePlaceDetailResponse = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  primaryType?: string;
  location?: { latitude?: number; longitude?: number };
};

type GoogleGeocodeResponse = {
  results?: Array<{
    placeId?: string;
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
  }>;
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

export async function searchGoogleLodging(input: {
  query?: string;
  city?: string;
  pageSize?: number;
}) {
  const baseQuery = input.query?.trim() || "hotel";
  const city = input.city?.trim();
  const textQuery = city ? `${baseQuery} en ${city}` : baseQuery;

  const payload = await googleFetch<GooglePlaceSearchResponse>(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "X-Goog-FieldMask": [
          "places.id",
          "places.displayName",
          "places.formattedAddress",
          "places.googleMapsUri",
          "places.rating",
          "places.userRatingCount",
          "places.location",
          "places.primaryType",
        ].join(","),
      },
      body: JSON.stringify({
        textQuery,
        languageCode: "es",
        regionCode: "MX",
        includedType: "lodging",
        pageSize: Math.max(1, Math.min(input.pageSize ?? 5, 10)),
      }),
    }
  );

  return {
    query: textQuery,
    items: (payload.places ?? []).map((place) => ({
      id: String(place.id ?? ""),
      displayName: String(place.displayName?.text ?? "Lugar"),
      formattedAddress: String(place.formattedAddress ?? ""),
      googleMapsUri: typeof place.googleMapsUri === "string" ? place.googleMapsUri : undefined,
      rating: typeof place.rating === "number" ? place.rating : undefined,
      userRatingCount: typeof place.userRatingCount === "number" ? place.userRatingCount : undefined,
      latitude: typeof place.location?.latitude === "number" ? place.location.latitude : undefined,
      longitude: typeof place.location?.longitude === "number" ? place.location.longitude : undefined,
      primaryType: typeof place.primaryType === "string" ? place.primaryType : undefined,
    })).filter((item) => item.id),
  };
}

export async function getGooglePlaceDetail(placeId: string) {
  const payload = await googleFetch<GooglePlaceDetailResponse>(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      method: "GET",
      headers: {
        "X-Goog-FieldMask": [
          "id",
          "displayName",
          "formattedAddress",
          "googleMapsUri",
          "rating",
          "userRatingCount",
          "websiteUri",
          "nationalPhoneNumber",
          "location",
          "primaryType",
        ].join(","),
      },
    }
  );

  if (!payload.id) {
    return null;
  }

  return {
    id: String(payload.id),
    displayName: String(payload.displayName?.text ?? "Lugar"),
    formattedAddress: String(payload.formattedAddress ?? ""),
    googleMapsUri: typeof payload.googleMapsUri === "string" ? payload.googleMapsUri : undefined,
    rating: typeof payload.rating === "number" ? payload.rating : undefined,
    userRatingCount: typeof payload.userRatingCount === "number" ? payload.userRatingCount : undefined,
    websiteUri: typeof payload.websiteUri === "string" ? payload.websiteUri : undefined,
    nationalPhoneNumber: typeof payload.nationalPhoneNumber === "string" ? payload.nationalPhoneNumber : undefined,
    latitude: typeof payload.location?.latitude === "number" ? payload.location.latitude : undefined,
    longitude: typeof payload.location?.longitude === "number" ? payload.location.longitude : undefined,
    primaryType: typeof payload.primaryType === "string" ? payload.primaryType : undefined,
  };
}

export async function geocodeGoogleAddress(address: string) {
  const payload = await googleFetch<GoogleGeocodeResponse>(
    `https://geocode.googleapis.com/v4/geocode/address/${encodeURIComponent(address.trim())}`,
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
  if (!first) {
    return null;
  }

  return {
    formattedAddress: String(first.formattedAddress ?? address),
    placeId: typeof first.placeId === "string" ? first.placeId : undefined,
    latitude: typeof first.location?.latitude === "number" ? first.location.latitude : undefined,
    longitude: typeof first.location?.longitude === "number" ? first.location.longitude : undefined,
  };
}
