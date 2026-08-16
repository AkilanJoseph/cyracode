/* ============================================================
   CyraCode - PostgreSQL Schema
   Mirrors the SQLAlchemy models in backend/app/models/models.py.
   Column names are quoted because the ORM uses PascalCase
   identifiers ("Id", "Email", ...).
   ============================================================ */

CREATE TABLE "Users" (
    "Id"             VARCHAR(36)     NOT NULL,
    "Email"          VARCHAR(255)    NOT NULL,
    "FirstName"      VARCHAR(100)    NOT NULL,
    "LastName"       VARCHAR(100)    NOT NULL,
    "PasswordHash"   VARCHAR(255),
    "GoogleId"       VARCHAR(255),
    "IsEmailVerified" BOOLEAN        NOT NULL DEFAULT FALSE,
    "IsActive"       BOOLEAN         NOT NULL DEFAULT TRUE,
    "RememberMe"     BOOLEAN         NOT NULL DEFAULT FALSE,
    "GdprConsent"    BOOLEAN         NOT NULL DEFAULT FALSE,
    "CreatedAt"      TIMESTAMP,
    "UpdatedAt"      TIMESTAMP,
    CONSTRAINT "PK_Users" PRIMARY KEY ("Id"),
    CONSTRAINT "UQ_Users_Email" UNIQUE ("Email"),
    CONSTRAINT "UQ_Users_GoogleId" UNIQUE ("GoogleId")
);

CREATE INDEX "IX_Users_Email" ON "Users" ("Email");

CREATE TABLE "CyraCodes" (
    "Id"             VARCHAR(36)     NOT NULL,
    "UserId"         VARCHAR(36)     NOT NULL,
    "CodeName"       VARCHAR(50)     NOT NULL,
    "CodeType"       VARCHAR(20)     NOT NULL,
    "Latitude"       NUMERIC(10, 7)  NOT NULL,
    "Longitude"      NUMERIC(10, 7)  NOT NULL,
    "Country"        VARCHAR(100)    NOT NULL,
    "CountryCode"    VARCHAR(10)     NOT NULL,
    "State"          VARCHAR(100),
    "District"       VARCHAR(100),
    "City"           VARCHAR(100),
    "Area"           VARCHAR(100),
    "Town"           VARCHAR(100),
    "RoadName"       VARCHAR(100),
    "StreetAddress"  VARCHAR(255)    NOT NULL,
    "BuildingName"   VARCHAR(100),
    "FlatNumber"     VARCHAR(50),
    "PlotNumber"     VARCHAR(50),
    "FloorUnit"      VARCHAR(50),
    "PostalCode"     VARCHAR(20)     NOT NULL,
    "DigiPin"        VARCHAR(10),
    "Landmark"       VARCHAR(100),
    "IsActive"       BOOLEAN         NOT NULL DEFAULT TRUE,
    "QrCodePath"     VARCHAR(500),
    "IsFlagged"      BOOLEAN         NOT NULL DEFAULT FALSE,
    "FlagReason"     VARCHAR(255),
    "CreatedAt"      TIMESTAMP,
    "UpdatedAt"      TIMESTAMP,
    CONSTRAINT "PK_CyraCodes" PRIMARY KEY ("Id"),
    CONSTRAINT "UQ_CyraCodes_CodeName" UNIQUE ("CodeName"),
    CONSTRAINT "FK_CyraCodes_Users" FOREIGN KEY ("UserId")
        REFERENCES "Users" ("Id")
);

/* AC 6.8: covering index for search_by_name (CodeName prefix + IsActive). */
CREATE INDEX "IX_CyraCodes_Search"
    ON "CyraCodes" ("CodeName", "IsActive")
    INCLUDE ("CodeType", "Latitude", "Longitude", "Country", "CountryCode",
             "City", "StreetAddress", "PostalCode");

/* AC 6.8: covering index for autocomplete prefix scans (ILIKE 'q%'). */
CREATE INDEX "IX_CyraCodes_Autocomplete"
    ON "CyraCodes" ("CodeName", "IsActive")
    INCLUDE ("StreetAddress", "City", "Country", "Latitude", "Longitude");

CREATE INDEX "IX_CyraCodes_LatLng" ON "CyraCodes" ("Latitude", "Longitude");

CREATE TABLE "OTPRecords" (
    "Id"            VARCHAR(36)     NOT NULL,
    "Mobile"        VARCHAR(20)     NOT NULL,
    "OtpHash"       VARCHAR(255)    NOT NULL,
    "ExpiresAt"     TIMESTAMP       NOT NULL,
    "IsUsed"        BOOLEAN         NOT NULL DEFAULT FALSE,
    "AttemptCount"  INTEGER         NOT NULL DEFAULT 0,
    "IsLocked"      BOOLEAN         NOT NULL DEFAULT FALSE,
    "LockedUntil"   TIMESTAMP,
    "VerifiedAt"    TIMESTAMP,
    "CreatedAt"     TIMESTAMP,
    CONSTRAINT "PK_OTPRecords" PRIMARY KEY ("Id")
);

CREATE INDEX "IX_OTPRecords_Mobile" ON "OTPRecords" ("Mobile");

CREATE TABLE "IdempotencyKeys" (
    "Id"            VARCHAR(36)     NOT NULL,
    "Key"           VARCHAR(128)    NOT NULL,
    "Endpoint"      VARCHAR(100)    NOT NULL,
    "ResponseJson"  TEXT,
    "CreatedAt"     TIMESTAMP,
    "ExpiresAt"     TIMESTAMP       NOT NULL,
    CONSTRAINT "PK_IdempotencyKeys" PRIMARY KEY ("Id"),
    CONSTRAINT "UQ_IdempotencyKeys_Key" UNIQUE ("Key")
);

CREATE INDEX "IX_IdempotencyKeys_Key" ON "IdempotencyKeys" ("Key");

CREATE TABLE "AuditLogs" (
    "Id"            VARCHAR(36)     NOT NULL,
    "UserId"        VARCHAR(36),
    "Action"        VARCHAR(100)    NOT NULL,
    "IpAddress"     VARCHAR(50),
    "UserAgent"     VARCHAR(500),
    "CreatedAt"     TIMESTAMP,
    CONSTRAINT "PK_AuditLogs" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_AuditLogs_Users" FOREIGN KEY ("UserId")
        REFERENCES "Users" ("Id")
);

CREATE INDEX "IX_AuditLogs_UserId" ON "AuditLogs" ("UserId");

/* AC 6.27: persistent delivery history per tracking ID. */
CREATE TABLE "DeliveryRecords" (
    "Id"            VARCHAR(36)     NOT NULL,
    "CyraCodeId"    VARCHAR(36)     NOT NULL,
    "TrackingId"    VARCHAR(100)    NOT NULL,
    "PartnerKey"    VARCHAR(50),
    "Status"        VARCHAR(50)     NOT NULL,
    "DeliveredAt"   TIMESTAMP,
    "ProofPhoto"    TEXT,
    "CreatedAt"     TIMESTAMP,
    "UpdatedAt"     TIMESTAMP,
    CONSTRAINT "PK_DeliveryRecords" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_DeliveryRecords_CyraCodes" FOREIGN KEY ("CyraCodeId")
        REFERENCES "CyraCodes" ("Id")
);

CREATE INDEX "IX_DeliveryRecords_TrackingId" ON "DeliveryRecords" ("TrackingId");

/* AC 6.26: audit log for all logistics API access. */
CREATE TABLE "LogisticsAccessLogs" (
    "Id"               VARCHAR(36)     NOT NULL,
    "PartnerKey"       VARCHAR(50),
    "Endpoint"         VARCHAR(200)    NOT NULL,
    "Method"           VARCHAR(10)     NOT NULL,
    "IpAddress"        VARCHAR(50),
    "StatusCode"       INTEGER,
    "ResponseTimeMs"   INTEGER,
    "CreatedAt"        TIMESTAMP,
    CONSTRAINT "PK_LogisticsAccessLogs" PRIMARY KEY ("Id")
);
