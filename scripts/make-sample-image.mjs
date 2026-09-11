// Generates research/samples/synthetic-taizokai-hybrid.png — a synthetic "Kasumigaseki mandala"
// (central core, ring of domains, grid of foundation boxes, arrows) used as a fixed benchmark image.
//   node scripts/make-sample-image.mjs research/samples/synthetic-taizokai-hybrid.png
import sharp from "sharp";
const W = 1600, H = 1100;
const domains = ["交通・移動", "ライフスタイル", "災害に強いまち", "多様なビジネス", "エネルギー", "金融・投資", "教育・人材", "観光・文化"];
const cx = W/2, cy = 520, R = 300;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Hiragino Sans, Noto Sans JP, sans-serif">
<rect width="100%" height="100%" fill="#fff"/>
<rect x="20" y="20" width="${W-40}" height="70" fill="#1f3b6e"/>
<text x="${cx}" y="68" text-anchor="middle" fill="#fff" font-size="34" font-weight="bold">持続可能な地域社会の実現に向けた統合的推進体制（概念図）</text>
<text x="60" y="130" font-size="18" fill="#333">理念：環境・経済・社会の統合的向上　　目標：2030年までに全ての地域で自立分散型社会を実現</text>`;
for (let i=0;i<domains.length;i++){
  const a = -Math.PI/2 + i*2*Math.PI/domains.length;
  const x = cx + R*Math.cos(a), y = cy + R*Math.sin(a);
  const colors = ["#e8f0fe","#fde8e8","#e8f7e8","#fff4e0","#f3e8fd","#e0f7f7","#fdf0e8","#eef"];
  svg += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#c0392b" stroke-width="4" marker-end="url(#arr)"/>`;
  svg += `<rect x="${x-95}" y="${y-38}" width="190" height="76" rx="10" fill="${colors[i]}" stroke="#555" stroke-width="2"/>`;
  svg += `<text x="${x}" y="${y-8}" text-anchor="middle" font-size="20" font-weight="bold" fill="#222">${domains[i]}</text>`;
  svg += `<text x="${x}" y="${y+18}" text-anchor="middle" font-size="12" fill="#444">施策${i+1}-1 / 施策${i+1}-2 / KPI</text>`;
  const j=(i+1)%domains.length; const b=-Math.PI/2 + j*2*Math.PI/domains.length;
  svg += `<path d="M ${x} ${y} Q ${cx+(R+80)*Math.cos((a+b)/2)} ${cy+(R+80)*Math.sin((a+b)/2)} ${cx+R*Math.cos(b)} ${cy+R*Math.sin(b)}" fill="none" stroke="#2e7d32" stroke-width="2" stroke-dasharray="6 4"/>`;
}
svg += `<defs><marker id="arr" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#c0392b"/></marker></defs>`;
svg += `<circle cx="${cx}" cy="${cy}" r="120" fill="#fbe9c8" stroke="#b8860b" stroke-width="6"/>
<circle cx="${cx}" cy="${cy}" r="90" fill="none" stroke="#b8860b" stroke-width="2"/>
<text x="${cx}" y="${cy-10}" text-anchor="middle" font-size="30" font-weight="bold" fill="#5a3a00">地域循環共生圏</text>
<text x="${cx}" y="${cy+25}" text-anchor="middle" font-size="16" fill="#5a3a00">ローカルSDGs・自立分散・相互連携</text>`;
// bottom grid of 4x2 foundation boxes
const labels = ["デジタル基盤","データ連携","人材育成","規制改革","資金循環","産学官連携","広域連携","評価・検証"];
for (let i=0;i<8;i++){
  const gx = 60 + (i%4)*380, gy = 880 + Math.floor(i/4)*100;
  svg += `<rect x="${gx}" y="${gy}" width="350" height="80" fill="#eef3f8" stroke="#1f3b6e" stroke-width="2"/>
  <text x="${gx+175}" y="${gy+30}" text-anchor="middle" font-size="18" font-weight="bold" fill="#1f3b6e">${labels[i]}</text>
  <text x="${gx+175}" y="${gy+58}" text-anchor="middle" font-size="11" fill="#333">担当：関係府省・自治体・民間　指標：達成率○%（R7）→○%（R12）</text>`;
}
svg += `<text x="${cx}" y="860" text-anchor="middle" font-size="16" fill="#333">▲ 基盤技術・制度（横断的取組）▲</text>`;
svg += `</svg>`;
await sharp(Buffer.from(svg)).png().toFile(process.argv[2]);
console.log("wrote", process.argv[2]);
