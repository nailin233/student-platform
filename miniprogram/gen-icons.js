/**
 * 生成 TabBar 图标（SVG 内联绘制 → PNG）
 * ---------------------------------------------------------------------------
 * 微信 TabBar 图标要求：
 *   - 尺寸 81 x 81 px（官方推荐）
 *   - 背景透明
 *   - 不能使用 SVG，必须是 PNG
 * 每个标签两版：常态灰 #8a8f99、选中态主色 #0052d9
 */

const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const OUT_DIR = process.argv[2]
if (!OUT_DIR) {
  console.error('用法: node gen-icons.js <输出目录>')
  process.exit(1)
}
fs.mkdirSync(OUT_DIR, { recursive: true })

const SIZE = 81
// 画布 81x81，内容留 9px 内边距，实际绘制区 63x63
const GRAY = '#8a8f99'
const BLUE = '#0052d9'

/**
 * 每个图标用 path 描述，viewBox 统一 24x24，再缩放到 81x81。
 * stroke 风格统一：无填充、2px 线宽、圆角端点 —— 视觉更轻盈，且与 Naive UI 线性图标一致。
 *
 * 设计要点（TabBar 图标只有 81px，必须一眼能分辨）：
 *   - courses  用「多行卡片列表」侧影，而不是书本（书本缩到 63px 会糊成一个方块）
 *   - teachers 用「双人」表现团队/师资
 *   - profile  用「单人 + 圆环」，与 teachers 的双人明确区分
 */
const ICONS = {
  // 课程：列表卡片（外框 + 左侧小方块 + 两条文字线），比书本更易辨识
  courses: [
    'M4 4.5h16a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18V6A1.5 1.5 0 0 1 4 4.5Z',
    'M6.5 9h3.5',
    'M6.5 12h3.5',
    'M6.5 15h3.5',
    'M13 9h4.5',
    'M13 12h4.5'
  ],
  // 老师：双人（前一人完整，后一人露出轮廓），表达「师资团队」
  teachers: [
    'M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
    'M3 20a5.5 5.5 0 0 1 11 0',
    'M16 5.5a3 3 0 0 1 0 5.6',
    'M17.5 20a5.5 5.5 0 0 0-2.2-4.4 4 4 0 0 1 5.7 3.7'
  ],
  // 我的：单人（头 + 肩），与老师的双人明确区分
  profile: [
    'M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
    'M4.5 20.5a7.5 7.5 0 0 1 15 0'
  ]
}

function buildSvg(paths, color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24">
  <g fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    ${paths.map(d => `<path d="${d}"/>`).join('\n    ')}
  </g>
</svg>`
}

async function main() {
  const jobs = []
  for (const [name, paths] of Object.entries(ICONS)) {
    jobs.push(
      sharp(Buffer.from(buildSvg(paths, GRAY)))
        .resize(SIZE, SIZE)
        .png()
        .toFile(path.join(OUT_DIR, `${name}.png`))
        .then(() => console.log(`  ok  ${name}.png (常态 灰)`))
    )
    jobs.push(
      sharp(Buffer.from(buildSvg(paths, BLUE)))
        .resize(SIZE, SIZE)
        .png()
        .toFile(path.join(OUT_DIR, `${name}-active.png`))
        .then(() => console.log(`  ok  ${name}-active.png (选中 蓝)`))
    )
  }
  await Promise.all(jobs)
  console.log('\n全部图标已生成到: ' + OUT_DIR)
}

main().catch(e => {
  console.error('生成失败:', e.message)
  process.exit(1)
})
