CREATE TABLE "Party" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "Party_normalizedName_key" ON "Party"("normalizedName");
CREATE INDEX "Party_name_idx" ON "Party"("name");

INSERT INTO "Party" ("id", "name", "normalizedName", "createdAt", "updatedAt")
SELECT
    'party_' || lower(hex(randomblob(16))),
    MIN("party"),
    lower(trim("party")),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT "party" FROM "WarrantyInEntry"
    UNION ALL
    SELECT "party" FROM "WarrantyOutEntry"
    UNION ALL
    SELECT "party" FROM "PendingWarrantyEntry"
)
WHERE trim("party") <> ''
GROUP BY lower(trim("party"));
