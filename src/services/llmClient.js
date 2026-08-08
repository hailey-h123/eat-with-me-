/**
 * LLM Client — 通用 OpenAI 兼容接口
 * 支持 DeepSeek、OpenAI、通义千问等任何兼容 /v1/chat/completions 的服务
 */

const API_KEY = import.meta.env.VITE_LLM_API_KEY || '';
const API_BASE = import.meta.env.VITE_LLM_API_BASE || 'https://api.deepseek.com';
const MODEL = import.meta.env.VITE_LLM_MODEL || 'deepseek-chat';
const ENABLED = !!API_KEY;

/**
 * 调用 LLM 解析自然语言 → 结构化意图
 * 返回 { preferences, allergies, budget, minBudget, atmosphere } 或 null（调用失败时回退到规则引擎）
 */
export async function parseWithLLM(text) {
  if (!ENABLED || !text || !text.trim()) return null;

  const prompt = `你是一个中英文双语餐厅推荐助手。分析用户输入，提取结构化标签。

支持的 偏好(preferences) 标签（中英文均可识别）:
  ['火锅','烤肉','烧烤','日料','韩餐','川菜','湘菜','粤菜','江浙菜','东北菜','北京菜','鲁菜','云南菜','贵州菜','江西菜','福建菜','广西菜','新疆菜','西北菜','西餐','意面','披萨','东南亚菜','泰菜','越南菜','面馆','饺子','包子','粥','汤','快餐','轻食','海鲜','自助','甜品','咖啡','小吃','撸串','烧腊','卤味','咖喱']

支持的 忌口(allergies) 标签:
  ['辣','麻辣','香菜','素食','清真','海鲜','坚果','花生','牛奶','乳糖不耐','减肥','低卡']

支持 预算(budget): "80" 表示上限，"around 80" 或 "80左右" 或 "80上下" 表示区间中点,"100以上" 表示下限
支持 氛围(atmosphere): "安静" 或 "热闹"

规则:
1. 理解语义，分清程度词：如"不太辣"→偏好"微辣"而非忌口辣，"不要太油"→偏好"清淡"
2. 理解隐含需求："暖和"→推测"火锅、汤面"，"下饭"→推测"川菜、湘菜、东北菜"
3. 理解中英文："no spicy"→忌口辣，"craving sushi"→偏好日料
4. 识别组合："想吃火锅但不要太辣"→偏好[火锅]，忌口[辣]
5. 用户没有明确说的不要猜，返回空数组/空字符串
6. 只输出合法JSON，不要markdown代码块，不要解释

用户输入: "${text}"

输出格式（纯JSON，不要其他内容）:
{"preferences":["标签1","标签2"],"allergies":["标签1"],"budget":数字或null,"minBudget":数字或null,"atmosphere":"安静"或"热闹"或""}`;

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
          { role: 'system', content: 'You are a JSON parser. Always output valid JSON only, no markdown.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 300,
      }),
    });

    if (!res.ok) {
      console.warn('[llmClient] API call failed:', res.status, await res.text().catch(() => ''));
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';

    // 清洗：去掉 markdown 代码块，取第一个完整 JSON 对象
    let json = content.replace(/```json|```/g, '').trim();
    const braceStart = json.indexOf('{');
    const braceEnd = json.lastIndexOf('}');
    if (braceStart >= 0 && braceEnd > braceStart) {
      json = json.slice(braceStart, braceEnd + 1);
    }

    const parsed = JSON.parse(json);
    console.log('[llmClient] LLM parsed:', text, '→', parsed);

    return {
      preferences: Array.isArray(parsed.preferences) ? parsed.preferences : [],
      allergies: Array.isArray(parsed.allergies) ? parsed.allergies : [],
      budget: typeof parsed.budget === 'number' ? parsed.budget : (parsed.budget ? parseInt(parsed.budget) : null),
      minBudget: typeof parsed.minBudget === 'number' ? parsed.minBudget : (parsed.minBudget ? parseInt(parsed.minBudget) : null),
      atmosphere: typeof parsed.atmosphere === 'string' ? parsed.atmosphere : '',
      cuisines: Array.isArray(parsed.preferences) ? [...parsed.preferences] : [],
    };
  } catch (e) {
    console.warn('[llmClient] LLM parse failed, falling back to rules:', e.message);
    return null;
  }
}

export function isLLMAvailable() {
  return ENABLED;
}
