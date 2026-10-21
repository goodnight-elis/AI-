from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """仅用于读取首次启动的种子配置，运行时模型配置存数据库"""

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parent.parent / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DEFAULT_BASE_URL: str = "https://api.deepseek.com"
    DEFAULT_API_KEY: str = ""
    DEFAULT_MODEL: str = "deepseek-chat"


settings = Settings()
