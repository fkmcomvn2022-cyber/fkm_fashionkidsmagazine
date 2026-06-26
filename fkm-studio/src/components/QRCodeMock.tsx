// Lightweight deterministic "QR-style" pattern for UI mockups — no network call.
// In production this tile grid would be replaced by a real VietQR payload image.
export function QRCodeMock({ seed, size = 168 }: { seed: string; size?: number }) {
  const cells = 21;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 131 + seed.charCodeAt(i)) >>> 0;

  const rand = () => {
    h = (h * 1103515245 + 12345) >>> 0;
    return h / 0xffffffff;
  };

  const cellSize = size / cells;
  const rects: string[] = [];
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const isFinder =
        (x < 5 && y < 5) || (x > cells - 6 && y < 5) || (x < 5 && y > cells - 6);
      const filled = isFinder ? (x % 4 !== 0 && y % 4 !== 0) : rand() > 0.55;
      if (filled) rects.push(`<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" />`);
    }
  }

  return (
    <div className="bg-white rounded-2xl p-3 inline-block">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="#11141a" dangerouslySetInnerHTML={{ __html: rects.join("") }} />
    </div>
  );
}
