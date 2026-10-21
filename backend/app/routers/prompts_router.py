from fastapi import APIRouter

from app.prompts import PERSONAS
from app.schemas import PersonaOut

router = APIRouter(prefix="/api/prompts", tags=["prompts"])


@router.get("", response_model=list[PersonaOut])
def list_personas():
    return PERSONAS
