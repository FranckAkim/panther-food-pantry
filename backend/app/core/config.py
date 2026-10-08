"""Application settings, read from environment variables (see .env.example)."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Panther Food Pantry"
    database_url: str = "postgresql+psycopg://pantry:pantry@localhost:5432/pantry"
    # Folder holding the built React app (frontend/dist). Served at "/" so the
    # app and the API share one origin (Option B in docs/architecture).
    static_dir: str = "static"


settings = Settings()
