# 吃什么 · 产品方案 A 设计文档（留存优先 - 轻量改版）

> 版本：v1.0  
> 日期：2026-08-17  
> 状态：待确认

## 一、目标与背景

### 1.1 核心目标（留存优先）
让用户有理由"明天再回来"——除了「我又不知道吃啥了」这个场景，还要通过**沉淀（收藏/足迹）、激励（等级/勋章）、专属感（AI 越用越懂我）**三个抓手提升日常打开率和次日留存。

**非目标**：暂不引入登录系统、不做后端、不做社交关系链（方案 B/C 的内容），所有数据本地存储。

### 1.2 当前问题（改前）
- **入口单一**：首页只有「一人食」「一起聚餐」两张大卡片，像一次性工具，没有"逛一逛"的留存感
- **导航路径深**：收藏夹藏在首页底部一个小按钮，从结果页要退 2 次才能到
- **无时间积累感**：没有展示用户过去的决策，所有交互用后即焚，无法形成使用惯性
- **信息密度低**：Hero 区占了大屏，除了问候语和吉祥物之外没有可消费内容

## 二、全局信息架构（3 Tab 导航）

### 2.1 路由结构

```
改前（线性单链）：
  Home → SoloInput → SoloResults
  Home → GroupInput → GroupResults → Vote
  Home → History

改后（3 Tab 全局导航 + 沉浸式结果页）：
  ┌─ 🏠 首页 HomeView（改版）
  │     └─ 快捷操作 → SoloInput / GroupInput / 探索 / 抽签
  │
  ├─ 📖 足迹 FootprintView（原 HistoryView 重命名+扩展）
  │     ├─ ❤️  收藏子 Tab
  │     ├─ 👣  去过子 Tab（新增）
  │     └─ 🔍  搜索历史子 Tab（原有）
  │
  └─ 👤 我的 ProfileView（新增）
        ├─ 用户等级卡
        ├─ 口味偏好标签
        ├─ 最近决定时间线
        ├─ 成就徽章
        └─ 设置入口

  ★ 结果页（SoloResults / GroupResults / Vote）：
    沉浸模式，隐藏底部 Tab，专注决策。
    返回键：结果页 → 对应输入页 → 首页 Tab 回归
```

### 2.2 Tab 显示规则
| currentView | 显示底部 Tab？ |
|-------------|---------------|
| home / footprint / profile | ✅ 是 |
| solo-input / group-input | ✅ 是（输入页随时可以切 Tab 放弃输入） |
| solo-results / group-results / vote | ❌ 否（结果页沉浸，不要打断） |

### 2.3 刷新恢复
沿用现 `CURRENT_VIEW_KEY`（localStorage），扩展枚举值支持 footprint / profile。刷新时回到当前 Tab，不做子 Tab 恢复（太复杂，YAGNI）。

## 三、首页改版（HomeView 重写）

### 3.1 页面结构（4 层信息流）

```
┌──────────────────────────────────────┐
│ [顶部Header] 望京·阜通  📍定位中    😊│  ← 位置+头像（点击头像→我的Tab）
├──────────────────────────────────────┤
│ [Hero 问候卡 · 渐变背景]              │
│  中午好！你已决定过 12 次吃什么啦 👏   │
│  ┌──────┬──────┬──────┐              │
│  │ 3收藏 │ 28去过 │ 4.5★运势 │       │  ← 3 指标，展示时间积累
│  └──────┴──────┴──────┘              │
├──────────────────────────────────────┤
│ [快捷操作宫格]  1×4                   │
│  🥢一人食  👥多人  🎲随便选  🔮抽签吃 │  ← 4 个核心入口，降低决策门槛
├──────────────────────────────────────┤
│ [附近餐厅推荐 feed]                   │
│  附近餐厅推荐                 换一批↻ │
│  ┌──────────────────────────────┐    │
│  │🌶️ 川味小馆  4.5★  🚶6分 ¥78  │    │  ← 每一家带一个信号标签
│  │     [有不辣选项]              →│    │
│  └──────────────────────────────┘    │
│  ┌──────────────────────────────┐    │
│  │🍲 海底捞    4.8★  🚶9分 ¥110 │    │
│  │     [鸳鸯锅可分]              →│    │
│  └──────────────────────────────┘    │
│  ··· 共 4-5 家                        │
└──────────────────────────────────────┘
         🏠 首页 · 📖足迹 · 👤我的        ← 底部 TabBar
```

### 3.2 各块数据来源

| 区块 | 数据 | 接口/实现 |
|------|------|-----------|
| 位置名 | location.name | 复用 LocationBar |
| 头像 | emoji 池随机（😊/😋/🤩/🍜/🌶️/🍣） | 不需要上传，先随机默认 |
| 收藏数 | feedbackService.getLikes().length | 新增 getter（现有只有 add/remove） |
| 去过数 | historyService.getVisited().length | 新增 visited 记录 |
| 今日运势星数 | drawFortuneCard() 映射 | 复用 fortuneService |
| 快捷操作 | 4 个入口跳转 | 复用 handleSelectSolo/Group/SoloExplore/Fortune |
| 附近餐厅 feed | searchPOI(timeSlotKeywords, 3000, limit=5) | 复用现有 searchPOI + 时间段关键词 |
| 餐厅信号标签 | countSafeSignals + soloFriendly + visited 标记 | 复用 scoringService 现有计算 |

### 3.3 不做的（YAGNI）
- 不做 Feed 无限滚动，固定 4-5 家 + 「换一批」按钮
- 不做分类 Tab（中餐/日料/火锅），后续加
- 不做头像上传，用 emoji 默认池
- 不做收藏/去过异步加载，直接读 localStorage 同步返回

## 四、足迹 Tab（FootprintView）

### 4.1 3 个子 Tab 结构

| 子 Tab | 数据接口 | 点击行为 |
|-------|---------|---------|
| ❤️ 收藏 | feedbackService.getLikes() | 进餐厅详情；右 ❤️ 取消收藏 |
| 👣 去过 | historyService.getVisited() | 进餐厅详情；右表情点击切换 😋🙂😐 |
| 🔍 搜索历史 | historyService.getSearchHistory() | 重新搜索（复用 handleHistoryReselect） |

### 4.2 去过记录的埋点触发
在 **ResultList.jsx** 首次渲染时，把 results 里所有餐厅一次性写入 visited：
```javascript
// 伪代码，真实实现放 useEffect([results])
useEffect(() => {
  results.forEach(r => historyService.addVisited(r, {
    timestamp: Date.now(),
    memberCount: lastIntent.solo ? 1 : (lastMembers?.length || 1),
    timeSlot: getTimeSlot(),
    mood: null,  // 用户后续选
  }));
}, [results]);
```

**为什么用"结果页展示过即算去过"**：
- 不强迫用户主动打卡（门槛低）
- 记录"考虑过的选择"，价值比打卡更高
- 实现简单，不需要用户交互

### 4.3 Visited 记录结构
```javascript
{
  id: string,              // 唯一 ID
  restaurant: Restaurant,  // 完整餐厅对象
  timestamp: number,       // 访问时间戳
  memberCount: number,     // 1=单人，>=2=多人
  timeSlot: string,        // breakfast/morning/lunch/afternoon/dinner/late_night
  mood: 'great' | 'ok' | 'bad' | null,  // 用户后续选的感受
}
```

## 五、我的主页（ProfileView）

### 5.1 页面结构（5 块）

```
┌──────────────────────────────────────┐
│ [用户等级卡 渐变背景]                 │
│  😋 大号头像                          │
│  美食探险家 · Lv.3                   │
│  决定过 12 次吃什么 · 北京·望京        │
│  [████████░░░░] 12/20  Lv.4 老饕      │ ← 进度条
├──────────────────────────────────────┤
│ [我的口味偏好 标签云]                 │
│  [常吃川菜] [人均50-100] [忌口海鲜]   │
│  [步行可达优先] [偶尔吃日料]           │
│  小字：AI 根据收藏/搜索自动生成 · 修改│ ← 点"修改"跳转到偏好编辑器
├──────────────────────────────────────┤
│ [最近的决定 时间线]           全部→   │ ← 点"全部"跳转到足迹-去过 Tab
│  🌶️ 川味小馆  昨天午餐 · 2人同事  😊  │
│  🍲 海底捞    上周六 · 6人聚餐   🤩   │
│  🍜 云海肴    8/10  · 一人食    🙂    │
├──────────────────────────────────────┤
│ [成就徽章 4列宫格]                    │
│  🎯十连决  🌶️辣星人  👥组局王  🏆灰化 │
│  (解锁)   (解锁)   (解锁)   (未解锁) │
├──────────────────────────────────────┤
│ [底部设置项列表]                      │
│  · 联系我们                           │
│  · 清除本地数据                       │
│  · 关于吃什么                         │
└──────────────────────────────────────┘
```

### 5.2 等级体系（纯前端，无后端）

| 等级 | 头衔 | 决定次数阈值 |
|------|------|-------------|
| Lv.1 | 新手 | 0-4 次 |
| Lv.2 | 食客 | 5-9 次 |
| Lv.3 | 品鉴官 | 10-19 次 |
| Lv.4 | 老饕 | 20 次以上 |

进度条 = (当前次数 - 当前等级起点) / (下一等级起点 - 当前等级起点)

决定次数 = `historyService.getDecisionCount()` = 去过 + 收藏 + 历史搜索的去重计数。

### 5.3 口味标签计算规则（纯前端本地统计）

| 标签 | 计算规则 |
|------|---------|
| 常吃 XX | 收藏 + 去过餐厅中，菜系出现频次 Top 1-2，占比 ≥ 25% |
| 人均 XXX | 最近 10 家去过餐厅的价格中位数：<50 / 50-100 / 100-200 / >200 |
| 忌口 XX | 所有 intent.allergies 历史并集 |
| 步行可达优先 | 最近搜索中 distRange=近距 的出现频次 > 50% |
| 偶尔吃 XX | 去过餐厅菜系排名 3-4 名，占比 10-25% |

标签生成逻辑放在新文件 `profileService.js`，不要写在 ProfileView 组件里。

### 5.4 成就徽章（4 个起步）

| 徽章 | 图标 | 解锁条件 |
|------|------|---------|
| 十连决 | 🎯 | 累计决定过 10 次 |
| 辣星人 | 🌶️ | 收藏 + 去过中川菜/湘菜/云贵占比 ≥ 40% |
| 组局王 | 👥 | 多人模式决定过 ≥ 5 次（memberCount ≥ 2） |
| 独行侠 | 🥢 | 单人模式决定过 ≥ 10 次（memberCount = 1） |
| （预留未解锁） | 🏆 | 灰化占位，后续扩展更多徽章 |

解锁判断统一放在 `profileService.js` 的 `computeBadges(visited, likes, searchHistory)`。

## 六、代码改动清单

### 6.1 新文件
| 文件 | 行数估计 | 说明 |
|------|---------|------|
| `src/components/TabBar.jsx` | 80 | 3 Tab 底部导航组件 |
| `src/components/FootprintView.jsx` | 250 | 足迹 3 子 Tab（收藏/去过/搜索历史），逻辑从 HistoryView 迁移 |
| `src/components/ProfileView.jsx` | 350 | 我的主页 5 块内容 |
| `src/services/profileService.js` | 200 | 口味标签计算、等级计算、成就徽章解锁判断 |

### 6.2 重写文件
| 文件 | 说明 |
|------|------|
| `src/components/HomeView.jsx` | 全部重写为新 4 层结构（旧文件可直接删除替换） |

### 6.3 扩展（小改）现有文件
| 文件 | 改动 |
|------|------|
| `src/App.jsx` | 扩展 currentView 枚举（footprint, profile）；TabBar 挂载条件；footprint/profile 路由；visited 写入时机挂载 |
| `src/services/feedbackService.js` | 新增 `getLikes()` / `getDislikes()` 只读 getter（批量返回收藏/踩坑列表） |
| `src/services/historyService.js` | 新增 `addVisited(restaurant, meta)` / `getVisited()` / `getDecisionCount()` 三个接口；保留旧 `addSearchHistory` |
| `src/components/ResultList.jsx` | `useEffect([results])` 时调用 historyService.addVisited 埋点 |
| `src/components/Header.jsx`（可选） | 不强制改。如果不在 HomeView 里重新写顶部栏，就扩展 Header 支持「位置名 + 头像」模式 |

### 6.4 不做/废弃
- `src/components/HistoryView.jsx`：改名为 FootprintView，旧文件逻辑拆分到子 Tab 3 后可以删除

## 七、数据存储（全部 localStorage，无需后端）

沿用现有服务的存储模式：

| 数据 | Key | 服务文件 |
|------|-----|---------|
| 收藏/踩坑 | eatwithme_likes / eatwithme_dislikes | feedbackService.js（已存在） |
| 搜索历史 | eatwithme_search_history | historyService.js（已存在） |
| 去过记录 | eatwithme_visited | historyService.js（新增） |
| 决策次数累计 | eatwithme_decision_count | historyService.js（新增，或从 visited+likes+search 汇总实时算） |
| 当前 Tab | eatwithme_current_view | App.jsx（已存在 CURRNET_VIEW_KEY） |
| 口味画像缓存 | eatwithme_profile_tags | profileService.js（计算后缓存，打开 App 时直接读，减少计算） |
| 成就缓存 | eatwithme_profile_badges | profileService.js（同上） |

**所有 Key 前缀统一用 `eatwithme_` 避免污染。**

## 八、成功指标

| 指标 | 目标 | 说明 |
|------|------|------|
| 次日留存 | +10-15% | 改版前后 7 日均值对比 |
| 人均打开次数 | 从 1.2 → 1.8 次/天 | 足迹 Tab + Feed 流让用户每天多刷几次 |
| 收藏夹平均数量 | 从 0 → 3+ 个 | 改版后一周内人均收藏达到 3 |
| 决定次数累积 | 30 日内 Lv.2 及以上用户 ≥ 30% | 等级体系是否真的有牵引力 |

## 九、风险与兜底

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| Feed 流在 Mock 模式下全是假数据，看起来很傻 | 中 | 中 | Mock 模式下 Feed 只显示 3 家，并加灰色小字「演示数据，接入高德 API 后才是你附近的真实餐厅」（复用现 MOCK_MODE 黄条逻辑） |
| 「去过」自动记录导致列表混乱（用户其实没去过） | 中 | 低 | UI 上不叫「我吃过」叫「🍽️ 看过的餐厅」，文案上留余地；后续可加手动确认开关 |
| 口味标签算法初期不准 | 高 | 低 | 加「手动修改」入口兜底；不准就用默认空标签，不强行显示 |
| Tab 切换丢失已输入的 Solo/Group 内容 | 中 | 高 | 切 Tab 时不清理输入态，只做 view 切换（现有 state 保留，因为 state 存在 App.jsx 的顶层 lastSoloText/lastMembers 里；切回来再进输入页能恢复） |
| 结果页沉浸态 + TabBar 冲突 | 低 | 低 | results/vote 时显式条件渲染 `{showTabBar && <TabBar/>}`，不覆盖也不闪烁 |

## 十、实现顺序建议（按依赖，不一口气全改）

1. **Step 1（基础）**：TabBar + currentView 枚举扩展 + App.jsx 路由调整（先让 3 个 Tab 能切换，空白页也行）
2. **Step 2（最有价值）**：HomeView 重写（快捷宫格 + 3 指标 + Feed 流）—— 这步改完首页观感立刻上一个台阶
3. **Step 3（留存核心）**：HistoryView → FootprintView 迁移；新增 visited 接口 + 去过子 Tab；ResultList 埋点；收藏子 Tab
4. **Step 4（锦上添花）**：ProfileView（等级卡 + 口味标签 + 成就徽章）—— 依赖 Step 3 的数据
5. **Step 5（验证优化）**：跑全量测试 + 埋点检查 + 各种 view 切换场景自测

每 Step 改完都可以单独测试，不阻塞其他 Step。

> 文档版本：v1.0 · 2026-08-17
