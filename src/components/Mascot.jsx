// 拉面碗小人「面仔」- eat-with-me 吉祥物
// 形象：一碗热气腾腾的拉面，碗身长出手脚，碗里有面条/荷包蛋/鸣门卷，头顶冒蒸汽
// 表情变体：happy / expect / surprise / sleepy / think / drool
// size: 数字（像素），className: 附加样式，float: 是否浮动

export default function Mascot({ mood = 'happy', size = 120, className = '', float = true }) {
  const wrapperClass = `${float ? 'mascot-float ' : ''}${className}`;
  return (
    <div className={wrapperClass} style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" width={size} height={size} xmlns="http://www.w3.org/2000/svg">
        {/* 地面阴影 */}
        <ellipse cx="60" cy="110" rx="34" ry="4.5" fill="rgba(45,95,63,0.12)" />

        {/* 蒸汽（三缕，随表情变化） */}
        <Steam mood={mood} />

        {/* 左手（筷子） */}
        <g>
          {/* 小手臂 */}
          <path d="M20 78 Q14 82 16 90 Q17 94 21 93" fill="#FFC79A" stroke="#2D2A22" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
          {/* 筷子 */}
          <rect x="14" y="88" width="3" height="14" rx="1.5" transform="rotate(18 15 95)" fill="#E8B96B" stroke="#2D2A22" strokeWidth="1.5" />
        </g>

        {/* 右手（举着小勺子） */}
        <g>
          <path d="M100 78 Q106 82 104 90 Q103 94 99 93" fill="#FFC79A" stroke="#2D2A22" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
          {/* 小勺子 */}
          <ellipse cx="104" cy="94" rx="3.5" ry="4.5" fill="#FFFFFF" stroke="#2D2A22" strokeWidth="1.5" />
          <rect x="103" y="97" width="2" height="6" rx="1" fill="#FFFFFF" stroke="#2D2A22" strokeWidth="1.2" />
        </g>

        {/* 拉面碗主体 */}
        {/* 碗身（梯形，上宽下窄） */}
        <path d="M22 60 Q20 58 22 56 L98 56 Q100 58 98 60 L92 100 Q90 106 84 106 L36 106 Q30 106 28 100 Z"
          fill="#FF6B3D" stroke="#2D2A22" strokeWidth="2.8" strokeLinejoin="round" />
        {/* 碗身高光 */}
        <path d="M30 64 Q31 80 34 98" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.35" />
        {/* 碗身花纹（波浪线装饰） */}
        <path d="M34 88 Q40 84 46 88 Q52 92 58 88 Q64 84 70 88 Q76 92 82 88 Q86 86 88 88"
          fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.5" />

        {/* 碗口（深色边沿） */}
        <ellipse cx="60" cy="56" rx="40" ry="7" fill="#E8552A" stroke="#2D2A22" strokeWidth="2.8" />
        <ellipse cx="60" cy="55" rx="37" ry="5" fill="#FFF8E7" stroke="#2D2A22" strokeWidth="1.5" />

        {/* 面条（汤面上的曲线） */}
        <path d="M30 54 Q38 50 46 54 Q54 58 62 53 Q70 48 78 54 Q84 57 90 53"
          fill="none" stroke="#FFD66B" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M32 56 Q42 53 52 56 Q60 59 70 55 Q78 52 86 56"
          fill="none" stroke="#FFC93C" strokeWidth="2" strokeLinecap="round" opacity="0.85" />

        {/* 荷包蛋 */}
        <ellipse cx="44" cy="54" rx="9" ry="6" fill="#FFFFFF" stroke="#2D2A22" strokeWidth="2" />
        <circle cx="44" cy="54" r="3.2" fill="#FFB347" stroke="#2D2A22" strokeWidth="1.3" />

        {/* 鸣门卷（粉色鱼板，带螺旋纹） */}
        <g>
          <circle cx="76" cy="53" r="5" fill="#FFE4EC" stroke="#2D2A22" strokeWidth="1.8" />
          <path d="M73 50 Q76 48 79 50 Q81 53 79 56 Q76 58 73 56 Q71 53 73 50 Z"
            fill="#FF8FA3" stroke="#2D2A22" strokeWidth="1" />
        </g>

        {/* 小脚（两只圆短腿） */}
        <ellipse cx="46" cy="107" rx="6" ry="3.5" fill="#E8552A" stroke="#2D2A22" strokeWidth="2" />
        <ellipse cx="74" cy="107" rx="6" ry="3.5" fill="#E8552A" stroke="#2D2A22" strokeWidth="2" />

        {/* 腮红 */}
        <ellipse cx="34" cy="74" rx="5" ry="3" fill="#FF8B6B" opacity="0.55" />
        <ellipse cx="86" cy="74" rx="5" ry="3" fill="#FF8B6B" opacity="0.55" />

        {/* 表情（在碗身上） */}
        <Face mood={mood} />
      </svg>
    </div>
  );
}

// 蒸汽：根据心情调整形态
function Steam({ mood }) {
  const baseColor = '#FFFFFF';
  if (mood === 'sleepy') {
    // 犯困：蒸汽变弱，歪向一边
    return (
      <g opacity="0.6">
        <path d="M48 30 Q46 24 49 20 Q52 16 50 10" fill="none" stroke={baseColor} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M62 28 Q64 22 61 18" fill="none" stroke={baseColor} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      </g>
    );
  }
  if (mood === 'surprise') {
    // 惊讶：蒸汽炸开
    return (
      <g>
        <path d="M46 30 Q42 24 46 18 Q50 12 46 6" fill="none" stroke={baseColor} strokeWidth="2.8" strokeLinecap="round" />
        <path d="M60 26 Q58 18 62 12 Q66 6 62 2" fill="none" stroke={baseColor} strokeWidth="2.8" strokeLinecap="round" />
        <path d="M74 30 Q78 24 74 18 Q70 12 74 6" fill="none" stroke={baseColor} strokeWidth="2.8" strokeLinecap="round" />
      </g>
    );
  }
  if (mood === 'drool') {
    // 流口水：蒸汽浓密香浓
    return (
      <g>
        <path d="M46 30 Q42 24 46 18 Q50 12 46 6" fill="none" stroke={baseColor} strokeWidth="3" strokeLinecap="round" />
        <path d="M60 26 Q58 18 62 12 Q66 6 62 2" fill="none" stroke={baseColor} strokeWidth="3" strokeLinecap="round" />
        <path d="M74 30 Q78 24 74 18 Q70 12 74 6" fill="none" stroke={baseColor} strokeWidth="3" strokeLinecap="round" />
        {/* 香味线 */}
        <path d="M88 20 L94 18 M88 24 L94 24" stroke="#FFC93C" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      </g>
    );
  }
  // 默认：三缕轻柔蒸汽
  return (
    <g opacity="0.85">
      <path d="M48 30 Q44 24 48 18 Q52 12 48 6" fill="none" stroke={baseColor} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M60 28 Q58 20 62 14 Q66 8 62 2" fill="none" stroke={baseColor} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M72 30 Q76 24 72 18 Q68 12 72 6" fill="none" stroke={baseColor} strokeWidth="2.5" strokeLinecap="round" />
    </g>
  );
}

function Face({ mood }) {
  // 眼睛和嘴巴画在碗身（cx 约 60，cy 约 72-82）
  switch (mood) {
    case 'expect':
      // 期待：星星眼 + 舔嘴唇
      return (
        <g>
          <path d="M44 70 L44 64 L47 68 L51 64 L51 70 L47 68 Z" fill="#2D2A22" />
          <path d="M69 70 L69 64 L72 68 L76 64 L76 70 L72 68 Z" fill="#2D2A22" />
          <path d="M52 80 Q60 86 68 80" fill="none" stroke="#2D2A22" strokeWidth="2.2" strokeLinecap="round" />
          {/* 舌头 */}
          <path d="M58 82 Q60 86 62 82" fill="#FF6B6B" stroke="#2D2A22" strokeWidth="1.2" />
        </g>
      );
    case 'surprise':
      // 惊讶：大圆眼 + O 嘴
      return (
        <g>
          <circle cx="48" cy="70" r="4" fill="#2D2A22" />
          <circle cx="72" cy="70" r="4" fill="#2D2A22" />
          <circle cx="49" cy="69" r="1.3" fill="#fff" />
          <circle cx="73" cy="69" r="1.3" fill="#fff" />
          <ellipse cx="60" cy="82" rx="4" ry="5" fill="#2D2A22" />
          <ellipse cx="60" cy="83" rx="2.5" ry="3" fill="#FF6B6B" />
        </g>
      );
    case 'sleepy':
      // 犯困：闭眼 + Zzz
      return (
        <g>
          <path d="M44 70 Q48 73 52 70" fill="none" stroke="#2D2A22" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M68 70 Q72 73 76 70" fill="none" stroke="#2D2A22" strokeWidth="2.2" strokeLinecap="round" />
          <ellipse cx="60" cy="82" rx="3" ry="2.5" fill="#2D2A22" />
          <text x="92" y="40" fontFamily="Fredoka, sans-serif" fontSize="16" fontWeight="700" fill="#2D2A22">z</text>
          <text x="100" y="30" fontFamily="Fredoka, sans-serif" fontSize="12" fontWeight="700" fill="#2D2A22" opacity="0.7">z</text>
        </g>
      );
    case 'think':
      // 思考：向上看 + 歪嘴 + 问号
      return (
        <g>
          <circle cx="48" cy="68" r="3" fill="#2D2A22" />
          <circle cx="72" cy="68" r="3" fill="#2D2A22" />
          <circle cx="49" cy="67" r="1" fill="#fff" />
          <circle cx="73" cy="67" r="1" fill="#fff" />
          <path d="M54 82 L66 80" fill="none" stroke="#2D2A22" strokeWidth="2.2" strokeLinecap="round" />
          <text x="92" y="36" fontFamily="Fredoka, sans-serif" fontSize="18" fontWeight="700" fill="#2D2A22">?</text>
        </g>
      );
    case 'drool':
      // 流口水：笑眼 + 流口水
      return (
        <g>
          <path d="M44 68 Q48 63 52 68" fill="none" stroke="#2D2A22" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M68 68 Q72 63 76 68" fill="none" stroke="#2D2A22" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M52 80 Q60 87 68 80" fill="none" stroke="#2D2A22" strokeWidth="2.2" strokeLinecap="round" />
          {/* 口水滴 */}
          <path d="M68 83 Q70 90 68 94 Q66 90 68 83 Z" fill="#7CC4F5" stroke="#5BA8DD" strokeWidth="1.2" />
        </g>
      );
    case 'happy':
    default:
      // 开心吃：眯眼笑 + 张嘴 + 小星星
      return (
        <g>
          <path d="M44 70 Q48 64 52 70" fill="none" stroke="#2D2A22" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M68 70 Q72 64 76 70" fill="none" stroke="#2D2A22" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M52 80 Q60 88 68 80 Q60 84 52 80 Z" fill="#FF6B3D" stroke="#2D2A22" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M56 82 Q60 85 64 82" fill="#FF6B6B" stroke="none" />
          {/* 头顶小星星 */}
          <path d="M100 42 L102 46 L106 48 L102 50 L100 54 L98 50 L94 48 L98 46 Z" fill="#FFC93C" stroke="#2D2A22" strokeWidth="1" strokeLinejoin="round" />
        </g>
      );
  }
}

// 小装饰：漂浮食物图标（背景点缀用）
// 扩展了更多种类，用于页面背景装饰
export function FoodDecor({ type = 'fork', size = 24, className = '', style = {} }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' };
  switch (type) {
    case 'fork':
      return (
        <svg {...common} className={className} style={style} fill="none">
          <path d="M8 3v6a4 4 0 0 0 8 0V3M12 13v8" stroke="#FF6B3D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'chili':
      return (
        <svg {...common} className={className} style={style} fill="none">
          <path d="M4 14c0-3 2-6 6-6 4 0 8 3 10 8-3 1-7 1-10-1-3-1-6-2-6-1z" fill="#FF6B3D" stroke="#2D2A22" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M14 8l3-3" stroke="#6BCB77" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'bowl':
      return (
        <svg {...common} className={className} style={style} fill="none">
          <path d="M3 11h18l-2 7a3 3 0 0 1-3 2H8a3 3 0 0 1-3-2L3 11z" fill="#FFC93C" stroke="#2D2A22" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M3 11c0-1 2-2 4-2M7 9c2 0 3 1 3 2M11 9c2 0 3 1 3 2" stroke="#2D2A22" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case 'star':
      return (
        <svg {...common} className={className} style={style} fill="#FFC93C">
          <path d="M12 2l2.5 6.5L21 9l-5 4.5L17.5 21 12 17l-5.5 4L8 13.5 3 9l6.5-.5L12 2z" stroke="#2D2A22" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      );
    case 'mushroom':
      // 小蘑菇
      return (
        <svg {...common} className={className} style={style} fill="none">
          <path d="M4 12c0-4 3.5-7 8-7s8 3 8 7H4z" fill="#FF8FA3" stroke="#2D2A22" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="9" cy="9" r="1.5" fill="#fff" />
          <circle cx="15" cy="10" r="1.2" fill="#fff" />
          <circle cx="12" cy="7.5" r="1" fill="#fff" />
          <path d="M9 12v6c0 1 1.5 2 3 2s3-1 3-2v-6" fill="#FFF8E7" stroke="#2D2A22" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
    case 'heart':
      // 小爱心
      return (
        <svg {...common} className={className} style={style} fill="#FF8FA3">
          <path d="M12 21s-7-4.5-9.5-9C1 9 2.5 5 6 5c2 0 3.5 1.5 6 4 2.5-2.5 4-4 6-4 3.5 0 5 4 3.5 7C19 16.5 12 21 12 21z" stroke="#2D2A22" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
    case 'spoon':
      // 小勺子
      return (
        <svg {...common} className={className} style={style} fill="none">
          <ellipse cx="12" cy="7" rx="4" ry="5" fill="#FFC93C" stroke="#2D2A22" strokeWidth="1.5" />
          <path d="M12 12v9" stroke="#2D2A22" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'egg':
      // 小荷包蛋
      return (
        <svg {...common} className={className} style={style} fill="none">
          <ellipse cx="12" cy="13" rx="8" ry="6" fill="#FFFFFF" stroke="#2D2A22" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="3" fill="#FFB347" stroke="#2D2A22" strokeWidth="1.2" />
        </svg>
      );
    case 'noodle':
      // 小面条
      return (
        <svg {...common} className={className} style={style} fill="none">
          <path d="M3 14h18c0 4-4 7-9 7s-9-3-9-7z" fill="#FFD66B" stroke="#2D2A22" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M6 11c0-3 1-5 2-6M10 10c0-3 1-5 2-6M14 11c0-3 1-5 2-6" stroke="#FFB347" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'sparkle':
      // 小闪光
      return (
        <svg {...common} className={className} style={style} fill="#FFC93C">
          <path d="M12 2l1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5L12 2z" stroke="#2D2A22" strokeWidth="1" strokeLinejoin="round" />
          <circle cx="19" cy="5" r="1.5" />
          <circle cx="5" cy="19" r="1.2" />
        </svg>
      );
    case 'leaf':
      // 小绿叶
      return (
        <svg {...common} className={className} style={style} fill="none">
          <path d="M5 19c0-8 6-14 14-14 0 8-6 14-14 14z" fill="#6BCB77" stroke="#2D2A22" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M5 19L13 11" stroke="#2D2A22" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'dumpling':
      // 小饺子/包子
      return (
        <svg {...common} className={className} style={style} fill="none">
          <path d="M4 14c0-4 3.5-7 8-7s8 3 8 7c0 2-3 4-8 4s-8-2-8-4z" fill="#FFF8E7" stroke="#2D2A22" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M8 11c1 1 2 1 4 1s3 0 4-1" stroke="#2D2A22" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M7 13c1.5 1 3 1.5 5 1.5s3.5-.5 5-1.5" stroke="#2D2A22" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}
