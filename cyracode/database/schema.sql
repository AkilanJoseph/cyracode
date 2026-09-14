/* ============================================================
   CyraCode - Microsoft SQL Server Schema
   Mirrors the SQLAlchemy models in backend/app/models/models.py.
   Ids are stored as NVARCHAR(36) because the ORM generates
   uuid4 UUIDs as strings (see _uuid() in models.py).
   ============================================================ */

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'CyraCode')
BEGIN
    CREATE DATABASE CyraCode;
END
GO

USE CyraCode;
GO

/* ------------------------------------------------------------
   Re-runnable: drop all tables first, children before parents.
   ------------------------------------------------------------ */
IF OBJECT_ID('dbo.LogisticsAccessLogs', 'U')     IS NOT NULL DROP TABLE dbo.LogisticsAccessLogs;
IF OBJECT_ID('dbo.ClientAccessLogs', 'U')        IS NOT NULL DROP TABLE dbo.ClientAccessLogs;
IF OBJECT_ID('dbo.Transactions', 'U')            IS NOT NULL DROP TABLE dbo.Transactions;
IF OBJECT_ID('dbo.ClientSubscriptions', 'U')     IS NOT NULL DROP TABLE dbo.ClientSubscriptions;
IF OBJECT_ID('dbo.ClientApiPermissions', 'U')    IS NOT NULL DROP TABLE dbo.ClientApiPermissions;
IF OBJECT_ID('dbo.ApiClients', 'U')              IS NOT NULL DROP TABLE dbo.ApiClients;
IF OBJECT_ID('dbo.Plans', 'U')                   IS NOT NULL DROP TABLE dbo.Plans;
IF OBJECT_ID('dbo.DeliveryRecords', 'U')         IS NOT NULL DROP TABLE dbo.DeliveryRecords;
IF OBJECT_ID('dbo.IdempotencyKeys', 'U')         IS NOT NULL DROP TABLE dbo.IdempotencyKeys;
IF OBJECT_ID('dbo.AuditLogs', 'U')               IS NOT NULL DROP TABLE dbo.AuditLogs;
IF OBJECT_ID('dbo.OTPRecords', 'U')              IS NOT NULL DROP TABLE dbo.OTPRecords;
IF OBJECT_ID('dbo.CyraCodes', 'U')               IS NOT NULL DROP TABLE dbo.CyraCodes;
IF OBJECT_ID('dbo.Users', 'U')                   IS NOT NULL DROP TABLE dbo.Users;
GO

/* ------------------------------------------------------------
   Users
   ------------------------------------------------------------ */

CREATE TABLE dbo.Users (
    Id              NVARCHAR(36)        NOT NULL,
    Email           NVARCHAR(255)       NOT NULL,
    FirstName       NVARCHAR(100)       NOT NULL,
    LastName        NVARCHAR(100)       NOT NULL,
    PasswordHash    NVARCHAR(255)       NULL,
    GoogleId        NVARCHAR(255)       NULL,
    IsEmailVerified BIT                 NOT NULL DEFAULT 0,
    IsActive        BIT                 NOT NULL DEFAULT 1,
    IsAdmin         BIT                 NOT NULL DEFAULT 0,  -- Admin/Client RBAC
    RememberMe      BIT                 NOT NULL DEFAULT 0,
    GdprConsent     BIT                 NOT NULL DEFAULT 0,
    CreatedAt       DATETIME2           NOT NULL,
    UpdatedAt       DATETIME2           NOT NULL,
    CONSTRAINT PK_Users PRIMARY KEY (Id),
    CONSTRAINT UQ_Users_Email UNIQUE (Email),
    CONSTRAINT UQ_Users_GoogleId UNIQUE (GoogleId)
);
GO

CREATE INDEX IX_Users_Email ON dbo.Users (Email);
GO

/* ------------------------------------------------------------
   CyraCodes
   ------------------------------------------------------------ */

CREATE TABLE dbo.CyraCodes (
    Id              NVARCHAR(36)        NOT NULL,
    UserId          NVARCHAR(36)        NOT NULL,
    CodeName        NVARCHAR(50)        NOT NULL,
    CodeType        NVARCHAR(20)        NOT NULL,   -- 'traditional' | 'auto_generate'
    Latitude        DECIMAL(10, 7)      NOT NULL,
    Longitude       DECIMAL(10, 7)      NOT NULL,
    Country         NVARCHAR(100)       NOT NULL,
    CountryCode     NVARCHAR(10)        NOT NULL,
    State           NVARCHAR(100)       NULL,
    District        NVARCHAR(100)       NULL,
    City            NVARCHAR(100)       NULL,
    Area            NVARCHAR(100)       NULL,
    Town            NVARCHAR(100)       NULL,
    RoadName        NVARCHAR(100)       NULL,
    AvenueName      NVARCHAR(100)       NULL,
    StreetAddress   NVARCHAR(255)       NOT NULL,
    BuildingName    NVARCHAR(100)       NULL,
    FlatNumber      NVARCHAR(50)        NULL,
    SuiteName       NVARCHAR(50)        NULL,
    PlotNumber      NVARCHAR(50)        NULL,
    FloorUnit       NVARCHAR(50)        NULL,
    PostalCode      NVARCHAR(20)        NOT NULL,
    DigiPin         NVARCHAR(10)        NULL,   -- UI/API name: P.O. Box
    Landmark        NVARCHAR(100)       NULL,
    IsActive        BIT                 NOT NULL DEFAULT 1,
    QrCodePath      NVARCHAR(500)       NULL,
    IsFlagged       BIT                 NOT NULL DEFAULT 0,
    FlagReason      NVARCHAR(255)       NULL,
    CreatedAt       DATETIME2           NOT NULL,
    UpdatedAt       DATETIME2           NOT NULL,
    CONSTRAINT PK_CyraCodes PRIMARY KEY (Id),
    CONSTRAINT UQ_CyraCodes_CodeName UNIQUE (CodeName),
    CONSTRAINT FK_CyraCodes_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id)
);
GO

CREATE UNIQUE INDEX IX_CyraCodes_CodeName ON dbo.CyraCodes (CodeName);
GO

/* AC 6.8: Covering index for the primary search path (search_by_name).
   Includes all columns returned by SearchResult so the engine never touches
   the base table — keeps p99 well under 200 ms against 1 M rows. */
CREATE INDEX IX_CyraCodes_Search
    ON dbo.CyraCodes (CodeName, IsActive)
    INCLUDE (CodeType, Latitude, Longitude, Country, CountryCode,
             City, StreetAddress, PostalCode);
GO

/* AC 6.8: Covering index for autocomplete prefix scans (LIKE 'q%').
   CodeName prefix range-scan + IsActive filter resolved in the index. */
CREATE INDEX IX_CyraCodes_Autocomplete
    ON dbo.CyraCodes (CodeName, IsActive)
    INCLUDE (StreetAddress, City, Country, Latitude, Longitude);
GO

CREATE INDEX IX_CyraCodes_LatLng ON dbo.CyraCodes (Latitude, Longitude);
GO

/* Future upgrade: convert Latitude/Longitude into a GEOGRAPHY column and add a
   SPATIAL INDEX for high-performance radius / nearest-neighbour queries, e.g.:
   ALTER TABLE dbo.CyraCodes ADD GeoLocation GEOGRAPHY;
   CREATE SPATIAL INDEX SIX_CyraCodes_GeoLocation ON dbo.CyraCodes (GeoLocation); */

/* AC 6.8 – Read replicas: enable Always On Availability Groups or Azure SQL
   read-scale replicas and set DB_READ_REPLICA_URL in backend/.env. The app
   automatically routes search/autocomplete queries to the replica endpoint. */

/* ------------------------------------------------------------
   OTPRecords
   ------------------------------------------------------------ */

CREATE TABLE dbo.OTPRecords (
    Id              NVARCHAR(36)        NOT NULL,
    Mobile          NVARCHAR(20)        NOT NULL,
    OtpHash         NVARCHAR(255)       NOT NULL,
    ExpiresAt       DATETIME2           NOT NULL,
    IsUsed          BIT                 NOT NULL DEFAULT 0,
    AttemptCount    INT                 NOT NULL DEFAULT 0,
    IsLocked        BIT                 NOT NULL DEFAULT 0,
    LockedUntil     DATETIME2           NULL,
    VerifiedAt      DATETIME2           NULL,
    CreatedAt       DATETIME2           NOT NULL,
    CONSTRAINT PK_OTPRecords PRIMARY KEY (Id)
);
GO

CREATE INDEX IX_OTPRecords_Mobile ON dbo.OTPRecords (Mobile);
GO

/* ------------------------------------------------------------
   IdempotencyKeys
   ------------------------------------------------------------ */

CREATE TABLE dbo.IdempotencyKeys (
    Id              NVARCHAR(36)        NOT NULL,
    [Key]           NVARCHAR(128)       NOT NULL,
    Endpoint        NVARCHAR(100)       NOT NULL,
    ResponseJson    NVARCHAR(MAX)       NULL,
    CreatedAt       DATETIME2           NOT NULL,
    ExpiresAt       DATETIME2           NOT NULL,
    CONSTRAINT PK_IdempotencyKeys PRIMARY KEY (Id),
    CONSTRAINT UQ_IdempotencyKeys_Key UNIQUE ([Key])
);
GO

CREATE INDEX IX_IdempotencyKeys_Key ON dbo.IdempotencyKeys ([Key]);
GO

/* ------------------------------------------------------------
   AuditLogs
   ------------------------------------------------------------ */

CREATE TABLE dbo.AuditLogs (
    Id              NVARCHAR(36)        NOT NULL,
    UserId          NVARCHAR(36)        NULL,
    Action          NVARCHAR(100)       NOT NULL,
    IpAddress       NVARCHAR(50)        NULL,
    UserAgent       NVARCHAR(500)       NULL,
    CreatedAt       DATETIME2           NOT NULL,
    CONSTRAINT PK_AuditLogs PRIMARY KEY (Id),
    CONSTRAINT FK_AuditLogs_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id)
);
GO

CREATE INDEX IX_AuditLogs_UserId ON dbo.AuditLogs (UserId);
GO

/* ------------------------------------------------------------
   DeliveryRecords  (AC 6.27: persistent delivery history)
   ------------------------------------------------------------ */

CREATE TABLE dbo.DeliveryRecords (
    Id              NVARCHAR(36)        NOT NULL,
    CyraCodeId      NVARCHAR(36)        NOT NULL,
    TrackingId      NVARCHAR(100)       NOT NULL,
    PartnerKey      NVARCHAR(50)        NULL,
    Status          NVARCHAR(50)        NOT NULL,
    DeliveredAt     DATETIME2           NULL,
    ProofPhoto      NVARCHAR(MAX)       NULL,
    CreatedAt       DATETIME2           NOT NULL,
    UpdatedAt       DATETIME2           NOT NULL,
    CONSTRAINT PK_DeliveryRecords PRIMARY KEY (Id),
    CONSTRAINT FK_DeliveryRecords_CyraCodes FOREIGN KEY (CyraCodeId)
        REFERENCES dbo.CyraCodes (Id)
);
GO

CREATE INDEX IX_DeliveryRecords_TrackingId ON dbo.DeliveryRecords (TrackingId);
GO

/* ------------------------------------------------------------
   LogisticsAccessLogs  (AC 6.26: audit log for logistics API access)
   ------------------------------------------------------------ */

CREATE TABLE dbo.LogisticsAccessLogs (
    Id              NVARCHAR(36)        NOT NULL,
    PartnerKey      NVARCHAR(50)        NULL,
    Endpoint        NVARCHAR(200)       NOT NULL,
    Method          NVARCHAR(10)        NOT NULL,
    IpAddress       NVARCHAR(50)        NULL,
    StatusCode      INT                 NULL,
    ResponseTimeMs  INT                 NULL,
    CreatedAt       DATETIME2           NOT NULL,
    CONSTRAINT PK_LogisticsAccessLogs PRIMARY KEY (Id)
);
GO

/* ------------------------------------------------------------
   ApiClients — credentials for the CyraCode Address Lookup API
   ------------------------------------------------------------ */

CREATE TABLE dbo.ApiClients (
    Id              NVARCHAR(36)        NOT NULL,
    Name            NVARCHAR(100)       NOT NULL,
    KeyId           NVARCHAR(64)        NOT NULL,   -- indexed SHA-256 lookup digest
    ApiKeyHash      NVARCHAR(255)       NOT NULL,   -- bcrypt hash (raw key never stored)
    KeyTail         NVARCHAR(4)         NOT NULL,   -- last 4 chars for operator recognition
    ContactEmail    NVARCHAR(255)       NULL,
    IsActive        BIT                 NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2           NOT NULL,
    UpdatedAt       DATETIME2           NOT NULL,
    CONSTRAINT PK_ApiClients PRIMARY KEY (Id),
    CONSTRAINT UQ_ApiClients_KeyId UNIQUE (KeyId)
);
GO

CREATE INDEX IX_ApiClients_KeyId ON dbo.ApiClients (KeyId);
GO

/* ------------------------------------------------------------
   Plans — billable subscription tiers (Basic / Pro / Enterprise)
   ------------------------------------------------------------ */

CREATE TABLE dbo.Plans (
    Id              NVARCHAR(36)        NOT NULL,
    Code            NVARCHAR(20)        NOT NULL,
    Name            NVARCHAR(50)        NOT NULL,
    MonthlyCost     INT                 NOT NULL,
    CreatedAt       DATETIME2           NOT NULL,
    CONSTRAINT PK_Plans PRIMARY KEY (Id),
    CONSTRAINT UQ_Plans_Code UNIQUE (Code)
);
GO

/* ------------------------------------------------------------
   ClientSubscriptions — the client's current plan enrollment
   ------------------------------------------------------------ */

CREATE TABLE dbo.ClientSubscriptions (
    Id              NVARCHAR(36)        NOT NULL,
    ClientId        NVARCHAR(36)        NOT NULL,
    PlanId          NVARCHAR(36)        NULL,
    PlanName        NVARCHAR(50)        NOT NULL,
    MonthlyCost     INT                 NOT NULL,
    StartDate       DATETIME2           NOT NULL,
    EndDate         DATETIME2           NOT NULL,
    Status          NVARCHAR(20)        NOT NULL DEFAULT 'active',
    CreatedAt       DATETIME2           NOT NULL,
    UpdatedAt       DATETIME2           NOT NULL,
    CONSTRAINT PK_ClientSubscriptions PRIMARY KEY (Id),
    CONSTRAINT FK_ClientSubscriptions_ApiClients FOREIGN KEY (ClientId)
        REFERENCES dbo.ApiClients (Id) ON DELETE CASCADE,
    CONSTRAINT FK_ClientSubscriptions_Plans FOREIGN KEY (PlanId)
        REFERENCES dbo.Plans (Id)
);
GO

CREATE INDEX IX_ClientSubscriptions_ClientId ON dbo.ClientSubscriptions (ClientId);
GO
CREATE INDEX IX_ClientSubscriptions_EndDate ON dbo.ClientSubscriptions (EndDate);
GO

/* ------------------------------------------------------------
   Transactions — billing transactions feeding revenue/trends
   ------------------------------------------------------------ */

CREATE TABLE dbo.Transactions (
    Id              NVARCHAR(36)        NOT NULL,
    ClientId        NVARCHAR(36)        NULL,
    ClientName      NVARCHAR(100)       NOT NULL,
    PlanName        NVARCHAR(50)        NOT NULL,
    Amount          INT                 NOT NULL,
    Status          NVARCHAR(20)        NOT NULL DEFAULT 'paid',
    CreatedAt       DATETIME2           NOT NULL,
    CONSTRAINT PK_Transactions PRIMARY KEY (Id),
    CONSTRAINT FK_Transactions_ApiClients FOREIGN KEY (ClientId)
        REFERENCES dbo.ApiClients (Id)
);
GO

CREATE INDEX IX_Transactions_CreatedAt ON dbo.Transactions (CreatedAt);
GO

/* ------------------------------------------------------------
   ClientApiPermissions — configurable API authorization grants.
   Granting/revoking a row here toggles client API access with
   no application code change.
   ------------------------------------------------------------ */

CREATE TABLE dbo.ClientApiPermissions (
    Id              NVARCHAR(36)        NOT NULL,
    ClientId        NVARCHAR(36)        NOT NULL,
    Permission      NVARCHAR(100)       NOT NULL,   -- e.g. 'cyracode.lookup'
    CreatedAt       DATETIME2           NOT NULL,
    CONSTRAINT PK_ClientApiPermissions PRIMARY KEY (Id),
    CONSTRAINT FK_ClientApiPermissions_ApiClients FOREIGN KEY (ClientId)
        REFERENCES dbo.ApiClients (Id) ON DELETE CASCADE
);
GO

CREATE INDEX IX_ClientApiPermissions_ClientId ON dbo.ClientApiPermissions (ClientId);
GO

/* ------------------------------------------------------------
   ClientAccessLogs — audit trail for every Address Lookup API call
   ------------------------------------------------------------ */

CREATE TABLE dbo.ClientAccessLogs (
    Id              NVARCHAR(36)        NOT NULL,
    ClientId        NVARCHAR(36)        NULL,
    ClientName      NVARCHAR(100)       NULL,
    KeyTail         NVARCHAR(4)         NULL,
    Endpoint        NVARCHAR(200)       NOT NULL,
    Method          NVARCHAR(10)        NOT NULL,
    IpAddress       NVARCHAR(50)        NULL,
    StatusCode      INT                 NULL,
    ResponseTimeMs  INT                 NULL,
    CreatedAt       DATETIME2           NOT NULL,
    CONSTRAINT PK_ClientAccessLogs PRIMARY KEY (Id),
    CONSTRAINT FK_ClientAccessLogs_ApiClients FOREIGN KEY (ClientId)
        REFERENCES dbo.ApiClients (Id)
);
GO

CREATE INDEX IX_ClientAccessLogs_ClientId ON dbo.ClientAccessLogs (ClientId);
GO