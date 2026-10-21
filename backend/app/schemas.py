from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


# ---------- Provider ----------

class ProviderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    base_url: str = Field(min_length=1, max_length=300)
    api_key: str = ""
    model: str = Field(min_length=1, max_length=100)


class ProviderUpdate(BaseModel):
    name: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = None  # 传掩码串（含 *）或不传则保留原 Key
    model: Optional[str] = None


class ProviderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    base_url: str
    api_key_masked: str
    model: str
    is_active: bool
    created_at: datetime


class ProviderPreset(BaseModel):
    name: str
    base_url: str
    default_model: str
    key_hint: str
    doc_url: str


# ---------- Conversation / Message ----------

class ConversationCreate(BaseModel):
    title: str = ""
    system_prompt: str = ""


class ConversationUpdate(BaseModel):
    title: Optional[str] = None


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    system_prompt: str
    created_at: datetime


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    conversation_id: int
    role: str
    content: str
    created_at: datetime


class RollbackRequest(BaseModel):
    message_id: int


# ---------- Chat ----------

ChatMode = Literal["chat", "regenerate", "continue"]


class ChatStreamRequest(BaseModel):
    conversation_id: int
    user_input: str = ""
    mode: ChatMode = "chat"


# ---------- Persona ----------

class PersonaOut(BaseModel):
    id: str
    name: str
    description: str
    system_prompt: str
