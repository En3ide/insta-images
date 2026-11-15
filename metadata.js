// Runs in MAIN to inspect JSON data rendered by Instagram. No private API or cookies.
(() => {
  const post = location.pathname.match(/^\/(?:p|reel|reels|tv)\/([\w-]+)/);
  const story = location.pathname.match(/^\/stories\/[\w.]+\/(\d+)/);
  if (!post && !story) return [];
  const media = new Map();
  const visited = new WeakSet();
  let budget = 60000;
  const safeUrl = value => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && /(^|\.)(cdninstagram\.com|fbcdn\.net)$/.test(url.hostname)
        && !/\.(m3u8|mpd|m4s|ts)$/i.test(url.pathname)
        && !['bytestart', 'byteend', 'range'].some(key => url.searchParams.has(key));
    } catch { return false; }
  };
  function collect(item) {
    const versions = Array.isArray(item.video_versions) ? item.video_versions : [];
    const video = versions.filter(v => safeUrl(v?.url)).sort((a, b) => (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0))[0];
    if (video) {
      const key = `video:${new URL(video.url).pathname}`;
      media.set(key, { key, type: 'video', url: video.url, alt: 'Vidéo Instagram', width: video.width, height: video.height });
    }
    if (Array.isArray(item.carousel_media)) item.carousel_media.forEach(collect);
  }
  function walk(value, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 35 || --budget <= 0 || visited.has(value)) return;
    visited.add(value);
    const id = String(value.pk || value.id || '').split('_')[0];
    if ((story && id === story[1]) || (post && (value.code === post[1] || value.shortcode === post[1]))) collect(value);
    for (const [key, child] of Object.entries(value)) {
      if (['return', '_owner', 'stateNode', 'alternate'].includes(key)) continue;
      walk(child, depth + 1);
    }
  }
  for (const script of document.querySelectorAll('script[type="application/json"]')) {
    if (script.textContent.length > 12000000) continue;
    try { walk(JSON.parse(script.textContent)); } catch { /* Not media JSON. */ }
  }
  // Some pages keep the matching media in React props instead of JSON scripts.
  for (const node of document.querySelectorAll('video')) {
    let parent = node;
    for (let level = 0; parent && level < 5; level++, parent = parent.parentElement) {
      for (const key of Object.keys(parent)) {
        if (key.startsWith('__reactProps$') || key.startsWith('__reactFiber$')) {
          try { walk(parent[key]); } catch { /* Framework internals may change. */ }
        }
      }
    }
  }
  return [...media.values()].slice(0, 100);
})();
