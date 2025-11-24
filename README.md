# 兴趣教练助手

兴趣教练助手是一款基于Modern.js实现的对话应用，通过集成火山引擎模型，为用户提供个性化的兴趣指导。用户可以与AI兴趣教练进行自然语言对话，获取专业的建议和支持。

## 项目结构

```
├── api/                    # BFF API目录
│   └── lambda/             # 服务端函数
│       ├── chat.ts         # 聊天API实现
│       ├── mongodb/        # MongoDB数据库相关
│       │   ├── config.ts   # 数据库配置
│       │   └── conversationService.ts # 对话数据服务
│       ├── tavilyClient.ts # Tavily搜索客户端
│       └── volcanoClient.ts # 火山引擎客户端
├── src/                    # 前端源码
│   ├── routes/             # 路由和页面组件
│   │   ├── index.css       # 样式文件
│   │   ├── layout.tsx      # 布局组件
│   │   └── page.tsx        # 主聊天页面
│   ├── modern-app-env.d.ts # 环境类型定义
│   └── modern.runtime.ts   # 运行时配置
├── package.json            # 项目依赖和脚本
├── modern.config.ts        # Modern.js配置
└── tsconfig.json           # TypeScript配置
```

## 技术栈

- **前端框架**: React 18.3.1
- **构建工具**: Modern.js 2.69.0
- **后端集成**: Modern.js BFF (Backend For Frontend)
- **类型系统**: TypeScript 5.7.3
- **代码规范**: Biome 1.9.4
- **API集成**: 火山引擎AI模型, Tavily搜索API
- **数据存储**: localStorage 和 MongoDB 7.0.0
- **搜索功能**: Tavily 1.0.2

## 实现功能

### 1. 智能对话系统
- 基于火山引擎模型的AI对话能力
- 兴趣目标设定和指导
- 上下文感知的多轮对话
- 基于Tavily的联网搜索功能，支持获取最新信息

### 2. 用户体验优化
- 打字机效果，提供流畅的响应体验
- 消息自动滚动到底部
- 响应式设计支持
- 初始页面与新对话页面的欢迎界面差异化显示，提升用户引导效果

### 3. 数据存储管理
- 本地存储：聊天历史持久化到localStorage
- 云端存储：通过MongoDB实现对话数据的持久化
- 最大消息数量限制（50条）
- 聊天历史清除和管理功能

### 4. 错误处理机制
- API调用错误捕获
- 用户友好的错误提示
- 输入验证
- 搜索功能错误处理

## 如何启动

### 前置要求
- Node.js >= 16.18.1
- pnpm包管理器

### 安装依赖

```bash
pnpm install
```

### 启动开发服务器

```bash
pnpm dev
```

服务器启动后，可以通过 http://localhost:8080 访问应用。

### 构建生产版本

```bash
pnpm build
```

### 本地预览生产版本

```bash
pnpm serve
```

## 项目难点

### 1. 前端状态管理和UI协调
- 确保打字机效果与消息流的平滑过渡
- 管理复杂的异步消息流状态

### 2. 流式响应处理
- 实现了从服务器到客户端的流式数据传输
- 前端逐字符渲染，提供良好的用户体验
- 处理异步生成器和响应队列

### 3. 数据存储管理
- 本地存储优化：防止存储空间过大，处理序列化和反序列化错误
- MongoDB集成：实现对话数据的云端持久化
- 数据安全：实现消息历史的安全清理机制
