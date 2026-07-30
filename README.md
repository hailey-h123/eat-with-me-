# 🍜 Eat With Me - 今天吃什么？

> 一个帮你和朋友快速决定吃什么的美食推荐应用

## ✨ 功能亮点

- 🎲 **一人食推荐** - 按心情选、探索发现、今日运势三种模式
- 👥 **多人协同决策** - 投票式选餐，智能融合多方口味偏好
- 📍 **基于位置的搜索** - 集成高德地图，精准定位附近餐厅
- 🎯 **智能融合算法** - 当两人想吃不同时，推荐可同时满足的餐厅
- 💝 **预算友好** - 根据人均价格筛选符合预算的餐厅
- 📊 **收藏与偏好学习** - 喜欢/不喜欢反馈，越用越懂你的口味

## 🛠️ 技术栈

- **前端框架**: React 19
- **构建工具**: Vite 6
- **样式方案**: TailwindCSS 3
- **图标库**: Lucide React
- **地图服务**: 高德地图 API
- **多人协同**: Firebase Realtime Database
- **测试框架**: Vitest + React Testing Library
- **代码规范**: ESLint

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 方式一：开箱即用（推荐）

项目已内置默认 API Key，克隆后直接运行即可使用真实数据！

```bash
# 克隆仓库
git clone https://github.com/yourusername/eat-with-me.git

# 进入项目目录
cd eat-with-me

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

> 💡 默认 Key 配置在 `public/config.js`，如需使用自己的 Key，可修改该文件或创建 `.env` 文件。

### 方式二：使用自己的 API Key

如果你想使用自己的 Key（避免共享 Key 的流量限制）：

```bash
# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入你的 API Key
```

或直接修改 `public/config.js`：
```javascript
window.APP_CONFIG = {
  AMAP_KEY: '你的JS API Key',
  AMAP_WEB_KEY: '你的Web服务Key',
};
```

### 方式三：演示模式（完全离线）

如果没有配置任何 Key，项目会自动进入演示模式，使用本地示例数据。

### 其他命令

```bash
# 构建生产版本
npm run build

# 运行测试
npm test

# 预览构建产物
npm run preview
```

### 配置环境变量

1. 复制 `.env.example` 为 `.env`
2. 填入你自己的 API Key：

```bash
cp .env.example .env
```

#### 获取高德地图 API Key

1. 访问 [高德开放平台](https://console.amap.com/dev/key/app)
2. 创建「Web端(JS API)」应用，获取 `VITE_AMAP_KEY`
3. 创建「Web服务」应用，获取 `VITE_AMAP_WEB_KEY`
4. 在 [安全设置](https://console.amap.com/dev/key/security) 配置安全密钥 `VITE_AMAP_SECURITY_CODE`

#### （可选）配置 Firebase 实现多人协同

1. 访问 [Firebase Console](https://console.firebase.google.com/)
2. 创建项目，启用 Realtime Database
3. 在项目设置中获取配置信息
4. 填入 `.env` 文件

## 📖 项目结构

```
eat-with-me/
├── src/
│   ├── components/       # UI 组件
│   │   ├── icons/        # 自定义图标
│   │   ├── HomeView.jsx  # 首页
│   │   ├── ResultCard.jsx    # 推荐卡片
│   │   └── ...
│   ├── services/         # 业务逻辑
│   │   ├── amapService.js        # 高德地图服务
│   │   ├── scoringService.js     # 评分算法
│   │   ├── recommendationService.js  # 推荐引擎
│   │   ├── feedbackService.js    # 反馈学习
│   │   └── ...
│   ├── hooks/            # 自定义 Hooks
│   ├── data/             # 模拟数据
│   ├── __tests__/        # 测试文件
│   └── App.jsx           # 主入口
├── public/               # 静态资源
├── .env.example          # 环境变量模板
├── tailwind.config.js    # Tailwind 配置
├── vite.config.js        # Vite 配置
└── package.json
```

## 🎯 使用指南

### 一人食模式

- **按心情选**：输入一个词（如"麻辣"、"清淡"），AI 为你匹配
- **探索发现**：随机推荐，发现隐藏美食
- **今日运势**：查看今日适合吃什么

### 多人模式

1. 创建房间，邀请朋友加入
2. 每人输入想吃的菜系
3. 系统智能融合偏好，推荐最优选择
4. 支持投票、再次推荐

## 🔧 核心算法

### 评分维度

- 🍽️ **菜系匹配** (34%) - 偏好与餐厅标签的匹配度
- 💰 **预算匹配** (12%) - 是否在预算范围内
- 📏 **距离评分** (22%) - 距离越近分越高
- ⭐ **评分权重** (16%) - 餐厅评分
- 🔥 **热度评分** (8%) - 餐厅受欢迎程度

### 融合检测

系统会检测是否存在同时满足多方偏好的餐厅：
- **完美融合**: 同时命中两个菜系（如"麻辣火锅"）
- **口味融合**: 共享辣度特征（如川菜 × 湘菜）
- **形式融合**: 共享做法特征（如烤肉 × 火锅 → 烤涮一体）

## 📝 开发日志

详细的产品规划和迭代记录请查看 [PRD.md](./PRD.md)

## 🤝 贡献

欢迎贡献代码！请遵循以下步骤：

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 提交 Pull Request

## 📄 开源协议

本项目采用 [MIT License](LICENSE) 开源。

---

## 🌟 致谢

- [高德开放平台](https://console.amap.com/) - 提供地图和 POI 搜索服务
- [React](https://react.dev/) - 前端框架
- [Vite](https://vitejs.dev/) - 构建工具

---

Made with ❤️ for food lovers everywhere
