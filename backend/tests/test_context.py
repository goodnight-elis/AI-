import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models
from app.database import Base
from app.service import MAX_CONTEXT_CHARS, build_context

MARKER = "内容过长已截断"


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()


def make_conv(db, system_prompt=""):
    conv = models.Conversation(title="t", system_prompt=system_prompt)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


def add_msg(db, conv, role, content):
    db.add(models.Message(conversation_id=conv.id, role=role, content=content))
    db.commit()


def non_system(ctx):
    return [m for m in ctx if m["role"] != "system"]


def test_small_history_kept_verbatim(db):
    conv = make_conv(db)
    add_msg(db, conv, "user", "你好")
    add_msg(db, conv, "assistant", "你好，有什么可以帮你？")

    ctx, dropped = build_context(db, conv)

    assert dropped == 0
    assert [m["role"] for m in ctx] == ["user", "assistant"]
    assert ctx[1]["content"] == "你好，有什么可以帮你？"


def test_system_prompt_always_first_and_kept(db):
    conv = make_conv(db, system_prompt="你是一个翻译官")
    for i in range(20):
        add_msg(db, conv, "user", "u" * 3000)
        add_msg(db, conv, "assistant", "a" * 3000)

    ctx, dropped = build_context(db, conv)

    assert ctx[0] == {"role": "system", "content": "你是一个翻译官"}
    assert dropped > 0


def test_truncated_window_never_starts_with_assistant(db):
    """按「轮」丢弃：不能出现 assistant 打头，否则部分厂商会直接报错。"""
    conv = make_conv(db)
    for i in range(20):
        add_msg(db, conv, "user", "问" * 2000)
        add_msg(db, conv, "assistant", "答" * 2000)

    ctx, _ = build_context(db, conv)

    assert non_system(ctx)[0]["role"] == "user"


def test_dropped_count_matches_removed_messages(db):
    conv = make_conv(db)
    for i in range(10):
        add_msg(db, conv, "user", "u" * 4000)
        add_msg(db, conv, "assistant", "a" * 4000)

    ctx, dropped = build_context(db, conv)

    assert dropped % 2 == 0  # 整轮丢弃：user + assistant 成对移除
    assert len(non_system(ctx)) + dropped == 20  # 保留 + 丢弃 = 原始总条数


def test_single_huge_message_is_truncated(db):
    """最后一条本身就超预算时，必须截断，否则请求会被厂商拒绝。"""
    conv = make_conv(db)
    add_msg(db, conv, "user", "x" * (MAX_CONTEXT_CHARS * 2))

    ctx, _ = build_context(db, conv)
    body = non_system(ctx)[0]["content"]

    assert MARKER in body
    assert len(body) <= MAX_CONTEXT_CHARS + len(MARKER) + 10


def test_under_budget_is_not_truncated(db):
    conv = make_conv(db)
    add_msg(db, conv, "user", "x" * 1000)

    ctx, dropped = build_context(db, conv)

    assert dropped == 0
    assert MARKER not in ctx[0]["content"]
