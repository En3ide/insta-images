const scanButton = document.querySelector('#scan');
const downloadButton = document.querySelector('#download');
const status = document.querySelector('#status');
const grid = document.querySelector('#images');
const selectAll = document.querySelector('#select-all');
let images = [];
let postId = '';

function updateSelection() {
  const boxes = [...grid.querySelectorAll('input')];
  const selected = boxes.filter(box => box.checked).length;
  document.querySelector('#count').textContent = `${selected} / ${boxes.length}`;
  selectAll.checked = boxes.length > 0 && selected === boxes.length;
  selectAll.indeterminate = selected > 0 && selected < boxes.length;
  downloadButton.disabled = selected === 0;
}

function render() {
  grid.replaceChildren();
  images.forEach((item, index) => {
    const label = document.createElement('label');
    label.className = 'card';
    const img = document.createElement(item.type === 'video' ? 'video' : 'img');
    img.src = item.url;
    img.alt = item.alt;
    img.referrerPolicy = 'no-referrer';
    if (item.type === 'video') {
      img.muted = true;
      img.preload = 'metadata';
      img.playsInline = true;
      if (item.poster) img.poster = item.poster;
    }
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.value = String(index);
    checkbox.setAttribute('aria-label', `Sélectionner le média ${index + 1}`);
    checkbox.addEventListener('change', updateSelection);
    const caption = document.createElement('span');
    caption.textContent = `${item.type === 'video' ? '▶ Vidéo MP4' : 'Photo'} · ${index + 1}`;
    label.append(img, checkbox, caption);
    grid.append(label);
  });
  document.querySelector('#toolbar').hidden = images.length === 0;
  updateSelection();
}

async function scan() {
  scanButton.disabled = true;
  downloadButton.disabled = true;
  status.textContent = 'Recherche des photos et vidéos…';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = new URL(tab?.url || 'about:blank');
    if (url.protocol !== 'https:' || !/(^|\.)instagram\.com$/.test(url.hostname)) {
      throw new Error('Ouvre une publication sur instagram.com, puis clique sur l’extension.');
    }
    const [execution] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['extract.js'] });
    const result = execution?.result;
    if (!result || result.error) throw new Error(result?.error || 'Impossible de lire ce post. Recharge la page puis réessaie.');
    // Only data belonging to the exact post/story ID is accepted from page metadata.
    let metadata = [];
    try {
      const [extra] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', files: ['metadata.js'] });
      metadata = extra?.result || [];
    } catch { /* Direct media detection remains available. */ }
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (currentTab?.id !== tab.id || currentTab.url !== tab.url) throw new Error('Le contenu a changé pendant l’analyse. Relance l’analyse sur le média souhaité.');
    postId = result.postId;
    const cached = (await chrome.storage.session.get('lastPost')).lastPost;
    const merged = new Map((cached?.postId === postId ? cached.images.filter(item => item.type) : []).map(item => [item.key, item]));
    [...result.images, ...metadata].forEach(item => merged.set(item.key, item));
    images = [...merged.values()].slice(0, 100);
    await chrome.storage.session.set({ lastPost: { postId, images } });
    render();
    const videos = images.filter(item => item.type === 'video').length;
    status.textContent = images.length ? `${images.length - videos} photo(s), ${videos} vidéo(s) trouvée(s).` : 'Aucun média téléchargeable trouvé. Lance la lecture dans Instagram puis relance l’analyse.';
    if (result.blockedVideos && !videos) status.textContent += ' La vidéo utilise un flux temporaire ou segmenté sans fichier MP4 accessible ; elle ne peut pas être enregistrée par cette version.';
  } catch (error) {
    images = [];
    postId = '';
    render();
    status.textContent = error.message;
  } finally { scanButton.disabled = false; }
}

selectAll.addEventListener('change', () => {
  grid.querySelectorAll('input').forEach(box => { box.checked = selectAll.checked; });
  updateSelection();
});
scanButton.addEventListener('click', scan);
downloadButton.addEventListener('click', async () => {
  const selected = [...grid.querySelectorAll('input:checked')].map(box => images[Number(box.value)]);
  downloadButton.disabled = true;
  scanButton.disabled = true;
  try {
    const result = await chrome.runtime.sendMessage({ type: 'download', postId, images: selected });
    if (result?.error || !result) throw new Error(result?.error || 'Le téléchargement n’a pas pu démarrer.');
    status.textContent = `${result.started} téléchargement(s) lancé(s)${result.failed ? `, ${result.failed} échec(s)` : ''}. Consulte les téléchargements Edge pour leur progression.`;
  } catch (error) { status.textContent = error.message; }
  finally { scanButton.disabled = false; updateSelection(); }
});
scan();
