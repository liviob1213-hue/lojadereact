// VIDRO ESPACIAL — o movimento e o som do estilo, sem dependência nenhuma.
//
//   import { iniciar } from './vidro-espacial.js';
//   iniciar();
//
// iniciar() liga quatro coisas:
//   1. entrada em foco — tudo com data-ve-entrar nasce desfocado e entra em
//      foco um depois do outro (passo de 70 ms, na ordem do documento);
//   2. números que contam — data-ve-contar="3196" sobe de zero até o valor;
//   3. indicador que escorrega — em toda lista com data-ve-indicador;
//   4. sons ao clicar — sintetizados, sem arquivo de áudio.
// Cada peça também é exportada sozinha, para quem quiser só uma delas.

(function (global) {
  const reduzido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ================================================================ entrada em foco

  function entrarEmFoco(raiz = document, { passo = 70, inicio = 60 } = {}) {
    const itens = [...raiz.querySelectorAll('[data-ve-entrar]:not(.ve-dentro)')];
    itens.forEach((el, i) => el.style.setProperty('--ve-atraso', `${inicio + i * passo}ms`));
    // Dois quadros de espera: o navegador precisa pintar o estado "desfocado"
    // antes de virar a chave, senão não há transição nenhuma.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      for (const el of itens) el.classList.add('ve-dentro');
      for (const el of itens) {
        const n = el.matches('[data-ve-contar]') ? [el] : el.querySelectorAll('[data-ve-contar]');
        const atraso = parseFloat(el.style.getPropertyValue('--ve-atraso')) || 0;
        for (const alvo of n) setTimeout(() => contar(alvo), atraso + 120);
      }
    }));
    return itens.length;
  }

  // ================================================================ números que contam

  const fmt = new Intl.NumberFormat('pt-BR');

  function contar(el, { duracao = 1100 } = {}) {
    const fim = Number(el.dataset.veContar);
    if (!Number.isFinite(fim)) return;
    const casas = (el.dataset.veContar.split('.')[1] || '').length;
    const antes = el.dataset.veAntes || '';
    const depois = el.dataset.veDepois || '';
    const escrever = (v) => {
      el.textContent = antes + (casas ? v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }) : fmt.format(Math.round(v))) + depois;
    };
    if (reduzido()) return escrever(fim);
    const t0 = performance.now();
    const passo = (agora) => {
      const p = Math.min(1, (agora - t0) / duracao);
      const e = 1 - Math.pow(1 - p, 4); // desacelera no fim, como um contador mecânico
      escrever(fim * e);
      if (p < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  }

  // ================================================================ troca de tela

  // O conteúdo velho vira vidro fosco (200 ms), some, e o novo entra em foco.
  async function trocarTela(antiga, nova) {
    if (antiga === nova) return;
    if (antiga && !reduzido()) {
      antiga.classList.add('ve-saindo');
      await new Promise((r) => setTimeout(r, 200));
      antiga.classList.remove('ve-saindo');
    }
    if (antiga) antiga.hidden = true;
    nova.hidden = false;
    nova.classList.remove('ve-entrando');
    void nova.offsetWidth; // reinicia a animação mesmo se a tela já tinha entrado antes
    nova.classList.add('ve-entrando');
    // números e barras da tela nova também chegam animados
    for (const el of nova.querySelectorAll('[data-ve-entrar]')) el.classList.remove('ve-dentro');
    entrarEmFoco(nova, { passo: 50, inicio: 80 });
  }

  // ================================================================ indicador

  function indicadorDeslizante(lista, { ativo = '.ativo' } = {}) {
    if (!lista) return () => {};
    const ind = document.createElement('span');
    ind.className = 'indicador';
    ind.setAttribute('aria-hidden', 'true');
    lista.classList.add('com-indicador');
    let posto = false;
    function mover() {
      if (!ind.isConnected) lista.prepend(ind);
      const el = lista.querySelector(ativo);
      if (!el || !el.offsetWidth) { ind.style.opacity = '0'; return; }
      const pos = `translate(${el.offsetLeft}px, ${el.offsetTop}px)`;
      const w = el.offsetWidth + 'px';
      const h = el.offsetHeight + 'px';
      if (ind.style.transform === pos && ind.style.width === w && ind.style.height === h) return;
      if (!posto) ind.style.transition = 'none';
      Object.assign(ind.style, { opacity: '1', transform: pos, width: w, height: h });
      if (!posto) { ind.getBoundingClientRect(); ind.style.transition = ''; posto = true; }
    }
    new MutationObserver(mover).observe(lista, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden'] });
    new ResizeObserver(mover).observe(lista);
    mover();
    return mover;
  }

  // Lista com data-ve-indicador: clicar num item marca ele como ativo.
  function ligarListas(raiz) {
    for (const lista of raiz.querySelectorAll('[data-ve-indicador]')) {
      const sel = lista.dataset.veIndicador || '.ativo';
      const classe = sel.replace(/^\./, '');
      indicadorDeslizante(lista, { ativo: sel });
      lista.addEventListener('click', (e) => {
        const item = e.target.closest('button, [role="tab"], a');
        if (!item || !lista.contains(item)) return;
        for (const outro of lista.querySelectorAll(sel)) outro.classList.remove(classe);
        item.classList.add(classe);
      });
    }
  }

  // ================================================================ sons

  const SOM = { ligado: true, volume: 0.6 };
  let ctx = null;
  let mestre = null;
  let ultimo = 0;

  try { Object.assign(SOM, JSON.parse(localStorage.getItem('ve.som')) || {}); } catch {}

  const somLigado = () => SOM.ligado;
  function ligarSom(on) {
    SOM.ligado = !!on;
    try { localStorage.setItem('ve.som', JSON.stringify(SOM)); } catch {}
    if (on) tocar('ok');
  }

  function contexto() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; }
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC({ latencyHint: 'interactive' });
    mestre = ctx.createGain();
    mestre.gain.value = 0.5;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    mestre.connect(comp).connect(ctx.destination);
    return ctx;
  }

  function tom(c, { freq, ate = freq, dur, onda = 'sine', ganho, atraso = 0 }) {
    const t = c.currentTime + atraso;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = onda;
    o.frequency.setValueAtTime(freq, t);
    if (ate !== freq) o.frequency.exponentialRampToValueAtTime(ate, t + dur * 0.8);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(ganho * SOM.volume, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(mestre);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function estalo(c, { ganho, dur = 0.012, corte = 3200 }) {
    const n = Math.ceil(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3;
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = corte;
    const g = c.createGain();
    g.gain.value = ganho * SOM.volume;
    src.connect(f).connect(g).connect(mestre);
    src.start();
  }

  // Vidro tem timbre de vidro: os sons daqui são um pouco mais agudos e mais
  // "de cristal" que um clique de mouse comum.
  const SONS = {
    tique(c) { estalo(c, { ganho: 0.3, corte: 3800 }); tom(c, { freq: 2300, ate: 1600, dur: 0.05, ganho: 0.06 }); },
    aba(c) { estalo(c, { ganho: 0.2, corte: 2600 }); tom(c, { freq: 1180, ate: 880, dur: 0.08, onda: 'triangle', ganho: 0.08 }); },
    abrir(c) { tom(c, { freq: 660, ate: 1040, dur: 0.1, onda: 'triangle', ganho: 0.06 }); },
    fechar(c) { tom(c, { freq: 980, ate: 620, dur: 0.09, onda: 'triangle', ganho: 0.05 }); },
    ligar(c) { estalo(c, { ganho: 0.22 }); tom(c, { freq: 1500, ate: 1900, dur: 0.06, ganho: 0.06 }); },
    desligar(c) { estalo(c, { ganho: 0.22 }); tom(c, { freq: 1400, ate: 1050, dur: 0.06, ganho: 0.06 }); },
    ok(c) { tom(c, { freq: 1318.5, dur: 0.1, ganho: 0.055 }); tom(c, { freq: 1975.5, dur: 0.16, ganho: 0.045, atraso: 0.07 }); },
    erro(c) { tom(c, { freq: 240, ate: 180, dur: 0.14, onda: 'triangle', ganho: 0.1 }); },
  };

  function tocar(nome = 'tique') {
    if (!SOM.ligado || document.hidden) return;
    const agora = performance.now();
    if (agora - ultimo < 35) return;
    ultimo = agora;
    const c = contexto();
    if (!c || !SONS[nome]) return;
    try { SONS[nome](c); } catch {}
  }

  const CLICAVEL = 'button, [role="button"], [role="tab"], a[href], summary, select, input[type="checkbox"], input[type="radio"]';

  function somDoAlvo(el) {
    const marcado = el.closest('[data-som]');
    if (marcado) return marcado.dataset.som || null;
    if (el.matches('input[type="checkbox"], input[type="radio"]')) return el.checked ? 'desligar' : 'ligar';
    if (el.matches('.ve-nav-item, .ve-segmento, .ve-aba, [role="tab"]')) return 'aba';
    return 'tique';
  }

  function ligarSons(raiz = document) {
    raiz.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const el = e.target.closest?.(CLICAVEL);
      if (el && !el.disabled) { const n = somDoAlvo(el); if (n) tocar(n); }
    }, { capture: true, passive: true });
    raiz.addEventListener('keydown', (e) => {
      if (e.repeat || (e.key !== 'Enter' && e.key !== ' ')) return;
      const el = e.target.closest?.('button, [role="button"], [role="tab"]');
      if (el && !el.disabled) { const n = somDoAlvo(el); if (n) tocar(n); }
    }, { capture: true });
  }

  // ================================================================ tudo junto

  function iniciar(raiz = document) {
    ligarSons(raiz);
    ligarListas(raiz);
    entrarEmFoco(raiz);
  }

  // exposto no window para o arquivo abrir também com dois cliques (file://),
  // onde o navegador bloqueia import de módulo
  global.VidroEspacial = { entrarEmFoco, contar, trocarTela, indicadorDeslizante, somLigado, ligarSom, tocar, ligarSons, iniciar };
})(window);
