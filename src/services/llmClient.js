/**
 * LLM Client — 通用 OpenAI 兼容接口
 * 参考 ChoppedEats: LLM 输出搜索关键词而非固定标签，让 LLM 做语义理解，
 * 关键词交给 Amap API 搜索，结果交给 scoringService 评分排序。
 */
const API_KEY = import.meta.env.VITE_LLM_API_KEY || '';
const API_BASE = import.meta.env.VITE_LLM_API_BASE || 'https://api.deepseek.com';
const MODEL = import.meta.env.VITE_LLM_MODEL || 'deepseek-chat';
const ENABLED = !!API_KEY;

const SYSTEM_PROMPT = `你是餐厅推荐系统的意图解析器。用户会用中英文描述想吃什么，你需要输出两个东西：
1. searchKeywords — 用来调地图API搜餐厅的关键词（高德地图POI搜索，输入什么就返回什么）
2. constraints — 结构化约束条件

## searchKeywords 生成规则
- 不要用抽象形容词（"清淡""重口味""下饭"），要翻译成地图上能搜到的餐厅类型或菜系名
- "清淡" → ["粥","汤面","轻食","日料","粤菜","江浙菜"]
- "暖和/热乎" → ["火锅","汤面","砂锅","麻辣烫","粥"]
- "重口味/下饭" → ["川菜","湘菜","东北菜","烧烤","烤肉"]
- "想吃肉" → ["烤肉","牛排","汉堡","烧烤","韩式烤肉"]
- "甜食/甜的" → ["甜品","蛋糕","奶茶","咖啡","面包"]
- "随便吃点/赶时间" → ["快餐","面馆","饺子","便当","小吃"]
- "吃不动油腻" → ["轻食","沙拉","日料","粤菜","粥","江浙菜"]
- "环境好/安静/约会" → atmostphere设为安静，searchKeywords正常填菜系
- "想尝尝新的/不想吃平常吃的" → 排除常见菜系，填["异国料理","小众","猎奇"]或具体异国菜系名
- 如果用户说了具体菜系名（火锅、川菜、日料等），直接包含它
- 如果用户什么菜系都没说（就"今天吃啥""随便"），填["餐厅"]让搜索引擎兜底
- 最多5个关键词，中英文都可以

## constraints 规则
- allergies: 从以下识别 ["辣","麻辣","香菜","素食","清真","海鲜","坚果","牛奶","减肥","低卡"]
  区分程度: "不太辣/微辣"≠忌口辣，"完全不吃辣/辣过敏"=忌口辣
  "no spicy/halal/vegetarian/vegan" 也对应忌口
- budget: 整数，预算上限(null表示没提)，支持"80以内"→80、"100左右"→预算100+minBudget70、"100以上"→minBudget100
- minBudget: 整数，预算下限(null表示没提)
- atmosphere: "安静"/"热闹"/""

## 输出格式
只输出合法JSON对象，不要markdown代码块，不要解释文字。
{"searchKeywords":["词1","词2"],"allergies":["辣"],"budget":80,"minBudget":null,"atmosphere":""}`;

function parseLLMOutput(content) {
  let json = content.replace(/```json|```/g, '').trim();
  const start = json.indexOf('{');
  const end = json.lastIndexOf('}');
  if (start >= 0 && end > start) json = json.slice(start, end + 1);

  const p = JSON.parse(json);
  return {
    searchKeywords: Array.isArray(p.searchKeywords) ? p.searchKeywords : [],
    allergies: Array.isArray(p.allergies) ? p.allergies : [],
    budget: typeof p.budget === 'number' ? p.budget : (p.budget ? parseInt(p.budget) : null),
    minBudget: typeof p.minBudget === 'number' ? p.minBudget : (p.minBudget ? parseInt(p.minBudget) : null),
    atmosphere: typeof p.atmosphere === 'string' ? p.atmosphere : '',
  };
}

export async function parseWithLLM(text) {
  if (!ENABLED || !text || !text.trim()) return null;

  try {
    const res = await fetch(`${API_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `"${text}"` },
        ],
        temperature: 0.1,
        max_tokens: 300,
      }),
    });

    if (!res.ok) {
      console.warn('[llmClient] API error:', res.status);
      return null;
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || '';
    const result = parseLLMOutput(raw);
    console.log('[llmClient]', text, '→', result);
    return result;
  } catch (e) {
    console.warn('[llmClient] parse failed:', e.message);
    return null;
  }
}

/**
 * 批量解析多人成员输入
 * 并发调用，单条失败不影响其他成员
 */
export async function parseBatchWithLLM(texts) {
  const results = await Promise.all(
    texts.map(text => parseWithLLM(text).catch(() => null))
  );
  return results;
}

export function isLLMAvailable() {
  return ENABLED;
}
