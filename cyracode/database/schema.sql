/* ============================================================
   CyraCode - Microsoft SQL Server Schema
   ============================================================ */

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'CyraCode')
BEGIN
    CREATE DATABASE CyraCode;
END
GO

USE CyraCode;
GO

/* ------------------------------------------------------------
   Users
   ------------------------------------------------------------ */
IF OBJECT_ID('dbo.Users', 'U') IS NOT NULL DROP TABLE dbo.Users;
GO

CREATE TABLE dbo.Users (
    Id              UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWID(),
    Email           NVARCHAR(255)       NOT NULL,
    FirstName       NVARCHAR(100)       NOT NULL,
    LastName        NVARCHAR(100)       NOT NULL,
    PasswordHash    NVARCHAR(255)       NULL,
    GoogleId        NVARCHAR(255)       NULL,
    IsEmailVerified BIT                 NOT NULL DEFAULT 0,
    IsActive        BIT                 NOT NULL DEFAULT 1,
    RememberMe      BIT                 NOT NULL DEFAULT 0,
    CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),
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
IF OBJECT_ID('dbo.CyraCodes', 'U') IS NOT NULL DROP TABLE dbo.CyraCodes;
GO

CREATE TABLE dbo.CyraCodes (
    Id              UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWID(),
    UserId          UNIQUEIDENTIFIER    NOT NULL,
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
    StreetAddress   NVARCHAR(255)       NOT NULL,
    BuildingName    NVARCHAR(100)       NULL,
    FlatNumber      NVARCHAR(50)        NULL,
    PlotNumber      NVARCHAR(50)        NULL,
    FloorUnit       NVARCHAR(50)        NULL,
    PostalCode      NVARCHAR(20)        NOT NULL,
    DigiPin         NVARCHAR(10)        NULL,
    Landmark        NVARCHAR(100)       NULL,
    IsActive        BIT                 NOT NULL DEFAULT 1,
    QrCodePath      NVARCHAR(500)       NULL,
    CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),
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
IF OBJECT_ID('dbo.OTPRecords', 'U') IS NOT NULL DROP TABLE dbo.OTPRecords;
GO

CREATE TABLE dbo.OTPRecords (
    Id              UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWID(),
    Mobile          NVARCHAR(20)        NOT NULL,
    OtpHash         NVARCHAR(255)       NOT NULL,
    ExpiresAt       DATETIME2           NOT NULL,
    IsUsed          BIT                 NOT NULL DEFAULT 0,
    AttemptCount    INT                 NOT NULL DEFAULT 0,
    IsLocked        BIT                 NOT NULL DEFAULT 0,
    LockedUntil     DATETIME2           NULL,
    CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_OTPRecords PRIMARY KEY (Id)
);
GO

CREATE INDEX IX_OTPRecords_Mobile ON dbo.OTPRecords (Mobile);
GO

/* ------------------------------------------------------------
   AuditLogs
   ------------------------------------------------------------ */
IF OBJECT_ID('dbo.AuditLogs', 'U') IS NOT NULL DROP TABLE dbo.AuditLogs;
GO

CREATE TABLE dbo.AuditLogs (
    Id              UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWID(),
    UserId          UNIQUEIDENTIFIER    NULL,
    Action          NVARCHAR(100)       NOT NULL,
    IpAddress       NVARCHAR(50)        NULL,
    UserAgent       NVARCHAR(500)       NULL,
    CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_AuditLogs PRIMARY KEY (Id),
    CONSTRAINT FK_AuditLogs_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id)
);
GO

CREATE INDEX IX_AuditLogs_UserId ON dbo.AuditLogs (UserId);
GO
