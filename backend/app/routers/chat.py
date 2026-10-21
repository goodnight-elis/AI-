from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app import service
from app.schemas import ChatStreamRequest

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/stream")
async def chat_stream(req: ChatStreamRequest):
    """SSE 流式对话。事件协议：delta / done / error，空闲 15s 发 `: ping` 心跳"""
    return StreamingResponse(
        service.stream_chat(req.conversation_id, req.user_input, req.mode),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # nginx 关闭缓冲，保证逐 token 推送
        },
    )
