from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app import models, service
from app.database import get_db
from app.schemas import (
    ConversationCreate,
    ConversationOut,
    ConversationUpdate,
    MessageOut,
    RollbackRequest,
)

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


@router.get("", response_model=list[ConversationOut])
def list_conversations(db: Session = Depends(get_db)):
    return db.query(models.Conversation).order_by(models.Conversation.id.desc()).all()


@router.post("", response_model=ConversationOut)
def create_conversation(req: ConversationCreate, db: Session = Depends(get_db)):
    conv = models.Conversation(title=req.title, system_prompt=req.system_prompt)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


@router.get("/{conversation_id}", response_model=ConversationOut)
def get_conversation(conversation_id: int, db: Session = Depends(get_db)):
    conv = db.get(models.Conversation, conversation_id)
    if conv is None:
        raise HTTPException(404, "会话不存在")
    return conv


@router.get("/{conversation_id}/messages", response_model=list[MessageOut])
def list_messages(conversation_id: int, db: Session = Depends(get_db)):
    if db.get(models.Conversation, conversation_id) is None:
        raise HTTPException(404, "会话不存在")
    return (
        db.query(models.Message)
        .filter_by(conversation_id=conversation_id)
        .order_by(models.Message.id)
        .all()
    )


@router.put("/{conversation_id}", response_model=ConversationOut)
def rename_conversation(conversation_id: int, req: ConversationUpdate, db: Session = Depends(get_db)):
    conv = db.get(models.Conversation, conversation_id)
    if conv is None:
        raise HTTPException(404, "会话不存在")
    if req.title is not None:
        conv.title = req.title
    db.commit()
    db.refresh(conv)
    return conv


@router.delete("/{conversation_id}")
def delete_conversation(conversation_id: int, db: Session = Depends(get_db)):
    conv = db.get(models.Conversation, conversation_id)
    if conv is None:
        raise HTTPException(404, "会话不存在")
    db.delete(conv)
    db.commit()
    return {"ok": True}


@router.post("/{conversation_id}/rollback")
def rollback(conversation_id: int, req: RollbackRequest, db: Session = Depends(get_db)):
    """删除 message_id 及其之后的所有消息（编辑重发前调用）"""
    deleted = (
        db.query(models.Message)
        .filter(models.Message.conversation_id == conversation_id, models.Message.id >= req.message_id)
        .delete()
    )
    db.commit()
    return {"ok": True, "deleted": deleted}


@router.get("/{conversation_id}/export")
def export_conversation(conversation_id: int, db: Session = Depends(get_db)):
    conv = db.get(models.Conversation, conversation_id)
    if conv is None:
        raise HTTPException(404, "会话不存在")
    content = service.export_markdown(db, conv)
    filename = (conv.title or f"conversation-{conv.id}").replace('"', "")
    return Response(
        content=content,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}.md"},
    )
