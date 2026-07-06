/* ---------- Utilities ---------- */
const $ = (sel,el=document)=>el.querySelector(sel);
const $$ = (sel,el=document)=>Array.from(el.querySelectorAll(sel));
const uid = ()=> 'it_'+Math.random().toString(36).slice(2,9);
const fmt = (n)=> (isNaN(n)?0:n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const todayISO = ()=> new Date().toISOString().slice(0,10);
const dateBR = (iso)=>{
  if(!iso) return '';
  const [y,m,d]=iso.split('-');
  const meses=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  return `${parseInt(d)} de ${meses[parseInt(m)-1]} de ${y}`;
};
const addDays=(iso,days)=>{
  const dt = new Date(iso+'T00:00:00');
  dt.setDate(dt.getDate()+parseInt(days||0));
  return dt.toLocaleDateString('pt-BR');
};

function showToast(msg){
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._tm);
  showToast._tm = setTimeout(()=>t.classList.remove('show'),2200);
}

/* ---------- Storage layer (persistent, no backend) ---------- */
const Store = {
  async getQuotes(){
    try{
      const r = await window.storage.get('orcamentos:list');
      return r ? JSON.parse(r.value) : [];
    }catch(e){ return []; }
  },
  async saveQuotes(list){
    try{ await window.storage.set('orcamentos:list', JSON.stringify(list)); }
    catch(e){ showToast('Erro ao salvar. Tente novamente.'); }
  },
  async getConfig(){
    try{
      const r = await window.storage.get('orcamentos:config');
      return r ? JSON.parse(r.value) : null;
    }catch(e){ return null; }
  },
  async saveConfig(cfg){
    try{ await window.storage.set('orcamentos:config', JSON.stringify(cfg)); }
    catch(e){ /* silent */ }
  }
};

/* ---------- Default data shapes ---------- */
function blankQuote(){
  const year = new Date().getFullYear();
  return {
    id: uid(),
    numero: null, // assigned on save
    dataEmissao: todayISO(),
    validadeDias: 15,
    prazoEstimado: '30 dias úteis',
    prestador: { empresa:'', cnpj:'', contato:'', telefone:'', logo:'' },
    cliente: { nome:'', doc:'', responsavel:'', email:'' },
    itens: [ { id:uid(), tipo:'servico', desc:'', detalhe:'', qtd:1, valor:0 } ],
    desconto: 0,
    termos: 'Forma de Pagamento: Transferência Bancária / PIX ou Boleto Bancário.\nCondições: 50% de sinal no aceite da proposta e 50% na homologação/entrega final do projeto.\nInício dos Serviços: em até 5 dias úteis após confirmação do pagamento do sinal e assinatura do contrato.\nObrigações do Cliente: disponibilizar acessos e documentações necessárias em tempo hábil.',
    createdAt: Date.now()
  };
}

function calcTotals(q){
  const subtotal = q.itens.reduce((s,i)=> s + (parseFloat(i.qtd)||0)*(parseFloat(i.valor)||0), 0);
  const total = Math.max(subtotal - (parseFloat(q.desconto)||0), 0);
  return { subtotal, total };
}

/* ---------- App state ---------- */
let state = {
  view: 'list', // list | form | preview
  quotes: [],
  config: { empresa:'', cnpj:'', contato:'', telefone:'', logo:'' },
  current: null, // quote being edited
  previewId: null
};

async function init(){
  state.quotes = await Store.getQuotes();
  const cfg = await Store.getConfig();
  if(cfg) state.config = cfg;
  render();
}

/* ---------- Rendering ---------- */
function render(){
  const app = $('#app');
  app.innerHTML = `
    <div class="topbar">
      <div class="brand">
        <div class="brand-mark">O</div>
        <div class="brand-text">
          <h1>Gerador de Orçamentos</h1>
          <span>SOLUÇÕES EM TECNOLOGIA </span>
        </div>
      </div>
      <div class="tabs no-print">
        <button class="tab-btn ${state.view==='list'?'active':''}" data-nav="list">Orçamentos salvos</button>
        <button class="tab-btn ${state.view==='form'?'active':''}" data-nav="new">Novo orçamento</button>
      </div>
    </div>
    <div id="view-root"></div>
  `;

  $$('[data-nav]').forEach(b=>b.addEventListener('click', ()=>{
    if(b.dataset.nav==='list'){ state.view='list'; render(); }
    if(b.dataset.nav==='new'){ state.current = blankQuote(); Object.assign(state.current.prestador, state.config); state.view='form'; render(); }
  }));

  const root = $('#view-root');
  if(state.view==='list') renderList(root);
  else if(state.view==='form') renderForm(root);
  else if(state.view==='preview') renderPreview(root);
}

/* ----- List view ----- */
function renderList(root){
  if(state.quotes.length===0){
    root.innerHTML = `
      <div class="panel empty-state">
        <div class="icon">🧾</div>
        <p style="font-size:15px;color:var(--navy);font-weight:600;margin-bottom:6px;">Nenhum orçamento salvo ainda</p>
        <p style="margin-bottom:18px;">Crie seu primeiro orçamento preenchendo o formulário.</p>
        <button class="btn btn-primary" id="empty-new">Criar orçamento</button>
      </div>
    `;
    $('#empty-new').addEventListener('click', ()=>{
      state.current = blankQuote(); Object.assign(state.current.prestador, state.config);
      state.view='form'; render();
    });
    return;
  }

  const sorted = [...state.quotes].sort((a,b)=> b.createdAt - a.createdAt);
  root.innerHTML = `<div>${sorted.map(q=>{
    const {total} = calcTotals(q);
    return `
    <div class="quote-card" data-id="${q.id}">
      <div class="qc-left">
        <span class="qc-num">Nº ${q.numero}</span>
        <span class="qc-client">${q.cliente.nome || '(cliente não informado)'}</span>
        <span class="qc-meta">Emitido em ${dateBR(q.dataEmissao)} · válido até ${addDays(q.dataEmissao,q.validadeDias)}</span>
      </div>
      <div class="qc-total">R$ ${fmt(total)}</div>
      <div class="qc-actions">
        <button class="icon-btn" data-act="view" title="Visualizar">👁</button>
        <button class="icon-btn" data-act="edit" title="Editar">✎</button>
        <button class="icon-btn" data-act="dup" title="Duplicar">⧉</button>
        <button class="icon-btn" data-act="del" title="Excluir">🗑</button>
      </div>
    </div>`;
  }).join('')}</div>`;

  $$('.quote-card').forEach(card=>{
    const id = card.dataset.id;
    card.querySelector('[data-act="view"]').addEventListener('click', ()=>{ state.previewId=id; state.view='preview'; render(); });
    card.querySelector('[data-act="edit"]').addEventListener('click', ()=>{
      state.current = JSON.parse(JSON.stringify(state.quotes.find(q=>q.id===id)));
      state.view='form'; render();
    });
    card.querySelector('[data-act="dup"]').addEventListener('click', async ()=>{
      const orig = state.quotes.find(q=>q.id===id);
      const copy = JSON.parse(JSON.stringify(orig));
      copy.id = uid(); copy.numero = nextNumero(); copy.dataEmissao = todayISO(); copy.createdAt = Date.now();
      state.quotes.push(copy);
      await Store.saveQuotes(state.quotes);
      showToast('Orçamento duplicado');
      render();
    });
    card.querySelector('[data-act="del"]').addEventListener('click', async ()=>{
      if(!confirm('Excluir este orçamento? Esta ação não pode ser desfeita.')) return;
      state.quotes = state.quotes.filter(q=>q.id!==id);
      await Store.saveQuotes(state.quotes);
      showToast('Orçamento excluído');
      render();
    });
  });
}

function nextNumero(){
  const year = new Date().getFullYear();
  const seqs = state.quotes
    .filter(q=> (q.numero||'').startsWith(`#${year}-`))
    .map(q=> parseInt(q.numero.split('-')[1])||0);
  const next = (seqs.length? Math.max(...seqs) : 0) + 1;
  return `#${year}-${String(next).padStart(3,'0')}`;
}

/* ----- Form view ----- */
function renderForm(root){
  const q = state.current;
  root.innerHTML = `
    <div class="panel">
      <h2>Logo da empresa</h2>
      <div class="logo-row">
        <div class="logo-preview" id="logo-preview">
          ${q.prestador.logo ? `<img src="${q.prestador.logo}" alt="Logo">` : `<span>Sem logo</span>`}
        </div>
        <div class="logo-controls">
          <input type="file" id="f-logo" accept="image/png,image/jpeg,image/svg+xml,image/webp" class="no-print">
          <div class="actions" style="margin-top:10px;">
            <button class="btn btn-ghost" id="remove-logo" type="button" ${q.prestador.logo?'':'disabled'}>Remover logo</button>
          </div>
          <p class="hint">PNG, JPG, WEBP ou SVG. A imagem é redimensionada automaticamente e aparecerá no cabeçalho do orçamento em PDF.</p>
        </div>
      </div>
    </div>

    <div class="panel">
      <h2>Prestador</h2>
      <div class="grid2">
        <div class="field"><label>Empresa / Razão Social</label><input id="f-p-empresa" type="text" value="${esc(q.prestador.empresa)}" placeholder="Nome da sua empresa"></div>
        <div class="field"><label>CNPJ</label><input id="f-p-cnpj" type="text" value="${esc(q.prestador.cnpj)}" placeholder="00.000.000/0001-00"></div>
        <div class="field"><label>Contato (e-mail)</label><input id="f-p-contato" type="text" value="${esc(q.prestador.contato)}" placeholder="contato@suaempresa.com.br"></div>
        <div class="field"><label>Telefone</label><input id="f-p-telefone" type="text" value="${esc(q.prestador.telefone)}" placeholder="(82) 99999-0000"></div>
      </div>
      <p class="hint">Esses dados podem ser salvos como padrão para os próximos orçamentos.</p>
    </div>

    <div class="panel">
      <h2>Cliente</h2>
      <div class="grid2">
        <div class="field"><label>Cliente / Razão Social</label><input id="f-c-nome" type="text" value="${esc(q.cliente.nome)}" placeholder="Nome do cliente ou empresa"></div>
        <div class="field"><label>CNPJ/CPF</label><input id="f-c-doc" type="text" value="${esc(q.cliente.doc)}" placeholder="000.000.000-00"></div>
        <div class="field"><label>A/C (Responsável)</label><input id="f-c-resp" type="text" value="${esc(q.cliente.responsavel)}" placeholder="Nome do responsável"></div>
        <div class="field"><label>E-mail</label><input id="f-c-email" type="email" value="${esc(q.cliente.email)}" placeholder="cliente@email.com"></div>
      </div>
    </div>

    <div class="panel">
      <h2>Detalhes do documento</h2>
      <div class="grid2" style="grid-template-columns:1fr 1fr 1fr;">
        <div class="field"><label>Data de emissão</label><input id="f-data" type="date" value="${q.dataEmissao}"></div>
        <div class="field"><label>Validade da proposta (dias)</label><input id="f-validade" type="number" min="1" value="${q.validadeDias}"></div>
        <div class="field"><label>Prazo estimado</label><input id="f-prazo" type="text" value="${esc(q.prazoEstimado)}" placeholder="Ex: 30 dias úteis"></div>
      </div>
    </div>

    <div class="panel">
      <h2>Escopo de serviços &amp; itens</h2>
      <table class="items">
        <thead><tr>
          <th class="col-tipo">Tipo</th><th class="col-desc">Descrição</th><th class="col-qtd">Qtd</th><th class="col-val">Val. Unitário</th><th class="col-tot">Total</th><th class="col-rm"></th>
        </tr></thead>
        <tbody id="items-body">
          ${q.itens.map(item=>itemRow(item)).join('')}
        </tbody>
      </table>
      <button class="add-item-btn" id="add-item">+ Adicionar item</button>

      <div class="totals-box">
        <div class="totals-row"><span>Subtotal</span><span id="calc-subtotal">R$ 0,00</span></div>
        <div class="totals-row">
          <span>Desconto</span>
          <span><input id="f-desconto" type="number" min="0" step="0.01" value="${q.desconto}" style="width:110px;text-align:right;padding:5px 8px;"></span>
        </div>
        <div class="totals-row grand"><span>Total geral</span><span id="calc-total">R$ 0,00</span></div>
      </div>
    </div>

    <div class="panel">
      <h2>Termos e condições de pagamento</h2>
      <div class="field">
        <textarea id="f-termos" rows="6">${esc(q.termos)}</textarea>
      </div>
    </div>

    <div class="actions no-print">
      <button class="btn btn-primary" id="save-quote">Salvar orçamento</button>
      <button class="btn btn-secondary" id="preview-quote">Visualizar</button>
      <button class="btn btn-ghost" id="save-as-default">Salvar prestador como padrão</button>
      <button class="btn btn-ghost" id="cancel-form">Cancelar</button>
    </div>
  `;

  // bind field -> state helpers
  const bind = (id, path)=>{
    $(id).addEventListener('input', e=>{
      setPath(q, path, e.target.value);
      if(path.includes('desconto')||path.includes('qtd')||path.includes('valor')) updateTotalsUI();
    });
  };
  bind('#f-p-empresa','prestador.empresa'); bind('#f-p-cnpj','prestador.cnpj');
  bind('#f-p-contato','prestador.contato'); bind('#f-p-telefone','prestador.telefone');
  bind('#f-c-nome','cliente.nome'); bind('#f-c-doc','cliente.doc');
  bind('#f-c-resp','cliente.responsavel'); bind('#f-c-email','cliente.email');
  bind('#f-data','dataEmissao'); bind('#f-validade','validadeDias'); bind('#f-prazo','prazoEstimado');
  bind('#f-termos','termos'); bind('#f-desconto','desconto');

  bindItemRows();
  updateTotalsUI();

  $('#f-logo').addEventListener('change', async (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    if(!/^image\//.test(file.type)){ showToast('Selecione um arquivo de imagem válido'); return; }
    try{
      const dataUrl = await processLogoFile(file);
      q.prestador.logo = dataUrl;
      renderForm(root);
      showToast('Logo adicionada');
    }catch(err){
      showToast('Não foi possível processar essa imagem');
    }
  });

  $('#remove-logo').addEventListener('click', ()=>{
    q.prestador.logo = '';
    renderForm(root);
  });

  $('#add-item').addEventListener('click', ()=>{
    q.itens.push({ id:uid(), tipo:'servico', desc:'', detalhe:'', qtd:1, valor:0 });
    renderForm(root);
  });

  $('#save-quote').addEventListener('click', async ()=>{
    if(!q.cliente.nome.trim()){ showToast('Informe o nome do cliente antes de salvar'); return; }
    if(!q.numero) q.numero = nextNumero();
    const idx = state.quotes.findIndex(x=>x.id===q.id);
    if(idx>=0) state.quotes[idx] = q; else state.quotes.push(q);
    await Store.saveQuotes(state.quotes);
    showToast('Orçamento salvo com sucesso');
    state.previewId = q.id;
    state.view = 'preview';
    render();
  });

  $('#preview-quote').addEventListener('click', ()=>{
    state.previewId = null; // ad-hoc preview from unsaved edits
    state.view = 'preview';
    render();
  });

  $('#save-as-default').addEventListener('click', async ()=>{
    state.config = { ...q.prestador };
    await Store.saveConfig(state.config);
    showToast('Dados do prestador salvos como padrão');
  });

  $('#cancel-form').addEventListener('click', ()=>{ state.view='list'; render(); });
}

function itemRow(item){
  const tipo = item.tipo || 'servico';
  const unidLabel = tipo==='servico' ? 'Qtd/Hrs' : 'Qtd (Unid.)';
  const step = tipo==='servico' ? '0.5' : '1';
  return `
  <tr data-item="${item.id}">
    <td class="col-tipo">
      <select class="it-tipo">
        <option value="servico" ${tipo==='servico'?'selected':''}>Serviço</option>
        <option value="item" ${tipo==='item'?'selected':''}>Item (produto)</option>
      </select>
    </td>
    <td class="col-desc">
      <input type="text" class="it-desc" placeholder="${tipo==='servico'?'Nome do serviço':'Nome do item (ex: Cabo, RJ45, Régua de tomada)'}" value="${esc(item.desc)}">
      <textarea class="it-detalhe" rows="2" placeholder="Detalhamento (opcional)" style="margin-top:6px;">${esc(item.detalhe||'')}</textarea>
    </td>
    <td class="col-qtd">
      <div class="qtd-wrap">
        <input type="number" class="it-qtd" min="0" step="${step}" value="${item.qtd}">
        <span class="qtd-unit">${tipo==='servico'?'hrs':'un'}</span>
      </div>
    </td>
    <td class="col-val"><input type="number" class="it-valor" min="0" step="0.01" value="${item.valor}"></td>
    <td class="col-tot"><span class="it-total">R$ ${fmt((item.qtd||0)*(item.valor||0))}</span></td>
    <td class="col-rm"><button class="rm-btn" title="Remover item">✕</button></td>
  </tr>`;
}

function bindItemRows(){
  const q = state.current;
  $$('#items-body tr').forEach(tr=>{
    const id = tr.dataset.item;
    const item = q.itens.find(i=>i.id===id);
    tr.querySelector('.it-tipo').addEventListener('change', e=>{
      item.tipo = e.target.value;
      if(item.tipo==='item') item.qtd = Math.round(item.qtd||1) || 1;
      renderForm($('#view-root'));
    });
    tr.querySelector('.it-desc').addEventListener('input', e=>{ item.desc = e.target.value; });
    tr.querySelector('.it-detalhe').addEventListener('input', e=>{ item.detalhe = e.target.value; });
    tr.querySelector('.it-qtd').addEventListener('input', e=>{ item.qtd = parseFloat(e.target.value)||0; refreshRowTotal(tr,item); updateTotalsUI(); });
    tr.querySelector('.it-valor').addEventListener('input', e=>{ item.valor = parseFloat(e.target.value)||0; refreshRowTotal(tr,item); updateTotalsUI(); });
    tr.querySelector('.rm-btn').addEventListener('click', ()=>{
      if(q.itens.length===1){ showToast('É necessário ao menos um item'); return; }
      q.itens = q.itens.filter(i=>i.id!==id);
      renderForm($('#view-root'));
    });
  });
}
function refreshRowTotal(tr,item){
  tr.querySelector('.it-total').textContent = `R$ ${fmt((item.qtd||0)*(item.valor||0))}`;
}
function updateTotalsUI(){
  const q = state.current;
  const {subtotal,total} = calcTotals(q);
  const st = $('#calc-subtotal'); const tt = $('#calc-total');
  if(st) st.textContent = `R$ ${fmt(subtotal)}`;
  if(tt) tt.textContent = `R$ ${fmt(total)}`;
}

function setPath(obj, path, value){
  const parts = path.split('.');
  let cur = obj;
  for(let i=0;i<parts.length-1;i++) cur = cur[parts[i]];
  cur[parts[parts.length-1]] = value;
}
function esc(s){
  return (s??'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function processLogoFile(file){
  return new Promise((resolve, reject)=>{
    if(file.type === 'image/svg+xml'){
      const reader = new FileReader();
      reader.onload = ()=> resolve(reader.result);
      reader.onerror = ()=> reject(new Error('read error'));
      reader.readAsDataURL(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev)=>{
      const img = new Image();
      img.onload = ()=>{
        const maxDim = 400;
        let { width, height } = img;
        if(width > maxDim || height > maxDim){
          const scale = Math.min(maxDim/width, maxDim/height);
          width = Math.round(width*scale);
          height = Math.round(height*scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = ()=> reject(new Error('image load error'));
      img.src = ev.target.result;
    };
    reader.onerror = ()=> reject(new Error('read error'));
    reader.readAsDataURL(file);
  });
}

/* ----- Preview / document view ----- */
function renderPreview(root){
  const q = state.previewId ? state.quotes.find(x=>x.id===state.previewId) : state.current;
  if(!q){ state.view='list'; render(); return; }
  const {subtotal,total} = calcTotals(q);
  const numero = q.numero || nextNumero();

  root.innerHTML = `
    <div class="preview-toolbar no-print">
      <button class="btn btn-ghost" id="back-btn">← Voltar</button>
      <div class="actions">
        <button class="btn btn-secondary" id="edit-from-preview">Editar</button>
        <button class="btn btn-primary" id="print-btn">Imprimir / Salvar PDF</button>
      </div>
    </div>
    <div class="doc-wrap">
      <div class="doc-header">
        <div class="doc-brand">
          ${q.prestador.logo ? `<img class="doc-logo" src="${q.prestador.logo}" alt="Logo ${esc(q.prestador.empresa)}">` : ''}
          <div>
            <div class="doc-company">${esc(q.prestador.empresa) || '[Nome da Empresa]'}</div>
            <div class="doc-tag">Soluções em tecnologia &amp; segurança</div>
          </div>
        </div>
        <div class="doc-title">
          <h2>ORÇAMENTO</h2>
          <span>Nº ${numero}</span>
        </div>
      </div>
      <div class="doc-body">
        <div class="doc-grid2">
          <div class="doc-box">
            <h4>Prestador</h4>
            <p><b>${esc(q.prestador.empresa)||'—'}</b></p>
            <p>CNPJ: ${esc(q.prestador.cnpj)||'—'}</p>
            <p>Contato: ${esc(q.prestador.contato)||'—'}</p>
            <p>Telefone: ${esc(q.prestador.telefone)||'—'}</p>
          </div>
          <div class="doc-box">
            <h4>Cliente</h4>
            <p><b>${esc(q.cliente.nome)||'—'}</b></p>
            <p>CNPJ/CPF: ${esc(q.cliente.doc)||'—'}</p>
            <p>A/C: ${esc(q.cliente.responsavel)||'—'}</p>
            <p>E-mail: ${esc(q.cliente.email)||'—'}</p>
          </div>
        </div>

        <div class="doc-details">
          <div><b>Data de emissão</b><span>${dateBR(q.dataEmissao)}</span></div>
          <div><b>Validade da proposta</b><span>${q.validadeDias} dias (até ${addDays(q.dataEmissao,q.validadeDias)})</span></div>
          <div><b>Prazo estimado</b><span>${esc(q.prazoEstimado)||'—'}</span></div>
        </div>

        <div class="doc-section-title">Escopo de serviços &amp; itens</div>
        <table class="doc-items">
          <thead><tr><th>Tipo</th><th>Descrição do serviço/produto</th><th class="num">Qtd</th><th class="num">Val. unitário</th><th class="num">Total</th></tr></thead>
          <tbody>
            ${q.itens.map(i=>{
              const tipo = i.tipo || 'servico';
              const unit = tipo==='servico' ? 'hrs' : 'un';
              return `
              <tr>
                <td><span class="type-badge ${tipo}">${tipo==='servico'?'Serviço':'Item'}</span></td>
                <td><span class="desc-title">${esc(i.desc)||'(sem descrição)'}</span>${esc(i.detalhe||'')}</td>
                <td class="num">${i.qtd} ${unit}</td>
                <td class="num">R$ ${fmt(i.valor)}</td>
                <td class="num">R$ ${fmt((i.qtd||0)*(i.valor||0))}</td>
              </tr>`;}).join('')}
          </tbody>
        </table>

        <div class="doc-totals">
          <div class="row"><span>Subtotal</span><span>R$ ${fmt(subtotal)}</span></div>
          <div class="row"><span>Desconto</span><span>R$ ${fmt(q.desconto||0)}</span></div>
          <div class="row grand"><span>Total geral</span><span>R$ ${fmt(total)}</span></div>
        </div>

        <div class="doc-terms">
          <h4>Termos e condições</h4>
          ${(q.termos||'').split('\n').filter(Boolean).map(l=>`<p>${esc(l)}</p>`).join('')}
        </div>

        <div class="doc-signatures">
          <div class="sig-line"><b>${esc(q.prestador.empresa)||'[Nome do Emitente]'}</b>Prestador</div>
          <div class="sig-line"><b>${esc(q.cliente.nome)||'[Nome do Cliente]'}</b>De acordo e autorizado</div>
        </div>
      </div>
      <div class="doc-footer">Documento gerado eletronicamente · ${esc(q.prestador.empresa)||'Gerador de Orçamentos'}</div>
    </div>
  `;

  $('#back-btn').addEventListener('click', ()=>{ state.view='list'; render(); });
  $('#print-btn').addEventListener('click', ()=> window.print());
  $('#edit-from-preview').addEventListener('click', ()=>{
    state.current = JSON.parse(JSON.stringify(q));
    state.view='form'; render();
  });
}

/* ---------- Boot ---------- */
init();
