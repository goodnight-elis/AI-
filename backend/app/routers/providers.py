from fastapi import APIRouter, Body, Depends, HTTPException
from openai import AsyncOpenAI
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.presets import PROVIDER_PRESETS
from app.schemas import ProviderCreate, ProviderOut, ProviderUpdate

router = APIRouter(prefix="/api/providers", tags=["providers"])


def to_out(p: models.ProviderConfig) -> ProviderOut:
    from app.service import mask_key

    return ProviderOut(
        id=p.id,
        name=p.name,
        base_url=p.base_url,
        api_key_masked=mask_key(p.api_key),
        model=p.model,
        is_active=p.is_active,
        created_at=p.created_at,
    )


@router.get("", response_model=list[ProviderOut])
def list_providers(db: Session = Depends(get_db)):
    return [to_out(p) for p in db.query(models.ProviderConfig).order_by(models.ProviderConfig.id).all()]


@router.get("/presets")
def list_presets():
    """厂商预设列表，前端「一键填充」使用"""
    return PROVIDER_PRESETS


@router.post("", response_model=ProviderOut)
def create_provider(req: ProviderCreate, db: Session = Depends(get_db)):
    count = db.query(models.ProviderConfig).count()
    p = models.ProviderConfig(
        name=req.name,
        base_url=req.base_url.rstrip("/"),
        api_key=req.api_key,
        model=req.model,
        is_active=(count == 0),  # 第一条自动激活
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return to_out(p)


@router.put("/{provider_id}", response_model=ProviderOut)
def update_provider(provider_id: int, req: ProviderUpdate, db: Session = Depends(get_db)):
    p = db.get(models.ProviderConfig, provider_id)
    if p is None:
        raise HTTPException(404, "配置不存在")
    if req.name is not None:
        p.name = req.name
    if req.base_url is not None:
        p.base_url = req.base_url.rstrip("/")
    if req.model is not None:
        p.model = req.model
    # api_key 传掩码串（含 *）或空表示保留原 Key
    if req.api_key is not None and "*" not in req.api_key:
        p.api_key = req.api_key
    db.commit()
    db.refresh(p)
    return to_out(p)


@router.delete("/{provider_id}")
def delete_provider(provider_id: int, db: Session = Depends(get_db)):
    p = db.get(models.ProviderConfig, provider_id)
    if p is None:
        raise HTTPException(404, "配置不存在")
    was_active = p.is_active
    db.delete(p)
    db.commit()
    if was_active:
        from app.service import get_active_provider

        get_active_provider(db)  # 重新指定激活项
    return {"ok": True}


@router.post("/{provider_id}/activate")
def activate_provider(provider_id: int, db: Session = Depends(get_db)):
    p = db.get(models.ProviderConfig, provider_id)
    if p is None:
        raise HTTPException(404, "配置不存在")
    db.query(models.ProviderConfig).update({"is_active": False})
    p.is_active = True
    db.commit()
    return {"ok": True}


@router.post("/test-config")
async def test_config(req: ProviderCreate = Body(...)):
    """用未保存的配置验证连通性（设置弹窗「保存前测试」）"""
    from app.service import map_openai_error

    try:
        client = AsyncOpenAI(base_url=req.base_url, api_key=req.api_key, timeout=30)
        await client.chat.completions.create(
            model=req.model,
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=5,
        )
        return {"ok": True}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, **map_openai_error(exc)}


@router.post("/{provider_id}/test")
async def test_provider(provider_id: int, db: Session = Depends(get_db)):
    """用该配置发一次最小 completion 验证连通性"""
    from app.service import map_openai_error

    p = db.get(models.ProviderConfig, provider_id)
    if p is None:
        raise HTTPException(404, "配置不存在")
    try:
        client = AsyncOpenAI(base_url=p.base_url, api_key=p.api_key, timeout=30)
        await client.chat.completions.create(
            model=p.model,
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=5,
        )
        return {"ok": True}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, **map_openai_error(exc)}
