// Executed only on the active tab when the user opens the popup or scans.
(() => {
  const match = location.pathname.match(/^\/(p|reel|reels|tv)\/([\w-]+)\/?/);
  const story = location.pathname.match(/^\/stories\/([\w.]+)\/(\d+)\/?/);
  if (!match && !story) return { error: 'Ouvre un post, un Reel ou une story précise (avec son identifiant dans l’URL), puis réessaie.' };
  const postId = story ? `story_${story[2]}` : match[2];
  const visible = (element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0
      && rect.top < innerHeight && rect.left < innerWidth && getComputedStyle(element).visibility !== 'hidden';
  };
  const dialog = [...document.querySelectorAll('[role="dialog"]')].filter(visible).pop();
  const scope = dialog || document.querySelector('main') || document;
  const articles = [...scope.querySelectorAll('article')];
  const linked = articles.find(article => [...article.querySelectorAll('a[href]')].some(a => {
    try { return new URL(a.href).pathname.match(/^\/(?:p|reel|tv)\/([\w-]+)/)?.[1] === postId; } catch { return false; }
  }));
  // Avoid including suggested posts further down the page.
  const root = story ? scope : linked || articles[0] || scope;
  const images = [];
  const seen = new Set();
  let blockedVideos = 0;
  function add(url, type, extra = {}) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || !/(^|\.)(cdninstagram\.com|fbcdn\.net)$/.test(parsed.hostname)) return false;
      if (type === 'video' && /\.(m3u8|mpd|m4s|ts)$/i.test(parsed.pathname)) return false;
      // Byte-range URLs can be DASH fragments, not complete videos.
      if (type === 'video' && ['bytestart', 'byteend', 'range'].some(key => parsed.searchParams.has(key))) return false;
      const key = `${type}:${parsed.pathname}`;
      if (seen.has(key)) return true;
      seen.add(key);
      images.push({ url, key, type, ...extra });
      return true;
    } catch { return false; }
  }
  for (const video of root.querySelectorAll('video')) {
    if (!visible(video)) continue;
    const urls = [video.currentSrc, video.src, ...[...video.querySelectorAll('source')].map(source => source.src)];
    let found = false;
    for (const url of urls) {
      if (add(url, 'video', { alt: 'Vidéo Instagram', poster: video.poster || '', width: video.videoWidth, height: video.videoHeight })) { found = true; break; }
    }
    if (!found) blockedVideos++;
  }
  for (const img of root.querySelectorAll('img')) {
    if (story && !visible(img)) continue;
    if (img.closest('header') || /profile picture|photo de profil/i.test(img.alt || '')) continue;
    if (img.naturalWidth < 200 || img.naturalHeight < 200) continue;
    // srcset contains the sizes actually offered by Instagram, without modifying signed URLs.
    const candidates = (img.getAttribute('srcset') || '').split(',').map(part => {
      const [url, size] = part.trim().split(/\s+/);
      return { url, size: parseFloat(size) || 0 };
    }).filter(item => item.url).sort((a, b) => b.size - a.size);
    const url = candidates[0]?.url || img.currentSrc || img.src;
    add(url, 'image', { alt: img.alt || 'Image Instagram', width: img.naturalWidth, height: img.naturalHeight });
  }
  return { postId, images, blockedVideos, story: Boolean(story) };
})();
