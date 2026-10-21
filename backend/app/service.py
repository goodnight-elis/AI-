"""核心服务：Provider 管理、上下文组装、SSE 流式对话、标题自动生成、会话导出。"""

import asyncio
import json
from typing import AsyncGenerator, Optional

import openai
from openai import AsyncOpenAI
from sqlalchemy.orm import Session

from . import models
from .database import SessionLocal

# 按字符数估算上下文预算（约等于中文 1 字符 ≈ 1 token），超限从最旧轮次丢弃
MAX_CONTEXT_CHARS = 24000
# SSE 空闲心跳间隔（秒），防止代理/浏览器空闲超时断开
HEARTBEAT_SECONDS = 15


# ---------------------------------------------------------------------------
# Provider 相关
# ---------------------------------------------------------------------------

def mask_key(api_key: str) -> str:
    """列表接口脱敏：仅保留尾 4 位"""
    if not api_key:
        return ""
    if len(api_key) <= 4:
        return "****"
    return "****" + api_key[-4:]


def is_masked(api_key: str) -> bool:
    return (not api_key) or ("*" in api_key)


def get_active_provider(db: Session) -> Optional[models.ProviderConfig]:
    provider = db.query(models.ProviderConfig).filter_by(is_active=True).first()
    if provider is None:
        provider = db.query(models.ProviderConfig).order_by(models.ProviderConfig.id).first()
        if provider is not None:
            provider.is_active = True
            db.commit()
    return provider


def make_client(provider: models.ProviderConfig) -> AsyncOpenAI:
    return AsyncOpenAI(base_url=provider.base_url, api_key=provider.api_key, timeout=120)


# ---------------------------------------------------------------------------
# 错误映射：LLM 调用异常 -> 结构化错误（code + 引导文案）
# ---------------------------------------------------------------------------

def map_openai_error(exc: Exception) -> dict:
    if isinstance(exc, openai.AuthenticationError):
        return {"code": "invalid_key", "message": "API Key 无效或已过期", "hint": "请打开设置检查该厂商的 API Key"}
    if isinstance(exc, openai.RateLimitError):
        return {"code": "rate_limited", "message": "请求过于频繁或已超额", "hint": "请稍后重试，或检查厂商配额"}
    if isinstance(exc, openai.NotFoundError):
        return {"code": "model_not_found", "message": "模型不存在", "hint": "请在设置中检查模型名称是否正确"}
    if isinstance(exc, openai.APIStatusError):
        if exc.status_code == 401:
            return {"code": "invalid_key", "message": "API Key 无效或已过期", "hint": "请打开设置检查该厂商的 API Key"}
        if exc.status_code == 402:
            return {"code": "insufficient_balance", "message": "账户余额不足", "hint": "请前往厂商控制台充值后重试"}
        return {"code": "api_error", "message": f"厂商返回错误 (HTTP {exc.status_code})", "hint": str(exc)}
    if isinstance(exc, openai.APIConnectionError):
        return {"code": "network_error", "message": "无法连接到模型服务商", "hint": "请检查网络，或确认 base_url 可访问（本地 Ollama 需先启动）"}
    return {"code": "unknown_error", "message": "发生未知错误", "hint": str(exc)}


# ---------------------------------------------------------------------------
# SSE 事件格式化
# ---------------------------------------------------------------------------

def sse_event(event: str, payload: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


# ---------------------------------------------------------------------------
# 上下文组装（含截断）
# ---------------------------------------------------------------------------

def build_context(db: Session, conv: models.Conversation) -> tuple[list[dict], int]:
    """返回 (messages, dropped_count)。system prompt 始终保留，超预算时从最旧消息丢弃。"""
    msgs = (
        db.query(models.Message)
        .filter_by(conversation_id=conv.id)
        .order_by(models.Message.id)
        .all()
    )
    pairs = [{"role": m.role, "content": m.content, "id": m.id} for m in msgs if m.role in ("user", "assistant")]

    total = sum(len(p["content"]) for p in pairs)
    start = 0
    while total > MAX_CONTEXT_CHARS and start < len(pairs) - 1:
        total -= len(pairs[start]["content"])
        start += 1
    dropped = start
    pairs = pairs[start:]

    context: list[dict] = []
    if conv.system_prompt:
        context.append({"role": "system", "content": conv.system_prompt})
    context.extend({"role": p["role"], "content": p["content"]} for p in pairs)
    return context, dropped


# ---------------------------------------------------------------------------
# 流式对话（核心）
# ---------------------------------------------------------------------------

async def stream_chat(conversation_id: int, user_input: str, mode: str) -> AsyncGenerator[str, None]:
    """SSE 生成器：delta / done / error 事件 + 心跳。断线时保留已输出内容以便 continue 续答。"""
    db = SessionLocal()
    try:
        conv = db.get(models.Conversation, conversation_id)
        if conv is None:
            yield sse_event("error", {"code": "conversation_not_found", "message": "会话不存在", "hint": "请新建会话"})
            return

        provider = get_active_provider(db)
        if provider is None:
            yield sse_event("error", {"code": "no_provider", "message": "尚未配置模型", "hint": "请打开设置添加 API Key"})
            return

        # ---- 按模式做数据准备 ----
        continue_msg: Optional[models.Message] = None
        if mode == "chat":
            if user_input:
                db.add(models.Message(conversation_id=conv.id, role="user", content=user_input))
                db.commit()
        elif mode == "regenerate":
            last = (
                db.query(models.Message)
                .filter_by(conversation_id=conv.id, role="assistant")
                .order_by(models.Message.id.desc())
                .first()
            )
            if last is not None:
                db.delete(last)
                db.commit()
        elif mode == "continue":
            last = (
                db.query(models.Message)
                .filter_by(conversation_id=conv.id, role="assistant")
                .order_by(models.Message.id.desc())
                .first()
            )
            if last is None or not last.content:
                # 没有半截输出可续，退化为对上一轮用户问题的重新生成
                mode = "regenerate"
            else:
                continue_msg = last

        context, dropped = build_context(db, conv)
        if not any(p["role"] == "user" for p in context):
            yield sse_event("error", {"code": "empty_input", "message": "没有可发送的内容", "hint": "请输入问题后重试"})
            return

        assistant_prefix = continue_msg.content if continue_msg else ""
        if dropped:
            yield sse_event("delta", {"text": "", "notice": f"为保证性能仅携带最近 {len([p for p in context if p['role'] != 'system'])} 条对话"})

        # ---- 后台任务把流数据泵入队列，主循环带超时读取以插入心跳 ----
        queue: asyncio.Queue = asyncio.Queue()

        async def pump():
            try:
                client = make_client(provider)
                stream = await client.chat.completions.create(
                    model=provider.model, messages=context, stream=True
                )
                async for chunk in stream:
                    if not chunk.choices:
                        continue
                    delta = chunk.choices[0].delta.content
                    if delta:
                        await queue.put(("chunk", delta))
                await queue.put(("eof", None))
            except Exception as exc:  # noqa: BLE001 统一转成结构化错误事件
                await queue.put(("error", exc))

        pump_task = asyncio.create_task(pump())
        full_text = ""
        completed = False
        error_payload: Optional[dict] = None
        try:
            while True:
                try:
                    kind, payload = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_SECONDS)
                except asyncio.TimeoutError:
                    yield ": ping\n\n"  # SSE 注释行心跳
                    continue
                if kind == "chunk":
                    full_text += payload
                    yield sse_event("delta", {"text": payload})
                elif kind == "error":
                    error_payload = map_openai_error(payload)
                    break
                else:  # eof
                    completed = True
                    break
        finally:
            pump_task.cancel()
            # 无论正常结束还是客户端断线，都把已输出内容落库（continue 模式追加到原消息）
            if full_text:
                if continue_msg is not None:
                    continue_msg.content += full_text
                else:
                    db.add(models.Message(conversation_id=conv.id, role="assistant", content=full_text))
                db.commit()

        if error_payload is not None:
            yield sse_event("error", error_payload)
            return

        # 续答模式下若本次没有新内容，也视为完成
        # 首轮对话完成后自动生成标题：必须在 done 之前调度，
        # 因为客户端收到 done 后可能立即断开，导致 yield 之后的代码不执行
        user_count = db.query(models.Message).filter_by(conversation_id=conv.id, role="user").count()
        if not conv.title and user_count <= 1:
            asyncio.create_task(generate_title(conv.id))

        yield sse_event("done", {"conversation_id": conv.id, "content": assistant_prefix + full_text, "completed": completed})
    finally:
        db.close()


async def generate_title(conversation_id: int) -> None:
    """用当前激活模型总结一句 10 字内标题；失败则退回首条用户消息前 20 字。"""
    db = SessionLocal()
    try:
        conv = db.get(models.Conversation, conversation_id)
        if conv is None or conv.title:
            return
        first_user = (
            db.query(models.Message)
            .filter_by(conversation_id=conv.id, role="user")
            .order_by(models.Message.id)
            .first()
        )
        provider = get_active_provider(db)
        title = ""
        if provider is not None and first_user is not None:
            try:
                client = make_client(provider)
                resp = await client.chat.completions.create(
                    model=provider.model,
                    messages=[{
                        "role": "user",
                        "content": (
                            "把以下对话总结为一个不超过 10 个字的中文标题，只输出标题本身，不要引号。\n"
                            f"用户: {first_user.content[:200]}"
                        ),
                    }],
                    max_tokens=30,
                    timeout=30,
                )
                title = (resp.choices[0].message.content or "").strip().strip("\"'《》")
            except Exception:  # noqa: BLE001
                title = ""
        if not title and first_user is not None:
            title = first_user.content[:20]
        if title:
            conv.title = title[:100]
            db.commit()
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 会话导出 Markdown
# ---------------------------------------------------------------------------

def export_markdown(db: Session, conv: models.Conversation) -> str:
    role_names = {"user": "用户", "assistant": "助手", "system": "系统"}
    lines = [f"# {conv.title or '新会话'}", ""]
    if conv.system_prompt:
        lines += ["> 角色设定：" + conv.system_prompt.replace("\n", " "), ""]
    for m in conv.messages:
        lines.append(f"**{role_names.get(m.role, m.role)}**：")
        lines.append("")
        lines.append(m.content)
        lines.append("")
    return "\n".join(lines)
