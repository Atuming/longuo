# 火龙果编辑器

一款轻量级的中文小说写作助手，支持 AI 辅助写作、角色管理、世界观构建、时间线管理等功能。

## 快速开始

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:5173` 即可使用。

或者双击 `启动火龙果编辑器.bat` 一键启动。

## AI 配置

编辑 `public/ai-config.json`，填入你的 API Key：

```json
{
  "providers": [
    {
      "id": "default-provider",
      "name": "智谱 GLM",
      "apiKey": "你的 API Key",
      "modelName": "glm-4-flash",
      "apiEndpoint": "https://open.bigmodel.cn/api/paas/v4/chat/completions",
      "timeoutMs": 60000
    }
  ],
  "activeProviderId": "default-provider"
}
```

支持任何 OpenAI 兼容的 API（OpenAI、智谱、DeepSeek、Ollama 等）。

## 打包部署

```bash
npm run build
```

`dist` 目录即为可部署的静态文件，放到任何静态服务器上即可。

## 技术栈

- React 19 + TypeScript
- Vite
- CodeMirror 6（Markdown 编辑器）
- Vitest + fast-check（测试）
