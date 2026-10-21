"""内置厂商预设：一键填充 base_url / 默认模型，用户只需粘贴 API Key。
全部为 OpenAI 兼容接口，代码零厂商硬编码。
"""

PROVIDER_PRESETS: list[dict] = [
    {
        "name": "DeepSeek",
        "base_url": "https://api.deepseek.com",
        "default_model": "deepseek-chat",
        "key_hint": "sk-xxxx",
        "doc_url": "https://platform.deepseek.com/api_keys",
    },
    {
        "name": "通义千问",
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "default_model": "qwen-plus",
        "key_hint": "sk-xxxx",
        "doc_url": "https://bailian.console.aliyun.com/#/api-key",
    },
    {
        "name": "Kimi",
        "base_url": "https://api.moonshot.cn/v1",
        "default_model": "moonshot-v1-8k",
        "key_hint": "sk-xxxx",
        "doc_url": "https://platform.moonshot.cn/console/api-keys",
    },
    {
        "name": "智谱 GLM",
        "base_url": "https://open.bigmodel.cn/api/paas/v4",
        "default_model": "glm-4-flash",
        "key_hint": "xxxx.xxxx",
        "doc_url": "https://open.bigmodel.cn/usercenter/apikeys",
    },
    {
        "name": "Ollama (本地)",
        "base_url": "http://localhost:11434/v1",
        "default_model": "qwen2.5",
        "key_hint": "任意非空字符串（如 ollama）",
        "doc_url": "https://ollama.com/library",
    },
]
