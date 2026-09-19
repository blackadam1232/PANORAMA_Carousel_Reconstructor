function dataUrlToFile(dataUrl: string, name: string): File {
  const [header, body] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

export function createDemoFiles(): File[] {
  const full = document.createElement('canvas'); full.width = 1200; full.height = 750;
  const ctx = full.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, 1200, 750);
  gradient.addColorStop(0, '#dbeafe'); gradient.addColorStop(0.5, '#fde68a'); gradient.addColorStop(1, '#fecdd3');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1200, 750);
  ctx.fillStyle = '#172554'; ctx.font = 'bold 64px system-ui'; ctx.fillText('PANORAMA DEMO', 330, 160);
  ctx.fillStyle = '#334155'; ctx.font = '32px system-ui'; ctx.fillText('Two carousel slides → one complete image', 275, 225);
  for (let i = 0; i < 9; i += 1) {
    ctx.fillStyle = `hsl(${200 + i * 11} 60% ${40 + (i % 3) * 8}%)`;
    ctx.beginPath(); ctx.arc(130 + i * 120, 470 + Math.sin(i) * 55, 42, 0, Math.PI * 2); ctx.fill();
  }
  const files: File[] = [];
  for (let i = 0; i < 2; i += 1) {
    const part = document.createElement('canvas'); part.width = 600; part.height = 750;
    part.getContext('2d')!.drawImage(full, i * 600, 0, 600, 750, 0, 0, 600, 750);
    files.push(dataUrlToFile(part.toDataURL('image/png'), `demo-slide-${i + 1}.png`));
  }
  return files;
}
