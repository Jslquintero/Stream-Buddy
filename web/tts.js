globalThis.createTTSController = function ({ api, getState, notice }) {
  const $ = selector => document.querySelector(selector);
  const form = $('#settings');
  let initialized = false, resourceKey = '', catalogKey = '', pickedId = null;
  function dirty() { $('#tts-save-status').textContent = 'Cambios sin guardar'; }
  function writeSettings(settings) {
    for (const [key, value] of Object.entries(settings)) {
      const input = form.elements[key]; if (!input) continue;
      if (input.type === 'checkbox') input.checked = value;
      else {
        if (input.tagName === 'SELECT') options(input, [], value, input.options[0]?.textContent || 'Predeterminado', true);
        input.value = Array.isArray(value) ? value.join('\n') : value;
      }
    }
    engine();
  }
  function readSettings() {
    const settings = { ...getState().settings };
    for (const key of Object.keys(settings)) {
      const e = form.elements[key]; if (!e) continue;
      settings[key] = e.type === 'checkbox' ? e.checked : e.type === 'number' || key === 'Speaker' ? Number(e.value) : ['Blocked', 'BlockedUsers'].includes(key) ? e.value.split('\n').map(w => w.trim()).filter(Boolean) : e.value;
    }
    return settings;
  }
  function options(select, items, selected, placeholder, append = false) {
    const nodes = [];
    const option = (value, text) => { const e = document.createElement('option'); e.value = value; e.textContent = text; return e; };
    if (!append) { nodes.push(option('', placeholder)); for (const item of items) nodes.push(option(item.id ?? item.path, item.name)); }
    const existing = append ? Array.from(select.options) : nodes;
    if (selected && !existing.some(e => e.value === selected)) nodes.push(option(selected, 'Actual · ' + selected));
    if (append) select.append(...nodes); else select.replaceChildren(...nodes);
    select.value = selected || '';
  }
  function engine() {
    const piper = form.elements.Engine.value === 'Piper';
    $('#piper-options').hidden = !piper; $('#windows-options').hidden = piper;
  }
  function speakers(resources) {
    const model = resources?.models?.find(item => item.path === form.elements.Model.value);
    const selected = String(form.elements.Speaker.value || '0');
    const items = model?.speakers || [{ id: '0', name: 'Hablante predeterminado' }];
    options(form.elements.Speaker, items, items.some(item => item.id === selected) ? selected : '0', 'Predeterminado');
  }
  async function save() {
    if (!getState()) { notice('Espera a que el centro termine de conectar.'); return false; }
    if (await api('settings', readSettings())) { $('#tts-save-status').textContent = 'Configuración guardada'; return true; }
    return false;
  }
  function renderCatalog(resources) {
    const search = $('#catalog-search').value.trim().toLowerCase();
    const items = (resources.catalog || []).filter(v => !search || `${v.id} ${v.name} ${v.language}`.toLowerCase().includes(search));
    const selected = $('#voice-catalog').value;
    options($('#voice-catalog'), items, items.some(v => v.id === selected) ? selected : '', items.length ? 'Elige una voz' : 'Sin resultados');
    catalogInfo();
  }
  function catalogInfo() {
    const item = getState()?.tts.resources?.catalog.find(v => v.id === $('#voice-catalog').value);
    $('#catalog-info').textContent = item ? `${item.language} · ${item.size} MB aproximados. Descarga el modelo y su ficha de licencia.` : 'Consulta el catálogo y selecciona una voz para ver sus detalles.';
    $('#voice-source').hidden = !item;
    if (item) $('#voice-source').href = item.source;
  }
  function render(state) {
    if (!state.tts.resources) {
      $('#tts-error').textContent = 'El servidor abierto es una versión anterior. Cierra su consola y vuelve a abrir Iniciar.cmd para cargar las voces Piper. No necesitas reinstalarlas.';
      $('#piper-status').textContent = 'Reinicia Live Studio para detectar los modelos existentes.';
      return;
    }
    const resources = state.tts.resources || { voices: [], devices: [], models: [], catalog: [] };
    if (!initialized) { writeSettings(state.settings); initialized = true; }
    const nextKey = JSON.stringify([resources.voices, resources.devices, resources.models, resources.piperPath]);
    if (nextKey !== resourceKey) {
      options(form.elements.Voice, resources.voices || [], form.elements.Voice.value, 'Voz predeterminada de Windows');
      options(form.elements.AudioDevice, resources.devices || [], form.elements.AudioDevice.value, 'Dispositivo predeterminado de Windows');
      options(form.elements.Model, resources.models || [], form.elements.Model.value, 'Selecciona un modelo instalado');
      if (!form.elements.PiperExe.value && resources.piperPath) form.elements.PiperExe.value = resources.piperPath;
      $('#piper-status').textContent = resources.piperPath ? 'Motor detectado · elige un modelo y prueba la voz.' : 'Instala Piper o selecciona un motor existente.';
      $('#installed-models').replaceChildren(...(resources.models || []).map(model => {
        const p = document.createElement('p'); p.textContent = model.name + (model.managed ? ' · En Live Studio' : ' · Existente'); return p;
      }));
      resourceKey = nextKey;
      speakers(resources);
    }
    if (resources.picked && resources.picked.id !== pickedId) {
      const pick = resources.picked;
      if (pick.kind === 'model') { form.elements.Engine.value = 'Piper'; form.elements.Model.value = pick.path; speakers(resources); engine(); }
      else form.elements.PiperExe.value = pick.path;
      pickedId = pick.id; dirty(); notice('Archivo preparado. Prueba la voz y guarda los cambios para aplicarlos al chat.');
    }
    const nextCatalog = JSON.stringify(resources.catalog);
    if (nextCatalog !== catalogKey) { renderCatalog(resources); catalogKey = nextCatalog; }
    const task = resources.task;
    $('#tts-task').hidden = !task;
    if (task) { $('#tts-task-name').textContent = task.name; $('#tts-task-message').textContent = task.message; $('#tts-progress').value = task.progress; }
    for (const id of ['tts-refresh', 'pick-model', 'library-import', 'pick-piper', 'install-piper', 'load-catalog', 'download-voice']) $('#' + id).disabled = !!task?.running;
    $('#tts-current').textContent = state.tts.current ? `${state.tts.current.user}: ${state.tts.current.text}` : 'Sin mensaje en reproducción';
    $('#tts-error').textContent = state.tts.lastError || resources.error || '';
    $('#tts-metrics').textContent = `${state.tts.metrics?.completed || 0} LEÍDOS`;
    $('#tts-queue-list').replaceChildren(...(state.tts.items || []).map(item => {
      const row = document.createElement('div'), text = document.createElement('span'), remove = document.createElement('button');
      text.textContent = `${item.user}: ${item.text}`; remove.textContent = 'Quitar'; remove.onclick = () => api('tts/remove', { id: item.id });
      row.append(text, remove); return row;
    }));
  }
  form.addEventListener('input', dirty);
  form.elements.Engine.addEventListener('change', engine);
  form.elements.Model.addEventListener('change', () => { speakers(getState().tts.resources); dirty(); });
  form.onsubmit = async event => { event.preventDefault(); if (await save()) notice('Configuración guardada.'); };
  document.querySelectorAll('[data-tts-tab]').forEach(button => { button.onclick = () => {
    document.querySelectorAll('[data-tts-page]').forEach(page => { page.hidden = page.dataset.ttsPage !== button.dataset.ttsTab; });
    document.querySelectorAll('[data-tts-tab]').forEach(tab => tab.setAttribute('aria-selected', String(tab === button)));
  }; });
  $('#preview-voice').onclick = () => getState() ? api('tts/preview', { text: $('#preview-text').value, settings: readSettings() }) : notice('Espera a que el centro termine de conectar.');
  $('#connect').onclick = async () => { if (await save()) await api('connect'); };
  $('#clear-queue').onclick = () => api('tts/clear');
  $('#tts-refresh').onclick = () => api('tts/refresh');
  $('#windows-voices').onclick = () => api('tts/windows-voices');
  for (const id of ['pick-model', 'library-import']) $('#' + id).onclick = () => api('tts/pick', { kind: 'model' });
  $('#pick-piper').onclick = () => api('tts/pick', { kind: 'piper' });
  $('#install-piper').onclick = () => api('tts/install-piper');
  $('#load-catalog').onclick = () => api('tts/catalog');
  $('#download-voice').onclick = () => api('tts/download', { id: $('#voice-catalog').value });
  $('#catalog-search').value = 'es_';
  $('#catalog-search').oninput = () => renderCatalog(getState().tts.resources || {});
  $('#voice-catalog').onchange = catalogInfo;
  $('#export-tts').onclick = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(getState().settings, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'live-studio-tts.json'; link.click(); URL.revokeObjectURL(url);
  };
  $('#import-tts').onclick = () => $('#import-tts-file').click();
  $('#import-tts-file').onchange = async event => {
    try {
      const file = event.target.files[0]; if (!file) return;
      if (file.size > 20000) throw new Error('La configuración supera 20 KB');
      const imported = JSON.parse((await file.text()).replace(/^\uFEFF/, ''));
      if (!imported || typeof imported !== 'object' || Array.isArray(imported)) throw new Error('El archivo debe contener un objeto de configuración');
      // Validate through the backend before persisting, including compatibility defaults.
      if (await api('settings', { ...getState().settings, ...imported })) {
        writeSettings({ ...getState().settings, ...imported }); $('#tts-save-status').textContent = 'Configuración guardada'; notice('Configuración importada y guardada.');
      }
    } catch (error) { notice(error.message); }
    event.target.value = '';
  };
  return { render, save, readSettings };
};
