-- Travel lodging enrichment for Google Maps / Places integration.

ALTER TABLE "LodgingBooking"
  ADD COLUMN IF NOT EXISTS "placeId" TEXT,
  ADD COLUMN IF NOT EXISTS "googleMapsUri" TEXT,
  ADD COLUMN IF NOT EXISTS "latitude" DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS "longitude" DECIMAL(10, 7);
