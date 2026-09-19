'use client';

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createDemoFiles } from '@/lib/demo';
import { calculateOutputDimensions, formatBytes, isPotentiallyUnsafe } from '@/lib/dimensions';
import { buildPanorama, canvasToBlob, detectOverlap, loadSlide } from '@/lib/image';
import type { Orientation, SeamState, SlideItem } from '@/types/panorama';

const ACCEPT = 'image/jpeg,image/png,image/webp';

type Stage = 'idle' | 'reading' | 'checking' | 'analyzing' | 'building' | 'ready';

export function PanoramaApp() {
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [seams, setSeams] = useState<SeamState[]>([]);
  const [orientation, setOrientation] = useState<Orientation>('horizontal');
  const [autoDetect, setAutoDetect] = useState(true);
  const [jpegQuality, setJpegQuality] = useState(0.98);
  const [stage, setStage] = useState<Stage>('idle');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [resultCanvas, setResultCanvas] = useState<HTMLCanvasElement | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeSeam, setActiveSeam] = useState(0);
  const [zoom, setZoom] = useState(1.5);
  const fileInput = useRef<HTMLInputElement>(null);
  const dragIndex = useRef<number | null>(null);

  const overlaps = useMemo(() => seams.map((s) => s.manualOverlap ?? s.detectedOverlap), [seams]);
  const matching = slides.length > 1 && slides.every((s) => s.width === slides[0].width && s.height === slides[0].height);

  const cleanupSlides = useRef<SlideItem[]>([]);
  const cleanupResult = useRef('');
  useEffect(() => { cleanupSlides.current = slides; }, [slides]);
  useEffect(() => { cleanupResult.current = resultUrl; }, [resultUrl]);
  useEffect(() => () => {
    cleanupSlides.current.forEach((s) => URL.revokeObjectURL(s.objectUrl));
    if (cleanupResult.current) URL.revokeObjectURL(cleanupResult.current);
  }, []);

  async function addFiles(files: File[]) {
    if (!files.length) return;
    setError(''); setWarning(''); setStage('reading'); setProgress('Reading images...');
    const seen = new Set(slides.map((s) => `${s.name}:${s.size}`));
    const unique = files.filter((f) => !seen.has(`${f.name}:${f.size}`));
    if (unique.length !== files.length) setWarning('Duplicate files were skipped.');
    try {
      const loaded: SlideItem[] = [];
      for (let i = 0; i < unique.length; i += 1) loaded.push(await loadSlide(unique[i], slides.length + i));
      const next = [...slides, ...loaded].map((s, i) => ({ ...s, order: i }));
      setSlides(next); setSeams([]); clearResult(); setStage('idle'); setProgress('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read those images.'); setStage('idle'); }
  }

  function clearResult() {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl(''); setResultCanvas(null); setEditorOpen(false);
  }

  function onFileInput(e: ChangeEvent<HTMLInputElement>) { addFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }
  function onDrop(e: DragEvent<HTMLDivElement>) { e.preventDefault(); addFiles(Array.from(e.dataTransfer.files)); }

  function reorder(from: number, to: number) {
    if (to < 0 || to >= slides.length || from === to) return;
    const next = [...slides]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved);
    setSlides(next.map((s, i) => ({ ...s, order: i }))); setSeams([]); clearResult();
  }

  function removeSlide(index: number) {
    URL.revokeObjectURL(slides[index].objectUrl);
    setSlides(slides.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i }))); setSeams([]); clearResult();
  }

  async function replaceSlide(index: number, file: File) {
    try {
      const replacement = await loadSlide(file, index);
      URL.revokeObjectURL(slides[index].objectUrl);
      const next = [...slides]; next[index] = replacement; setSlides(next); setSeams([]); clearResult();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not replace the image.'); }
  }

  async function createPanorama() {
    if (slides.length < 2) { setError('Choose at least two carousel images.'); return; }
    setError(''); setWarning(''); setStage('checking'); setProgress('Checking dimensions...');
    if (!matching) setWarning('Slide dimensions do not match. Images will not be stretched; the output canvas uses the largest cross-axis size.');
    const direct = slides.slice(0, -1).map((s, i) => ({ leftSlideId: s.id, rightSlideId: slides[i + 1].id, detectedOverlap: 0, manualOverlap: null, confidence: 0, status: 'direct' as const }));
    let calculated = direct;
    if (autoDetect) {
      setStage('analyzing'); setProgress('Analyzing seams...');
      calculated = [];
      for (let i = 0; i < slides.length - 1; i += 1) {
        const found = await detectOverlap(slides[i], slides[i + 1], orientation);
        const safeApply = found.confidence >= 82 ? found.overlap : 0;
        calculated.push({ leftSlideId: slides[i].id, rightSlideId: slides[i + 1].id, detectedOverlap: safeApply, manualOverlap: null, confidence: found.confidence, status: found.confidence >= 82 ? 'overlap' : found.confidence >= 60 ? 'possible' : 'direct' });
      }
    }
    setSeams(calculated);
    const nextEstimate = calculateOutputDimensions(slides, calculated.map((s) => s.detectedOverlap), orientation);
    if (isPotentiallyUnsafe(nextEstimate)) {
      setStage('idle'); setError(`This panorama may be too large for your device to process safely (${nextEstimate.width} × ${nextEstimate.height}, about ${formatBytes(nextEstimate.estimatedBytes)} raw). Try fewer images or a desktop browser.`); return;
    }
    await render(calculated);
  }

  async function render(nextSeams = seams) {
    setStage('building'); setProgress('Building panorama...');
    try {
      const canvas = await buildPanorama(slides, nextSeams, orientation);
      setProgress('Preparing preview...');
      const blob = await canvasToBlob(canvas, 'image/png');
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      setResultUrl(URL.createObjectURL(blob)); setResultCanvas(canvas); setStage('ready'); setProgress('Panorama ready');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not build the panorama.'); setStage('idle'); }
  }

  function updateSeam(value: number) {
    const next = seams.map((s, i) => i === activeSeam ? { ...s, manualOverlap: value, status: 'manual' as const } : s);
    setSeams(next); render(next);
  }

  async function redetectActive() {
    const left = slides[activeSeam], right = slides[activeSeam + 1]; if (!left || !right) return;
    const found = await detectOverlap(left, right, orientation);
    const next = seams.map((s, i) => i === activeSeam ? { ...s, detectedOverlap: found.confidence >= 82 ? found.overlap : 0, manualOverlap: null, confidence: found.confidence, status: found.confidence >= 82 ? 'overlap' as const : 'possible' as const } : s);
    setSeams(next); render(next);
  }

  async function download(type: 'png' | 'jpeg') {
    if (!resultCanvas) return;
    try {
      const mime = type === 'png' ? 'image/png' : 'image/jpeg';
      const blob = await canvasToBlob(resultCanvas, mime, jpegQuality);
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = `panorama.${type === 'png' ? 'png' : 'jpg'}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e instanceof Error ? e.message : 'Download failed.'); }
  }

  async function tryDemo() { reset(); await addFiles(createDemoFiles()); }
  function reset() { slides.forEach((s) => URL.revokeObjectURL(s.objectUrl)); setSlides([]); setSeams([]); setError(''); setWarning(''); clearResult(); setStage('idle'); }

  return <main>
    <header className="topbar"><a className="brand" href="#top">PANORAMA</a><nav><a href="#how">How it works</a><a href="#privacy">Privacy</a></nav></header>
    <section id="top" className="hero"><div className="eyebrow">Local • Private • Full resolution</div><h1>Turn carousel slides into one perfect panorama.</h1><p>Upload the images in carousel order. We’ll reconnect them into one full-resolution picture — without generative AI.</p>
      <div className="actions"><button className="primary" onClick={() => fileInput.current?.click()}>Choose Carousel Images</button><button className="ghost" onClick={tryDemo}>Try Demo</button></div>
      <input ref={fileInput} type="file" multiple accept={ACCEPT} hidden onChange={onFileInput}/><div className="privacyPill">🔒 Your images stay on your device.</div>
    </section>

    <section className="workspace">
      <div className="uploadZone" onDragOver={(e) => e.preventDefault()} onDrop={onDrop} onClick={() => fileInput.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInput.current?.click()}>
        <div className="uploadIcon">＋</div><strong>Drop carousel images here</strong><span>or click to choose JPG, PNG, or WEBP files</span>
      </div>
      {error && <div className="notice error" role="alert">{error}</div>}{warning && <div className="notice warning">{warning}</div>}
      {slides.length > 0 && <>
        <div className="sectionHead"><div><p className="eyebrow">Your carousel</p><h2>{slides.length} slide{slides.length === 1 ? '' : 's'} selected</h2><p className="muted">{matching ? `${slides.length} matching slides detected — ${slides[0].width} × ${slides[0].height}` : 'Mixed dimensions detected — review before stitching.'}</p></div>
          <button className="ghost small" onClick={() => { setSlides([...slides].reverse().map((s, i) => ({ ...s, order: i }))); setSeams([]); clearResult(); }}>Reverse Order</button></div>
        <div className="slideRail">{slides.map((slide, index) => <article className="slideCard" key={slide.id} draggable onDragStart={() => dragIndex.current = index} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragIndex.current !== null) reorder(dragIndex.current, index); dragIndex.current = null; }}>
          <div className="number">{index + 1}</div><img src={slide.objectUrl} alt={`Preview of slide ${index + 1}`}/><div className="slideMeta"><strong title={slide.name}>{slide.name}</strong><span>{slide.width} × {slide.height} • {formatBytes(slide.size)}</span></div>
          <div className="cardActions"><button onClick={() => reorder(index, index - 1)} disabled={index === 0}>←</button><button onClick={() => reorder(index, index + 1)} disabled={index === slides.length - 1}>→</button><label className="replace">Replace<input type="file" accept={ACCEPT} onChange={(e) => e.target.files?.[0] && replaceSlide(index, e.target.files[0])}/></label><button onClick={() => removeSlide(index)}>Remove</button></div>
        </article>)}</div>
        <div className="settings"><label>Orientation<select value={orientation} onChange={(e) => { setOrientation(e.target.value as Orientation); setSeams([]); clearResult(); }}><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option></select></label><label className="check"><input type="checkbox" checked={autoDetect} onChange={(e) => setAutoDetect(e.target.checked)}/>Automatic seam detection</label><label>JPG quality<select value={jpegQuality} onChange={(e) => setJpegQuality(Number(e.target.value))}><option value="0.9">90%</option><option value="0.95">95%</option><option value="0.98">98%</option><option value="1">100%</option></select></label></div>
        <button className="primary wide" onClick={createPanorama} disabled={slides.length < 2 || stage !== 'idle' && stage !== 'ready'}>Create Full Panorama</button>
      </>}
      {stage !== 'idle' && stage !== 'ready' && <div className="progress"><span className="spinner"/> {progress}</div>}
    </section>

    {resultUrl && <section className="result"><div className="sectionHead"><div><p className="eyebrow">Full panorama</p><h2>Panorama ready</h2></div><button className="ghost small" onClick={reset}>Create Another</button></div>
      <div className="preview"><img src={resultUrl} alt="Reconstructed full panorama" style={{ transform: `scale(${editorOpen ? zoom : 1})` }}/></div>
      <div className="stats"><div><span>Slides</span><strong>{slides.length}</strong></div><div><span>Final image</span><strong>{resultCanvas?.width} × {resultCanvas?.height}</strong></div><div><span>Seams</span><strong>{seams.length}</strong></div><div><span>Overlap removed</span><strong>{overlaps.reduce((a,b)=>a+b,0)}px</strong></div></div>
      <div className="downloadBar"><button className="primary" onClick={() => download('png')}>Download PNG</button><button className="secondary" onClick={() => download('jpeg')}>Download High Quality JPG</button><button className="ghost" onClick={() => setEditorOpen((v) => !v)}>Adjust Join</button></div>
      <p className="formatNote">PNG avoids additional JPEG compression. JPG creates a smaller file at your selected quality.</p>
      {editorOpen && seams.length > 0 && <div className="seamEditor"><div className="editorTop"><div><p className="eyebrow">Seam inspector</p><h3>Join {activeSeam + 1} of {seams.length}</h3></div><div className="compactActions"><button onClick={() => setActiveSeam(Math.max(0, activeSeam - 1))}>Previous</button><button onClick={() => setActiveSeam(Math.min(seams.length - 1, activeSeam + 1))}>Next</button></div></div>
        <label className="range">Overlap <strong>{seams[activeSeam].manualOverlap ?? seams[activeSeam].detectedOverlap}px</strong><input type="range" min="-150" max={Math.min(300, orientation === 'horizontal' ? slides[activeSeam + 1].width - 1 : slides[activeSeam + 1].height - 1)} value={seams[activeSeam].manualOverlap ?? seams[activeSeam].detectedOverlap} onChange={(e) => updateSeam(Number(e.target.value))}/></label>
        <div className="editorMeta"><span>Detection confidence: {seams[activeSeam].confidence}%</span><span>Status: {seams[activeSeam].status}</span></div><div className="compactActions"><button onClick={() => updateSeam(0)}>Reset</button><button onClick={redetectActive}>Auto Detect Again</button><button onClick={() => setZoom(Math.max(1, zoom - .25))}>Zoom Out</button><button onClick={() => setZoom(Math.min(3, zoom + .25))}>Zoom In</button></div>
      </div>}
    </section>}

    <section id="how" className="infoGrid"><article><p className="eyebrow">01</p><h3>Upload in order</h3><p>Choose 2 or more carousel slides. Drag cards, use arrow buttons, or reverse the entire order.</p></article><article><p className="eyebrow">02</p><h3>Reconnect safely</h3><p>Direct joins preserve every pixel. High-confidence duplicated edge regions can be removed automatically.</p></article><article><p className="eyebrow">03</p><h3>Inspect & export</h3><p>Fine-tune each seam, then export a full-resolution PNG or high-quality JPG.</p></article></section>
    <section id="privacy" className="privacy"><div><p className="eyebrow">Privacy by design</p><h2>Your photos never need to leave your browser.</h2></div><p>Panorama processing is performed locally in your browser. Images are not uploaded or stored by this app. No account, database, API key, or generative AI is required.</p></section>
    <footer>Built for one job: carousel images → one complete panorama.</footer>
  </main>;
}
