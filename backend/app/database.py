import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# SQLite 数据库文件：默认 backend/ 根目录，可用 DATABASE_DIR 指定（Docker 挂载卷）
_db_dir = os.getenv("DATABASE_DIR")
DB_PATH = Path(_db_dir, "chat.db") if _db_dir else Path(__file__).resolve().parent.parent / "chat.db"
if _db_dir:
    Path(_db_dir).mkdir(parents=True, exist_ok=True)

engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
