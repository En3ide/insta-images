const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const cdn = 'https://scontent.cdninstagram.com/';
const rect = () => ({ width: 500, height: 700, top: 0, left: 0, bottom: 700, right: 500 });
function extract(pathname, videos = [], photos = []) {
  const root = { querySelectorAll: selector => selector === 'img' ? photos : selector === 'video' ? videos : [] };
  return vm.runInNewContext(source('extract.js'), {
    URL, location: { pathname }, innerWidth: 1200, innerHeight: 900,
    getComputedStyle: () => ({ visibility: 'visible' }),
    document: { querySelectorAll: () => [], querySelector: () => root }
  });
}
const video = url => ({ currentSrc: url, src: url, videoWidth: 1080, videoHeight: 1920, querySelectorAll: () => [], getBoundingClientRect: rect });
const photo = (url, extra = {}) => ({ src: url, alt: 'Photo', naturalWidth: 1080, naturalHeight: 1080, closest: () => null, getAttribute: () => '', getBoundingClientRect: rect, ...extra });

test('post mixte : MP4, meilleure photo, dédoublonnage et filtres', () => {
  const result = extract('/p/ABC/', [video(cdn + 'clip.mp4')], [
    photo(cdn + 'small.jpg', { getAttribute: () => cdn + 'small.jpg 320w, ' + cdn + 'large.jpg 1080w' }),
    photo(cdn + 'large.jpg'), photo(cdn + 'avatar.jpg', { alt: 'Photo de profil' }), photo('https://example.com/photo.jpg')
  ]);
  assert.equal(result.images.length, 2);
  assert.equal(result.images[0].type, 'video');
  assert.equal(result.images[1].url, cdn + 'large.jpg');
});
test('Reels : blobs et segments ne deviennent pas de faux MP4', () => {
  for (const url of ['blob:https://www.instagram.com/123', cdn + 'clip.mp4?bytestart=0&byteend=200', cdn + 'stream.m3u8']) {
    const result = extract('/reel/ABC/', [video(url)]);
    assert.equal(result.images.length, 0);
    assert.equal(result.blockedVideos, 1);
  }
});
test('stories : identifiant distinct et image hors écran écartée', () => {
  const result = extract('/stories/compte/123/', [], [photo(cdn + 'story.jpg'), photo(cdn + 'next.jpg', { getBoundingClientRect: () => ({ ...rect(), left: 1500 }) })]);
  assert.equal(result.postId, 'story_123');
  assert.equal(result.images.length, 1);
  assert.ok(extract('/stories/compte/').error);
  assert.ok(extract('/compte/').error);
});
function metadata(pathname, items) {
  return vm.runInNewContext(source('metadata.js'), { URL, location: { pathname }, document: { querySelectorAll: selector => selector.startsWith('script') ? [{ textContent: JSON.stringify(items) }] : [] } });
}
test('métadonnées : identifiant exact et meilleure vidéo du carrousel', () => {
  const result = metadata('/p/ABC/', [
    { code: 'OTHER', video_versions: [{ url: cdn + 'unrelated.mp4' }] },
    { code: 'ABC', carousel_media: [{ video_versions: [{ url: cdn + 'small.mp4', width: 320, height: 240 }, { url: cdn + 'large.mp4', width: 1080, height: 1920 }] }] }
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].url, cdn + 'large.mp4');
});
test('métadonnées story : les autres stories du compte sont écartées', () => {
  const result = metadata('/stories/name/123/', [
    { pk: '123', video_versions: [{ url: cdn + 'story.mp4' }] },
    { pk: '456', video_versions: [{ url: cdn + 'other.mp4' }] }
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].url, cdn + 'story.mp4');
});
test('téléchargements : extension MP4, nom sûr et échecs comptés', async () => {
  let listener;
  const downloads = [];
  vm.runInNewContext(source('background.js'), { URL, chrome: { runtime: { id: 'test', onMessage: { addListener: fn => { listener = fn; } } }, downloads: { download: async item => { downloads.push(item); if (item.url.includes('failure')) throw Error('Network'); return 1; } } } });
  const result = await new Promise(resolve => listener({ type: 'download', postId: 'story_123', images: [
    { type: 'video', url: cdn + 'clip.mp4' }, { type: 'image', url: cdn + 'photo.webp' },
    { type: 'video', url: 'https://evil.example/clip.mp4' }, { type: 'video', url: cdn + 'clip.mp4?bytestart=0' },
    { type: 'video', url: cdn + 'failure.mp4' }
  ] }, { id: 'test' }, resolve));
  assert.equal(result.started, 2);
  assert.equal(result.failed, 3);
  assert.equal(downloads[0].filename, 'Instagram/story_123/01.mp4');
  assert.equal(downloads[1].filename, 'Instagram/story_123/02.webp');
  const invalid = await new Promise(resolve => listener({ type: 'download', postId: '../escape', images: [] }, { id: 'test' }, resolve));
  assert.ok(invalid.error);
});
