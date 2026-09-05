-- Job: geocoded/manual site coordinates
ALTER TABLE "Job"
    ADD COLUMN "latitude" DECIMAL(10,7),
    ADD COLUMN "longitude" DECIMAL(10,7),
    ADD COLUMN "locationSource" TEXT;

-- FreeProject: geocoded/manual site coordinates
ALTER TABLE "FreeProject"
    ADD COLUMN "latitude" DECIMAL(10,7),
    ADD COLUMN "longitude" DECIMAL(10,7),
    ADD COLUMN "locationSource" TEXT;

-- TimeEntry: worker's actual position captured at check-in (start/manual save)
ALTER TABLE "TimeEntry"
    ADD COLUMN "checkInLatitude" DECIMAL(10,7),
    ADD COLUMN "checkInLongitude" DECIMAL(10,7),
    ADD COLUMN "checkInDistanceMeters" INTEGER,
    ADD COLUMN "checkInMethod" TEXT;

-- UserProfile: per-worker proximity check-in preference
ALTER TABLE "UserProfile"
    ADD COLUMN "proximityCheckInMode" TEXT DEFAULT 'ask';
