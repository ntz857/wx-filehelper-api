# OpenClaw + 微信文件助手集成方案

## 架构说明

```
微信服务器 <---> 微信文件助手API <--Webhook--> OpenClaw Channel插件 <---> OpenClaw Gateway
```

## 工作流程（Webhook 实时推送）

### 1. 消息接收流程（实时推送）
1. 用户发送消息到微信文件传输助手
2. 微信API实时推送到OpenClaw插件的webhook (`POST /webhook/wechat`)
3. OpenClaw插件接收消息并转换格式
4. 发送到OpenClaw Gateway处理
5. AI处理后返回响应

### 2. 消息发送流程
1. OpenClaw生成回复
2. 通过channel插件调用 `sendMessage()`
3. 插件调用微信API (`/bot/sendMessage`)
4. 消息发送到微信文件传输助手

## 优势

- ✅ **实时推送**：零延迟，消息即时到达
- ✅ **资源高效**：无需轮询，节省CPU和网络
- ✅ **事件驱动**：符合现代架构设计

## 快速开始

### 步骤1: 启动微信API服务

```bash
cd /Users/ntz/github.com/ntz857/wx-filehelper-api
python main.py
```

访问 http://localhost:23051/webui 扫码登录

### 步骤2: 构建OpenClaw插件

```bash
cd openclaw-plugin
npm install
npm run build
```

### 步骤3: 配置OpenClaw

在OpenClaw配置文件中添加channel:

```json
{
  "channels": {
    "wechat-filehelper": {
      "enabled": true,
      "config": {
        "apiUrl": "http://localhost:23051"
      }
    }
  }
}
```

### 步骤4: 启动OpenClaw

```bash
openclaw start
```

## 配置选项

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| apiUrl | string | - | 微信API地址 |
| webhookPort | number | 3100 | Webhook服务器端口 |
| webhookPath | string | /webhook/wechat | Webhook路径 |

## 故障排查

### 问题1: 无法连接到微信API
- 检查微信API是否运行: `curl http://localhost:23051/`
- 检查是否已登录: `curl http://localhost:23051/login/status`

### 问题2: 收不到消息
- 检查webhook是否配置成功
- 查看OpenClaw日志
- 测试webhook: `curl http://localhost:3100/webhook/wechat`

### 问题3: 发送失败
- 确认登录状态
- 检查API返回: `curl -X POST http://localhost:23051/bot/sendMessage -H "Content-Type: application/json" -d '{"text":"test"}'`
