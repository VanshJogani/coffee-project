from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    turso_database_url: str = ""
    turso_auth_token: str = ""
    database_path: str = "./coffee.db"

    # Auth
    jwt_secret: str = "change-me-to-a-random-32-char-string"
    jwt_access_expiry_minutes: int = 15
    refresh_token_days: int = 7
    bcrypt_rounds: int = 10

    # OAuth2
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/auth/google/callback"
    github_client_id: str = ""
    github_client_secret: str = ""
    github_redirect_uri: str = "http://localhost:8000/api/auth/github/callback"

    # Server
    cors_origin: str = "http://localhost:5173"
    env: str = "development"
    backend_port: int = 8000

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
