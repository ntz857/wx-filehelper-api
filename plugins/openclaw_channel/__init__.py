"""
OpenClaw Channel Plugin for WeChat FileHelper
将微信文件助手接入 OpenClaw 作为一个 channel
"""

import asyncio
import httpx
from typing import Any, Dict, Optional
from plugin_base import (
    on_load,
    on_unload,
    on_message,
    route,
    CommandContext,
    get_bot,
    get_processor,
    get_config,
)

# OpenClaw 配置
OPENCLAW_GATEWAY_URL = "http://localhost:3000"  # OpenClaw Gateway 地址
CHANNEL_ID = "wechat_filehelper"
CHANNEL_NAME = "WeChat FileHelper"

# 全局状态
_openclaw_client: Optional[httpx.AsyncClient] = None
_message_listener_task: Optional[asyncio.Task] = None
_is_running = False


@on_load
async def init_openclaw_channel():
    """初始化 OpenClaw Channel"""
    global _openclaw_client, _message_listener_task, _is_running

    print(f"[OpenClaw Channel] Initializing {CHANNEL_NAME}...")

    # 创建 HTTP 客户端
    _openclaw_client = httpx.AsyncClient(timeout=30.0)

    # 注册 channel 到 OpenClaw
    await register_channel()

    # 启动消息监听任务
    _is_running = True
    _message_listener_task = asyncio.create_task(message_listener_loop())

    print(f"[OpenClaw Channel] {CHANNEL_NAME} initialized successfully")


@on_unload
async def cleanup_openclaw_channel():
    """清理 OpenClaw Channel"""
    global _openclaw_client, _message_listener_task, _is_running

    print(f"[OpenClaw Channel] Shutting down {CHANNEL_NAME}...")

    # 停止监听任务
    _is_running = False
    if _message_listener_task:
        _message_listener_task.cancel()
        try:
            await _message_listener_task
        except asyncio.CancelledError:
            pass

    # 注销 channel
    await unregister_channel()

    # 关闭客户端
    if _openclaw_client:
        await _openclaw_client.aclose()

    print(f"[OpenClaw Channel] {CHANNEL_NAME} shut down")


async def register_channel():
    """向 OpenClaw 注册 channel"""
    try:
        response = await _openclaw_client.post(
            f"{OPENCLAW_GATEWAY_URL}/api/channels/register",
            json={
                "channel_id": CHANNEL_ID,
                "channel_name": CHANNEL_NAME,
                "channel_type": "wechat",
                "capabilities": ["text", "file", "image"],
                "webhook_url": f"http://localhost:{get_config().port}/openclaw/webhook",
            }
        )
        if response.status_code == 200:
            print(f"[OpenClaw Channel] Registered successfully")
        else:
            print(f"[OpenClaw Channel] Registration failed: {response.text}")
    except Exception as e:
        print(f"[OpenClaw Channel] Registration error: {e}")


async def unregister_channel():
    """从 OpenClaw 注销 channel"""
    try:
        await _openclaw_client.post(
            f"{OPENCLAW_GATEWAY_URL}/api/channels/unregister",
            json={"channel_id": CHANNEL_ID}
        )
    except Exception as e:
        print(f"[OpenClaw Channel] Unregister error: {e}")


async def message_listener_loop():
    """监听微信消息并转发到 OpenClaw"""
    processor = get_processor()
    last_update_id = 0

    while _is_running:
        try:
            # 获取新消息
            updates = processor.get_updates(offset=last_update_id, limit=10)

            for update in updates:
                # 转发到 OpenClaw
                await forward_to_openclaw(update)
                last_update_id = max(last_update_id, update.get("update_id", 0) + 1)

            await asyncio.sleep(1)  # 轮询间隔

        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[OpenClaw Channel] Listener error: {e}")
            await asyncio.sleep(5)


async def forward_to_openclaw(update: Dict[str, Any]):
    """将微信消息转发到 OpenClaw"""
    try:
        message = update.get("message", {})

        payload = {
            "channel_id": CHANNEL_ID,
            "message_id": message.get("message_id"),
            "from_user": {
                "id": message.get("from", {}).get("id"),
                "username": message.get("from", {}).get("username", "filehelper"),
            },
            "timestamp": message.get("date"),
            "content": {
                "type": "text" if message.get("text") else "file",
                "text": message.get("text"),
                "file": message.get("document") or message.get("photo"),
            }
        }

        response = await _openclaw_client.post(
            f"{OPENCLAW_GATEWAY_URL}/api/messages/inbound",
            json=payload
        )

        if response.status_code != 200:
            print(f"[OpenClaw Channel] Forward failed: {response.text}")

    except Exception as e:
        print(f"[OpenClaw Channel] Forward error: {e}")


@route("POST", "/openclaw/webhook", tags=["OpenClaw"])
async def openclaw_webhook(
    channel_id: str = "",
    message_id: str = "",
    content: Dict[str, Any] = None,
):
    """接收来自 OpenClaw 的消息"""
    if channel_id != CHANNEL_ID:
        return {"ok": False, "error": "Invalid channel_id"}

    bot = get_bot()
    processor = get_processor()

    try:
        content = content or {}
        msg_type = content.get("type", "text")

        if msg_type == "text":
            # 发送文本消息
            text = content.get("text", "")
            await bot.send_text(text)
            return {"ok": True, "message_id": message_id}

        elif msg_type == "file":
            # 发送文件
            file_path = content.get("file_path")
            if file_path:
                await bot.send_file(file_path)
                return {"ok": True, "message_id": message_id}
            else:
                return {"ok": False, "error": "file_path required"}

        else:
            return {"ok": False, "error": f"Unsupported type: {msg_type}"}

    except Exception as e:
        return {"ok": False, "error": str(e)}


@route("GET", "/openclaw/status", tags=["OpenClaw"])
async def openclaw_status():
    """OpenClaw Channel 状态"""
    bot = get_bot()
    return {
        "channel_id": CHANNEL_ID,
        "channel_name": CHANNEL_NAME,
        "running": _is_running,
        "logged_in": bot.is_logged_in,
        "gateway_url": OPENCLAW_GATEWAY_URL,
    }


@on_message(priority=10, name="openclaw_logger")
async def log_message(ctx: CommandContext) -> Optional[str]:
    """记录所有消息（用于调试）"""
    print(f"[OpenClaw Channel] Message: {ctx.text[:50]}...")
    return None  # 继续处理
