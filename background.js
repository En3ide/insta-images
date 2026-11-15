function validImageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /(^|\.)(cdninstagram\.com|fbcdn\.net)$/.test(url.hostname);
  } catch { return false; }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || message.type !== 'download') return;
  (async () => {
    if (!/^[\w-]+$/.test(message.postId || '') || !Array.isArray(message.images) || message.images.length > 100) {
      throw new Error('Sélection invalide.');
    }
    let started = 0;
    let failed = 0;
    for (const [index, image] of message.images.entries()) {
      if (!validImageUrl(image.url)) { failed++; continue; }
      if (!['image', 'video'].includes(image.type)) { failed++; continue; }
      const parsed = new URL(image.url);
      if (image.type === 'video' && (/\.(m3u8|mpd|m4s|ts)$/i.test(parsed.pathname) || ['bytestart', 'byteend', 'range'].some(key => parsed.searchParams.has(key)))) { failed++; continue; }
      const extension = image.type === 'video' ? 'mp4' : new URL(image.url).pathname.match(/\.(jpe?g|png|webp|avif)$/i)?.[1]?.toLowerCase() || 'jpg';
      try {
        await chrome.downloads.download({
          url: image.url,
          filename: `Instagram/${message.postId}/${String(index + 1).padStart(2, '0')}.${extension}`,
          conflictAction: 'uniquify',
          saveAs: false
        });
        started++;
      } catch { failed++; }
    }
    respond({ started, failed });
  })().catch(error => respond({ error: error.message }));
  return true;
});
