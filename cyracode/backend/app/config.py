from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_URL: str = "mssql+pyodbc://sa:password@localhost/cyracode?driver=ODBC+Driver+17+for+SQL+Server"
    # AC 6.8: Optional read replica for search queries (leave blank to use primary)
    DB_READ_REPLICA_URL: str = ""
    # AC 6.8: Connection pool tuning — supports 1 M concurrent users via replicas
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 3600
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    GOOGLE_MAPS_API_KEY: str = ""
    SMS_GATEWAY_URL: str = ""
    SMS_API_KEY: str = ""
    LOGISTICS_DEMO_API_KEY: str = "logistics-demo-key"
    PARTNER_RATE_LIMIT_PER_MINUTE: int = 100
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    FRONTEND_URL: str = "http://localhost:5173"
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@cyracode.com"
    PASSWORD_RESET_TOKEN_EXPIRE_HOURS: int = 24


settings = Settings()
