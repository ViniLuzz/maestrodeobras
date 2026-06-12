// Gera os ícones do app a partir do símbolo do logo (assets/logo.png).
// Recorta só a marca (casa + capacete + prancheta), apara e compõe nos tamanhos.
//   node scripts/gerar-icones.js
const sharp = require('sharp');
const path = require('path');

const ASSETS = path.join(__dirname, '..', 'assets');

async function main() {
  // 1) Recorta a faixa do símbolo e apara o transparente
  const crop = await sharp(path.join(ASSETS, 'logo.png'))
    .extract({ left: 200, top: 150, width: 430, height: 600 })
    .png()
    .toBuffer();
  const mark = await sharp(crop).trim({ threshold: 10 }).png().toBuffer();

  // Compõe a marca centralizada num quadrado, com fundo dado.
  async function compor(canvas, box, bg, out) {
    const m = await sharp(mark)
      .resize(box, box, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    await sharp({ create: { width: canvas, height: canvas, channels: 4, background: bg } })
      .composite([{ input: m, gravity: 'center' }])
      .png()
      .toFile(path.join(ASSETS, out));
    console.log('✓', out, `(${canvas}px, marca ${box}px)`);
  }

  const branco = { r: 255, g: 255, b: 255, alpha: 1 };
  const transp = { r: 0, g: 0, b: 0, alpha: 0 };

  // iOS / fallback: fundo branco opaco (iOS não aceita transparência no ícone)
  await compor(1024, 820, branco, 'icon.png');
  // Android adaptive: marca dentro da zona segura (~60%) + fundo via app.json
  await compor(1024, 600, transp, 'adaptive-icon.png');
  // Splash nativa (mostra sobre #f0f0f0): marca menor, transparente
  await compor(1024, 560, transp, 'splash-icon.png');
  // Favicon web
  await compor(64, 56, branco, 'favicon.png');

  // Preview de como fica com a máscara circular do Android
  const circle = Buffer.from(
    '<svg width="1024" height="1024"><circle cx="512" cy="512" r="512" fill="#fff"/></svg>'
  );
  const adaptive = await sharp(path.join(ASSETS, 'adaptive-icon.png')).png().toBuffer();
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: branco } })
    .composite([{ input: adaptive }, { input: circle, blend: 'dest-in' }])
    .png()
    .toFile(path.join(ASSETS, '_adaptive_circle_preview.png'));
  console.log('✓ _adaptive_circle_preview.png (como fica no Android)');
}

main().catch(e => { console.error(e); process.exit(1); });
