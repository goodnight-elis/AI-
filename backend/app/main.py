from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.routers import chat, conversations, prompts_router, providers


def _seed():
    """建表 + 首次启动种子：库为空且 .env 配了 DEFAULT_API_KEY 时自动建一条 Provider"""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        count = db.query(models.ProviderConfig).count()
        if count == 0 and settings.DEFAULT_API_KEY:
            db.add(
                models.ProviderConfig(
                    name=f"{settings.DEFAULT_MODEL} (env seed)",
                    base_url=settings.DEFAULT_BASE_URL,
                    api_key=settings.DEFAULT_API_KEY,
                    model=settings.DEFAULT_MODEL,
                    is_active=True,
                )
            )
            db.commit()
        # 保证有配置时必有一个激活项
        if count > 0 and not db.query(models.ProviderConfig).filter_by(is_active=True).first():
            first = db.query(models.ProviderConfig).order_by(models.ProviderConfig.id).first()
            if first:
                first.is_active = True
                db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _seed()
    yield


app = FastAPI(title="AI Chat Template", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(conversations.router)
app.include_router(providers.router)
app.include_router(prompts_router.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
