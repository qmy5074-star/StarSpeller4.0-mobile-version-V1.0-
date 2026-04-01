# 星际拼写王 (Star Speller V4.0) 🚀

**星际拼写王**是一款专为儿童设计的 AI 驱动拼写学习应用。通过结合 Google Gemini AI 的强大能力与趣味性的游戏化交互，帮助孩子们在轻松愉快的氛围中掌握英语单词。

---

## 🌟 核心特性

- **🤖 AI 智能驱动**: 
  - **动态单词生成**: 使用 `gemini-3-flash-preview` 自动生成音标、翻译、例句及关联词汇。
  - **视觉记忆增强**: 使用 `gemini-2.5-flash-image` 为每个单词生成专属的卡通风格插图。
  - **右至左拼写分块**: 采用独特的“右至左”分析策略，将单词拆分为易于发音和记忆的拼写块。
  - **TTS 语音重拼**: 为每个拼写块生成专门的 TTS 助记发音（如 "ti" -> "tie"），优化语音合成效果。
- **🎮 五步学习法**:
  - **Step 1: 观察 (Observe)** - 视觉化呈现单词结构、图片和翻译。
  - **Step 2: 聆听 (Listen)** - 沉浸式听力训练，熟悉单词韵律。
  - **Step 3: 练习 (Practice)** - 互动式拼写练习，支持即时反馈。
  - **Step 4: 测试 (Test)** - 闭卷挑战，巩固学习成果。
  - **Step 5: 节奏 (Rhythm)** - 在动感的节奏中通过敲击键盘强化肌肉记忆。
- **🎙️ 语音交互**: 集成麦克风功能，支持语音输入，提升听说能力。
- **📊 进度追踪**:
  - **学习统计**: 记录每日学习时长、成功率及最高 BPM。
  - **勋章系统**: 达成里程碑即可获得精美勋章。
  - **单词库**: 随时回顾已学单词，支持按日期筛选和复习。
- **👥 多用户系统**: 
  - 支持创建多个独立用户档案。
  - 默认内置用户 **Eva**，预设了丰富的初始词库。
  - 每个用户的学习进度、统计数据和设置完全隔离。
- **🔒 数据安全与备份**: 
  - **本地存储**: 使用 IndexedDB 进行大规模数据存储，无需联网即可访问已学内容。
  - **数据混淆**: 采用 XOR 加密算法对导出的备份文件进行混淆处理。
  - **导入导出**: 支持将学习记录导出为 JSON 文件，方便跨设备迁移。

---

## 🛠️ 技术栈

- **前端框架**: [React 19](https://react.dev/)
- **构建工具**: [Vite 6](https://vitejs.dev/)
- **编程语言**: [TypeScript](https://www.typescriptlang.org/)
- **样式处理**: [Tailwind CSS](https://tailwindcss.com/)
- **AI 集成**: [Google Gemini API (@google/genai)](https://ai.google.dev/)
- **动画库**: [Motion](https://motion.dev/)
- **字体**: Fredoka (圆润可爱的儿童友好字体)

---

## 🚀 快速开始

### 1. 克隆项目并安装依赖
```bash
npm install
```

### 2. 配置环境变量
在根目录创建 `.env` 文件，并添加你的 Gemini API Key：
```env
GEMINI_API_KEY=你的_API_KEY
```

### 3. 启动开发服务器
```bash
npm run dev
```
访问 `http://localhost:3000` 即可开始星际拼写之旅！

---

## 📂 项目结构

```text
├── components/          # 通用 UI 组件 (导航栏、顶栏、统计卡片等)
├── pages/               # 页面组件 (库页面、统计页面)
├── services/            # 核心业务逻辑
│   ├── audioService.ts  # 音效与节奏控制 (Web Audio API)
│   ├── dbService.ts     # 本地数据库操作 (IndexedDB 封装)
│   ├── geminiService.ts # AI 接口集成 (Prompt 工程与重试机制)
│   └── initialWords.ts  # 预设初始词库
├── src/
│   ├── components/      # 业务逻辑相关组件 (游戏按钮、模态框)
│   └── utils/           # 工具函数 (XOR 加密、JSON 清洗等)
├── App.tsx              # 应用程序主入口及全局状态管理
├── types.ts             # 全局 TypeScript 类型定义
└── index.tsx            # React 渲染入口
```

---

## 📝 开发说明

- **AI 提示词策略**: 单词生成的 Prompt 逻辑位于 `services/geminiService.ts`，采用了严格的 JSON Schema 约束，确保 AI 输出的稳定性。
- **数据库迁移**: `dbService.ts` 包含版本升级逻辑，支持在不丢失旧数据的情况下平滑升级数据库结构。
- **移动端优化**: 针对移动设备进行了 UI 适配，采用 `Fredoka` 字体和高对比度色彩，符合儿童视觉偏好。

---

## 📜 许可证

本项目采用 MIT 许可证。

---

*让拼写不再枯燥，开启你的星际冒险吧！* ✨
