from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret: str = Field(min_length=32)
    jwt_expire_minutes: int = 480
    cors_origins: str = "http://localhost:3100"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    app_timezone: str = "America/Mexico_City"
    jornada_inicio: int = 9   # hora local de la primera cita del día
    jornada_fin: int = 17     # hora local en que termina la última cita

    admin_email: str = ""
    admin_password: str = ""
    seed_demo_data: bool = False
    demo_password: str = "Demo1234!"

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def ia_configurada(self) -> bool:
        return bool(self.gemini_api_key) and not self.gemini_api_key.startswith("tu_")


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
