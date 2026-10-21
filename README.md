# AI 对话助手（AI Chat Template）

开箱即用的 AI 对话模板项目：会话管理、SSE 流式输出、断网自动续答、多厂商模型/密钥一键切换。
前后端分离，全部基于 OpenAI 兼容接口，代码零厂商硬编码。

> 项目截图占位：`docs/screenshot.png`

## 特性

- **流式对话**：SSE 逐 token 输出，Markdown + 代码高亮渲染，代码块一键复制
- **断网重连**：流式中断自动指数退避重连（最多 3 次），重连后从断点续答；手动「继续生成」兜底
- **模型/密钥管理**：多套 Provider 配置存数据库，顶栏一键切换；内置 DeepSeek / 通义 / Kimi / 智谱 / Ollama 厂商预设一键填充，保存前可测连通性，列表 Key 脱敏
- **角色预设**：新建会话可选翻译官、编程助手等 8 个内置 System Prompt 角色
- **对话体验**：重新生成、复制消息、编辑重发、会话搜索、LLM 自动总结会话标题、导出 Markdown
- **工程化**：深色模式、一键启动脚本、Docker Compose 部署、上下文超长自动截断

## 技术栈

| 层 | 选型 |
|---|---|
| 后端 | Python 3.11+ / FastAPI / SQLAlchemy / SQLite |
| 前端 | React 18 + Vite + TypeScript + Tailwind CSS v4 + Zustand |
| LLM | OpenAI 兼容接口（DeepSeek / 通义 / Kimi / 智谱 / Ollama 任意切换） |

## 目录结构

```
backend/    # FastAPI 服务（SSE 流式、会话/模型配置 API）
frontend/   # React + Vite 聊天界面
```

## 快速开始（本地开发）

环境要求：Python 3.11+、Node.js 18+

```bash
# 1. 安装依赖（首次）
npm run setup

# 2. 一键启动前后端（backend:8000 + frontend:5173）
npm run dev
```

打开 http://localhost:5173 ，点击右上角「⚙ 设置」添加模型配置即可开始对话。

也可分别启动：

```bash
cd backend && .venv/Scripts/python -m uvicorn app.main:app --reload --port 8000   # Windows
cd backend && .venv/bin/python -m uvicorn app.main:app --reload --port 8000       # Linux/macOS
cd frontend && npm run dev
```

## Docker 部署

```bash
docker compose up -d --build
# 访问 http://localhost:3000
```

## 厂商 API Key 获取指引

| 厂商 | Base URL | Key 获取 | 说明 |
|---|---|---|---|
| DeepSeek | `https://api.deepseek.com` | [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys) | 便宜、国内直连，推荐入门 |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | [百炼控制台](https://bailian.console.aliyun.com/#/api-key) | 新用户有免费额度 |
| Kimi | `https://api.moonshot.cn/v1` | [platform.moonshot.cn](https://platform.moonshot.cn/console/api-keys) | 有免费额度 |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | [open.bigmodel.cn](https://open.bigmodel.cn/usercenter/apikeys) | glm-4-flash 免费 |
| Ollama | `http://localhost:11434/v1` | 无需申请，Key 填 `ollama` 占位 | 本地免费运行，先 `ollama pull qwen2.5` |

> `backend/.env` 中的 `DEFAULT_*` 仅作为首次启动的种子配置；运行时切换模型/Key 全部在前端设置弹窗操作，不依赖 .env。

## 安全说明

- 本项目默认**无鉴权**，API Key 明文存储于本地 SQLite（`backend/chat.db`），仅适合本地使用
- 对外部署前必须自行添加用户登录/鉴权，并将数据库放到安全位置
- 会话列表等接口返回的 Key 已做脱敏（仅尾 4 位）

## 后续可叠加能力（Roadmap）

- RAG 知识库问答（向量库 chromadb）
- Agent 工具调用 / 多模态图片输入
- 用户登录体系与多用户隔离
