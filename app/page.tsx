"use client";

import { useEffect, useMemo, useState } from "react";

type View = "portal" | "login" | "dashboard" | "expediente" | "detalhe" | "repositorio" | "relatorios" | "unidades";

const demoDocs = [
  { id: "MTGAS/ENT/2026/0842", assunto: "Proposta de Plano de Formação do SIMA", origem: "Direcção de Planificação e Cooperação", destino: "Gabinete de S. Excia. Ministra", tipo: "Nota", entrada: "18 Jul 2026", prazo: "22 Jul 2026", estado: "Em despacho", prioridade: "Alta", progress: 72 },
  { id: "MTGAS/ENT/2026/0839", assunto: "Balanço do PESOE — I Semestre 2026", origem: "Direcção Nacional de Acção Social", destino: "Direcção de Planificação e Cooperação", tipo: "Relatório", entrada: "17 Jul 2026", prazo: "24 Jul 2026", estado: "Em análise", prioridade: "Normal", progress: 55 },
  { id: "MTGAS/SAI/2026/0617", assunto: "Pedido de actualização dos indicadores provinciais", origem: "Direcção de Planificação e Cooperação", destino: "Delegações Provinciais", tipo: "Ofício", entrada: "16 Jul 2026", prazo: "19 Jul 2026", estado: "Enviado", prioridade: "Alta", progress: 100 },
  { id: "MTGAS/INT/2026/0441", assunto: "Requisição de equipamento informático", origem: "Direcção de Administração e Finanças", destino: "Departamento de Aquisições", tipo: "Informação", entrada: "15 Jul 2026", prazo: "25 Jul 2026", estado: "Em tramitação", prioridade: "Normal", progress: 38 },
  { id: "MTGAS/ENT/2026/0821", assunto: "Relatório mensal de execução — INAS", origem: "Instituto Nacional de Acção Social", destino: "Gabinete de Estudos", tipo: "Relatório", entrada: "14 Jul 2026", prazo: "20 Jul 2026", estado: "Concluído", prioridade: "Normal", progress: 100 },
];

const units = ["Gabinete da Ministra", "Direcção Nacional do Trabalho", "Direcção Nacional do Género", "Direcção Nacional de Acção Social", "Direcção Nacional do Trabalho Migratório", "Direcção Nacional da Criança", "Direcção Nacional de Observação do Mercado do Trabalho", "Direcção de Planificação e Cooperação", "Direcção de Administração e Recursos Humanos", "Gabinete Jurídico", "Departamento de Tecnologias de Informação e Comunicação"];
const supervised = ["Instituto Nacional de Segurança Social", "Inspecção-Geral do Trabalho", "Comissão de Mediação e Arbitragem Laboral", "Instituto Nacional de Acção Social, IP"];
type DemoUser = { id:string; name:string; email:string; password:string; unit:string; role:string; initials:string };
const demoUsers: DemoUser[] = [
  { id:"dpc", name:"Sérgio Ndimande", email:"sergio.demo", password:"SIGED2026", unit:"Direcção de Planificação e Cooperação", role:"Administrador", initials:"SN" },
  { id:"secretaria", name:"Maria Cossa", email:"secretaria.demo", password:"SEC2026", unit:"Secretaria Central", role:"Gestora de Expediente", initials:"MC" },
  { id:"gabinete", name:"Ana Mucavele", email:"gabinete.demo", password:"GAB2026", unit:"Gabinete da Ministra", role:"Despacho", initials:"AM" },
  { id:"inas", name:"João Nhantumbo", email:"inas.demo", password:"INAS2026", unit:"Instituto Nacional de Acção Social, IP", role:"Utilizador Institucional", initials:"JN" },
];

const Icon = ({ name }: { name: string }) => {
  const map: Record<string, string> = { home:"⌂", inbox:"↓", send:"↗", flow:"⇄", archive:"▣", chart:"▥", unit:"◇", bell:"●", search:"⌕", file:"▤", clock:"◷", check:"✓", plus:"＋", arrow:"→", shield:"◆", menu:"☰", back:"←" };
  return <span className="icon" aria-hidden="true">{map[name] || "•"}</span>;
};

export default function Home() {
  const [view, setView] = useState<View>("portal");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [documents, setDocuments] = useState<any[]>(demoDocs);
  const [selected, setSelected] = useState<any>(demoDocs[0]);
  const [newOpen, setNewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<DemoUser | null>(null);
  const filtered = useMemo(() => documents.filter(d => (d.assunto + d.id + d.origem).toLowerCase().includes(query.toLowerCase())), [documents, query]);
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2600); };
  const mapDocument = (d:any) => ({ dbId:d.id, id:d.reference, assunto:d.subject, origem:d.origin, destino:d.destination, tipo:d.documentType, entrada:new Date(d.createdAt).toLocaleDateString("pt-MZ"), prazo:d.deadline ? new Date(d.deadline).toLocaleDateString("pt-MZ") : "Sem prazo", estado:d.status, prioridade:d.priority, progress:d.progress });
  useEffect(() => { fetch("/api/documents").then(r => r.ok ? r.json() : Promise.reject()).then(data => setDocuments(data.documents.map(mapDocument))).catch(() => {}); }, []);
  const createDocument = async (payload:any, file?:File) => {
    setSaving(true);
    try {
      const response = await fetch("/api/documents", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível registar");
      if (file) { const form=new FormData(); form.append("documentId",String(data.document.id)); form.append("file",file); const upload=await fetch("/api/uploads",{method:"POST",body:form}); if(!upload.ok) notify("Expediente registado; o anexo deverá ser reenviado") }
      const mapped=mapDocument(data.document); setDocuments(current => [mapped,...current]); setSelected(mapped); setNewOpen(false); notify(`Expediente ${mapped.id} registado com sucesso`);
    } catch (error) { notify(error instanceof Error ? error.message : "Erro no registo"); }
    finally { setSaving(false); }
  };

  if (view === "portal") return <Portal onEnter={() => setView("login")} />;
  if (view === "login") return <Login onBack={() => setView("portal")} onLogin={(account) => { setUser(account); setView("dashboard"); }} />;
  const logout = () => { setUser(null); setView("login"); setQuery(""); setNewOpen(false); };
  const activeUser = user ?? demoUsers[0];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand brand-button" onClick={() => setView("portal")} aria-label="Voltar ao portal">
          <span className="brand-mark"><span>MT</span></span>
          <span><b>SIGED</b><small>Sistema Integrado de Gestão de Expediente</small></span>
        </button>
        <nav>
          <p>VISÃO GERAL</p>
          <Nav icon="home" label="Painel principal" active={view === "dashboard"} onClick={() => setView("dashboard")} />
          <p>EXPEDIENTE</p>
          <Nav icon="inbox" label="Documentos recebidos" badge="12" active={view === "expediente"} onClick={() => setView("expediente")} />
          <Nav icon="send" label="Documentos enviados" onClick={() => setView("expediente")} />
          <Nav icon="flow" label="Em tramitação" badge="7" onClick={() => setView("expediente")} />
          <Nav icon="clock" label="Prazos e pendências" badge="3" onClick={() => setView("expediente")} />
          <p>GESTÃO</p>
          <Nav icon="archive" label="Repositório digital" active={view === "repositorio"} onClick={() => setView("repositorio")} />
          <Nav icon="chart" label="Relatórios" active={view === "relatorios"} onClick={() => setView("relatorios")} />
          <Nav icon="unit" label="Unidades e tuteladas" active={view === "unidades"} onClick={() => setView("unidades")} />
        </nav>
        <div className="help-card"><b>Precisa de ajuda?</b><span>Consulte o manual do utilizador ou contacte o suporte.</span><button onClick={() => notify("Centro de ajuda aberto")}>Centro de ajuda <Icon name="arrow" /></button></div>
        <div className="side-user"><span className="avatar">{activeUser.initials}</span><span><b>{activeUser.name}</b><small>{activeUser.role}</small></span><button onClick={logout} title="Terminar sessão">↪</button></div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div className="mobile-brand">SIGED</div>
          <label className="global-search"><Icon name="search" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Pesquisar por assunto, número ou remetente..." /><kbd>⌘ K</kbd></label>
          <div className="top-actions"><button className="round" aria-label="Notificações"><Icon name="bell" /><i /></button><span className="divider"/><div className="user-chip"><span className="avatar">{activeUser.initials}</span><span><b>{activeUser.name}</b><small>{activeUser.unit}</small></span><button className="logout-button" onClick={logout}>Sair ↪</button></div></div>
        </header>
        <section className="content">
          {view === "dashboard" && <Dashboard user={activeUser} setView={setView} select={(d) => { setSelected(d); setView("detalhe"); }} notify={notify} filtered={filtered} openNew={() => setNewOpen(true)} />}
          {view === "expediente" && <Expediente docs={filtered} select={(d) => { setSelected(d); setView("detalhe"); }} notify={notify} openNew={() => setNewOpen(true)} />}
          {view === "detalhe" && <DocumentDetail doc={selected} back={() => setView("dashboard")} notify={notify} />}
          {view === "repositorio" && <Repository query={query} notify={notify} />}
          {view === "relatorios" && <Reports notify={notify} />}
          {view === "unidades" && <Units />}
        </section>
      </main>
      {toast && <div className="toast"><Icon name="check" />{toast}</div>}
      {newOpen && <NewDocument close={() => setNewOpen(false)} save={createDocument} saving={saving} />}
    </div>
  );
}

function Portal({ onEnter }: { onEnter: () => void }) {
  return <main className="portal">
    <div className="portal-strip" />
    <header className="portal-header">
      <div className="portal-logo"><span className="crest">MZ</span><span><b>REPÚBLICA DE MOÇAMBIQUE</b><strong>MINISTÉRIO DO TRABALHO, GÉNERO E ACÇÃO SOCIAL</strong></span></div>
      <nav><a href="#sobre">Sobre o SIGED</a><a href="#servicos">Serviços</a><a href="#unidades">Unidades</a><a href="#contacto">Contactos</a></nav>
      <button className="access" onClick={onEnter}><Icon name="shield" /> Entrar no sistema</button>
    </header>
    <section className="hero">
      <div className="hero-grid" />
      <div className="hero-copy">
        <span className="eyebrow"><i /> SIGED — SISTEMA INTEGRADO DE GESTÃO DE EXPEDIENTE</span>
        <h1>Expediente mais <em>rápido, seguro</em> e transparente.</h1>
        <p>Uma plataforma única para registar, encaminhar, acompanhar e arquivar documentos entre todas as unidades orgânicas e instituições tuteladas do MTGAS.</p>
        <div className="hero-buttons"><button className="primary" onClick={onEnter}>Aceder ao SIGED <Icon name="arrow" /></button><button className="secondary" onClick={() => document.getElementById("sobre")?.scrollIntoView({ behavior:"smooth" })}>Conhecer a plataforma</button></div>
        <div className="trust"><span><Icon name="check" /> Rastreabilidade integral</span><span><Icon name="check" /> Repositório central</span><span><Icon name="check" /> Dados protegidos</span></div>
      </div>
      <div className="hero-visual">
        <div className="orbit orbit-one"/><div className="orbit orbit-two"/>
        <div className="document-stack"><div className="paper back"/><div className="paper mid"/><div className="paper front"><div className="paper-head"><span className="mini-logo">MT</span><i/><i/></div><span/><span/><span className="short"/><div className="stamp">DIGITAL<br/><b>✓</b></div></div></div>
        <div className="float-card fc-one"><span><Icon name="flow" /></span><div><b>Em tramitação</b><small>7 documentos activos</small></div></div>
        <div className="float-card fc-two"><span><Icon name="check" /></span><div><b>Despacho concluído</b><small>Há poucos minutos</small></div></div>
      </div>
    </section>
    <section className="portal-stats"><div><b>100%</b><span>Expediente rastreável</span></div><div><b>10+</b><span>Unidades integradas</span></div><div><b>24/7</b><span>Acesso ao repositório</span></div><div><b>−60%</b><span>Tempo de tramitação</span></div></section>
    <section className="portal-about" id="sobre"><span className="section-label">UMA PLATAFORMA, TODO O MINISTÉRIO</span><h2>Do registo ao arquivo, tudo num único fluxo.</h2><p><strong>SIGED significa Sistema Integrado de Gestão de Expediente.</strong> A plataforma liga o nível central, as delegações e as instituições tuteladas, eliminando perdas, duplicações e atrasos.</p><div className="feature-grid" id="servicos"><Feature icon="inbox" title="Registo inteligente" text="Classificação, numeração e digitalização de todo o expediente recebido e produzido."/><Feature icon="flow" title="Tramitação controlada" text="Encaminhamento, pareceres, despachos e alertas de prazo em tempo real."/><Feature icon="archive" title="Arquivo digital" text="Pesquisa segura por assunto, referência, unidade, interveniente ou período."/><Feature icon="chart" title="Decisão informada" text="Relatórios de desempenho, pendências, prazos e volume documental por unidade."/></div></section>
    <section className="institution" id="unidades"><div><span className="section-label">SOBRE O MTGAS</span><h2>Trabalho, diálogo e protecção social.</h2><p>O MTGAS dirige, planifica, coordena, controla, monitora e avalia as políticas públicas nos domínios do trabalho, segurança social obrigatória, género e acção social.</p><div className="values"><span>Profissionalismo</span><span>Excelência</span><span>Celeridade</span><span>Transparência</span><span>Integridade</span></div><a href="https://www.mtgas.gov.mz/node/94" target="_blank" rel="noreferrer">Conhecer o Ministério <Icon name="arrow"/></a></div><div className="structure-box"><h3>Estrutura integrada</h3><b>11</b><p>Unidades orgânicas</p><b>4</b><p>Instituições tuteladas</p><small>Informação baseada no portal oficial do MTGAS</small></div></section>
    <footer id="contacto"><div className="portal-logo small"><span className="crest">MZ</span><span><b>MTGAS</b><strong>Trabalho, Género e Acção Social</strong></span></div><span>Av. 24 de Julho, Maputo • cidadao@mtgas.gov.mz<br/>(+258) 82 306 94 98 • 7:30–15:30</span><span>© 2026 MTGAS • Segurança · Privacidade · Suporte</span></footer>
  </main>
}

function Login({ onBack, onLogin }: { onBack:()=>void; onLogin:(user:DemoUser)=>void }) {
  const [accountId,setAccountId]=useState(demoUsers[0].id); const [email,setEmail]=useState(demoUsers[0].email); const [password,setPassword]=useState(""); const [error,setError]=useState("");
  const selectAccount=(id:string)=>{const account=demoUsers.find(u=>u.id===id)!;setAccountId(id);setEmail(account.email);setPassword("");setError("")};
  const submit=(e:React.FormEvent)=>{e.preventDefault();const account=demoUsers.find(u=>u.id===accountId);if(!account||account.email!==email.trim().toLowerCase()||account.password!==password){setError("Correio institucional ou palavra-passe incorrectos.");return}onLogin(account)};
  return <main className="login-page"><button className="login-back" onClick={onBack}><Icon name="back"/> Portal institucional</button><section className="login-panel"><div className="login-brand"><span className="crest">MZ</span><b>REPÚBLICA DE MOÇAMBIQUE</b><strong>MINISTÉRIO DO TRABALHO, GÉNERO E ACÇÃO SOCIAL</strong><i/><h1>Bem-vindo ao SIGED</h1><p><b>Sistema Integrado de Gestão de Expediente.</b><br/>Acesso reservado aos funcionários e agentes autorizados do MTGAS.</p><div className="demo-accounts"><b>CONTAS FICTÍCIAS DE DEMONSTRAÇÃO</b>{demoUsers.map(u=><span key={u.id}><strong>{u.name}</strong><small>{u.email} • código: {u.password}</small></span>)}</div></div><form onSubmit={submit}><label>Utilizador / perfil<select value={accountId} onChange={e=>selectAccount(e.target.value)}>{demoUsers.map(u=><option value={u.id} key={u.id}>{u.name} — {u.role}</option>)}</select></label><label>Identificador de teste<input type="text" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Código de acesso demonstrativo<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Introduza o código de teste" required/></label>{error&&<p className="login-error">Identificador ou código incorrecto.</p>}<div className="login-options"><label><input type="checkbox" defaultChecked/> Manter sessão</label><a>Recuperar acesso</a></div><button className="primary" type="submit"><Icon name="shield"/> Entrar no sistema</button><small>Estas contas são fictícias e destinam-se exclusivamente à demonstração do protótipo.</small></form></section></main>
}

function Dashboard({ user, setView, select, notify, filtered, openNew }: any) {
  return <><div className="page-title"><div><span className="breadcrumb">SIGED / Painel principal</span><h1>Bom dia, {user.name.split(" ")[0]} <span>👋</span></h1><p>Acompanhe o movimento do expediente e as prioridades de hoje.</p></div><button className="primary compact" onClick={openNew}><Icon name="plus" /> Registar expediente</button></div>
    <div className="alert"><span className="alert-icon">!</span><div><b>3 documentos aproximam-se do prazo</b><p>Existem expedientes que exigem a sua atenção nas próximas 48 horas.</p></div><button onClick={() => setView("expediente")}>Ver pendências <Icon name="arrow" /></button></div>
    <div className="metric-grid"><Metric icon="inbox" value="128" label="Recebidos este mês" trend="+12,4%" color="green"/><Metric icon="send" value="94" label="Enviados este mês" trend="+8,7%" color="blue"/><Metric icon="flow" value="37" label="Em tramitação" sub="7 sob sua responsabilidade" color="orange"/><Metric icon="check" value="86%" label="Dentro do prazo" trend="+4,2%" color="purple"/></div>
    <div className="dashboard-grid"><section className="panel recent"><div className="panel-head"><div><h2>Expediente recente</h2><p>Últimos documentos movimentados na sua unidade</p></div><button onClick={() => setView("expediente")}>Ver todos <Icon name="arrow" /></button></div><div className="doc-table"><div className="tr th"><span>DOCUMENTO / ASSUNTO</span><span>ORIGEM</span><span>ENTRADA</span><span>ESTADO</span><span /></div>{filtered.slice(0,5).map((d:any) => <DocRow key={d.id} d={d} select={select}/>)}</div></section>
    <section className="panel activity"><div className="panel-head"><div><h2>Actividade recente</h2><p>Movimentos da sua equipa</p></div><button>•••</button></div><Timeline/><button className="full-link" onClick={() => setView("expediente")}>Ver histórico completo</button></section></div>
    <div className="bottom-grid"><section className="panel flow-panel"><div className="panel-head"><div><h2>Fluxo de tramitação</h2><p>Distribuição actual dos documentos</p></div><select><option>Este mês</option><option>Este trimestre</option></select></div><div className="flow-bars"><Flow label="Recepção e registo" value={128} pct={100}/><Flow label="Distribuição" value={105} pct={82}/><Flow label="Em análise / parecer" value={67} pct={52}/><Flow label="Em despacho" value={41} pct={32}/><Flow label="Concluídos / arquivados" value={86} pct={67}/></div></section><section className="panel deadline"><div className="panel-head"><div><h2>Próximos prazos</h2><p>Documentos a exigir atenção</p></div></div>{filtered.slice(0,3).map((d:any,i:number)=><button className="deadline-item" onClick={()=>select(d)} key={d.id}><span className={i===0?"date urgent":"date"}><b>{[20,21,22][i]}</b>JUL</span><span><b>{d.assunto}</b><small>{d.id}</small></span><i>{i===0?"Hoje":i===1?"Amanhã":"2 dias"}</i></button>)}</section></div>
  </>;
}

function Expediente({ docs, select, notify, openNew }: any) { return <><div className="page-title"><div><span className="breadcrumb">SIGED / Expediente</span><h1>Gestão de expediente</h1><p>Consulte, filtre e acompanhe todos os documentos.</p></div><button className="primary compact" onClick={openNew}><Icon name="plus"/> Novo expediente</button></div><section className="panel full-panel"><div className="filter-row"><button className="filter active">Todos <b>{docs.length}</b></button><button className="filter">Recebidos</button><button className="filter">Enviados</button><button className="filter">Pendentes</button><select><option>Todas as unidades</option>{units.map(u=><option key={u}>{u}</option>)}</select><button className="export" onClick={()=>notify("Lista exportada com sucesso")}>⇩ Exportar</button></div><div className="doc-table large"><div className="tr th"><span>REFERÊNCIA / ASSUNTO</span><span>ORIGEM → DESTINO</span><span>PRAZO</span><span>ESTADO</span><span>PROGRESSO</span></div>{docs.map((d:any)=><div className="tr clickable" key={d.id} onClick={()=>select(d)}><span><b>{d.assunto}</b><small>{d.id} • {d.tipo}</small></span><span><b>{d.origem}</b><small>→ {d.destino}</small></span><span><b>{d.prazo}</b><small>{d.prioridade}</small></span><span><Status text={d.estado}/></span><span><i className="progress"><i style={{width:`${d.progress}%`}}/></i><small>{d.progress}%</small></span></div>)}</div></section></> }

function DocumentDetail({ doc, back, notify }: any) { const steps=["Recebido e registado","Classificado pela Secretaria","Encaminhado à unidade","Em análise técnica","Aguarda despacho"]; return <><button className="back" onClick={back}><Icon name="back"/> Voltar à lista</button><div className="detail-head"><div><span className="doc-type">{doc.tipo}</span><h1>{doc.assunto}</h1><p>{doc.id}</p></div><div><button className="secondary small" onClick={()=>notify("Documento descarregado")}>⇩ Descarregar</button><button className="primary compact" onClick={()=>notify("Expediente encaminhado para despacho")}>Encaminhar <Icon name="arrow"/></button></div></div><div className="detail-grid"><section className="panel detail-card"><h2>Dados do expediente</h2><dl><div><dt>Origem</dt><dd>{doc.origem}</dd></div><div><dt>Destino actual</dt><dd>{doc.destino}</dd></div><div><dt>Data de entrada</dt><dd>{doc.entrada}</dd></div><div><dt>Prazo de resposta</dt><dd>{doc.prazo}</dd></div><div><dt>Prioridade</dt><dd>{doc.prioridade}</dd></div><div><dt>Estado</dt><dd><Status text={doc.estado}/></dd></div></dl><h3>Descrição</h3><p>Documento submetido para apreciação e tomada de decisão, acompanhado dos respectivos anexos e elementos de suporte.</p><h3>Ficheiros anexos</h3><button className="attachment" onClick={()=>notify("Anexo aberto")}><span>PDF</span><div><b>{doc.assunto}.pdf</b><small>2,4 MB • Documento principal</small></div><Icon name="arrow"/></button></section><section className="panel tracking"><div className="panel-head"><div><h2>Percurso do documento</h2><p>Rastreabilidade completa</p></div><Status text={doc.estado}/></div><div className="track-list">{steps.map((s,i)=><div className={i<4?"track done":"track current"} key={s}><span>{i<4?"✓":i+1}</span><div><b>{s}</b><p>{["Secretaria-Geral • 18 Jul, 09:14","Maria Cossa • 18 Jul, 09:32","Secretaria DPC • 18 Jul, 10:05","Sérgio Ndimande • 18 Jul, 14:22","Gabinete de S. Excia. Ministra"][i]}</p></div>{i<4&&<small>{["0 min","18 min","33 min","4h 17m"][i]}</small>}</div>)}</div></section></div></> }

function Repository({ notify }:any) { const cats=[{n:"Ofícios",v:1248,c:"#167a50"},{n:"Relatórios",v:687,c:"#3478c9"},{n:"Notas",v:532,c:"#c58a24"},{n:"Despachos",v:419,c:"#7c59bd"}]; return <><div className="page-title"><div><span className="breadcrumb">SIGED / Repositório</span><h1>Repositório digital</h1><p>Arquivo central, seguro e pesquisável do MTGAS.</p></div><button className="primary compact" onClick={()=>notify("Use Novo expediente para carregar um documento")}><Icon name="plus"/> Carregar documento</button></div><div className="repository-hero"><Icon name="archive"/><div><h2>Encontre qualquer documento em segundos</h2><p>Pesquise por referência, assunto, unidade, tipo ou período.</p><label><Icon name="search"/><input placeholder="Ex.: PESOE 2026, ofício 614, INAS..."/><button>Pesquisar</button></label></div></div><div className="repo-grid">{cats.map(c=><button className="folder" key={c.n} onClick={()=>notify(`${c.n}: pasta aberta`)}><span style={{background:c.c}}>▰</span><div><b>{c.n}</b><small>{c.v.toLocaleString("pt-PT")} documentos</small></div><Icon name="arrow"/></button>)}</div></> }

function Reports({ notify }:any) { return <><div className="page-title"><div><span className="breadcrumb">SIGED / Relatórios</span><h1>Relatórios e indicadores</h1><p>Monitoria do desempenho e fluxo documental do Ministério.</p></div><button className="primary compact" onClick={()=>notify("Relatório PDF gerado com sucesso")}>⇩ Gerar relatório</button></div><div className="metric-grid"><Metric icon="file" value="2.886" label="Documentos registados" trend="+14,2%" color="green"/><Metric icon="clock" value="3,2 dias" label="Tempo médio de resposta" trend="−0,8 dias" color="blue"/><Metric icon="check" value="86%" label="Cumprimento de prazos" trend="+4,2%" color="purple"/><Metric icon="unit" value="10" label="Unidades activas" sub="100% integradas" color="orange"/></div><div className="report-grid"><section className="panel chart-card"><div className="panel-head"><div><h2>Movimento mensal</h2><p>Documentos recebidos e concluídos em 2026</p></div><select><option>Últimos 6 meses</option></select></div><div className="legend"><span><i className="green-dot"/> Recebidos</span><span><i className="blue-dot"/> Concluídos</span></div><div className="bar-chart">{[[78,62],[63,58],[82,71],[70,65],[92,76],[86,69]].map((b,i)=><div className="bar-group" key={i}><div><i style={{height:`${b[0]}%`}}/><i style={{height:`${b[1]}%`}}/></div><span>{["Fev","Mar","Abr","Mai","Jun","Jul"][i]}</span></div>)}</div></section><section className="panel unit-performance"><div className="panel-head"><div><h2>Desempenho por unidade</h2><p>Cumprimento de prazos</p></div></div>{[["DPC",94],["DAF",89],["DNAS",87],["DNT",83],["IGT",78]].map(u=><Flow key={u[0]} label={u[0] as string} value={`${u[1]}%`} pct={u[1] as number}/>)}</section></div></> }

function Units(){ const all=[...units,...supervised]; return <><div className="page-title"><div><span className="breadcrumb">SIGED / Estrutura</span><h1>Unidades orgânicas e tuteladas</h1><p>Estrutura institucional baseada na informação oficial do MTGAS.</p></div></div><div className="units-grid">{all.map((u,i)=><article className="unit-card" key={u}><span className="unit-symbol">{u.split(" ").filter(x=>x.length>2).slice(0,2).map(x=>x[0]).join("")}</span><div><h3>{u}</h3><p>{i>=units.length?"Instituição tutelada":"Unidade orgânica"}</p><span><i className="online"/> Activa no SIGED</span></div><b>{[82,128,74,96,57,113,68,144,121,53,45,168,92,74,154][i]}</b><small>expedientes</small></article>)}</div></> }

function NewDocument({close,save,saving}:{close:()=>void;save:(payload:any,file?:File)=>void;saving:boolean}){return <div className="modal-backdrop" onMouseDown={close}><form className="modal" onMouseDown={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);save({flowType:f.get("flowType"),documentType:f.get("documentType"),subject:f.get("subject"),origin:f.get("origin"),destination:f.get("destination"),priority:f.get("priority"),deadline:f.get("deadline"),notes:f.get("notes")},(f.get("file") as File)?.size ? f.get("file") as File : undefined)}}><div className="modal-head"><div><span>NOVO REGISTO</span><h2>Registar expediente</h2><p>Introduza os dados e encaminhe para a unidade responsável.</p></div><button type="button" onClick={close}>×</button></div><div className="form-grid"><label>Tipo de expediente<select name="flowType" required><option>Documento recebido</option><option>Documento interno</option><option>Documento de saída</option></select></label><label>Tipo documental<select name="documentType" required><option>Ofício</option><option>Nota</option><option>Relatório</option><option>Informação</option><option>Requerimento</option></select></label><label className="wide">Assunto<input name="subject" required placeholder="Assunto principal do documento"/></label><label>Entidade remetente<input name="origin" required placeholder="Instituição ou unidade de origem"/></label><label>Unidade responsável<select name="destination" required>{units.map(u=><option key={u}>{u}</option>)}</select></label><label>Prioridade<select name="priority"><option>Normal</option><option>Alta</option><option>Urgente</option></select></label><label>Prazo de resposta<input name="deadline" type="date" required/></label><label className="wide">Observações<textarea name="notes" placeholder="Resumo ou instruções de tramitação"/></label><label className="wide upload">⇧ <b>Carregar documento e anexos</b><small>PDF, DOCX, XLSX ou imagem • máximo 20 MB</small><input name="file" type="file"/></label></div><div className="modal-actions"><button type="button" className="secondary" onClick={close}>Cancelar</button><button type="submit" className="primary" disabled={saving}>{saving?"A registar...":"Registar e encaminhar"} <Icon name="arrow"/></button></div></form></div>}

function Nav({icon,label,badge,active,onClick}:any){return <button className={active?"nav-item active":"nav-item"} onClick={onClick}><Icon name={icon}/><span>{label}</span>{badge&&<b>{badge}</b>}</button>}
function Feature({icon,title,text}:any){return <article className="feature"><span><Icon name={icon}/></span><h3>{title}</h3><p>{text}</p><a>Saiba mais <Icon name="arrow"/></a></article>}
function Metric({icon,value,label,trend,sub,color}:any){return <article className="metric"><span className={`metric-icon ${color}`}><Icon name={icon}/></span><div><p>{label}</p><b>{value}</b><small className={trend?.startsWith("−")?"good":""}>{trend || sub}</small></div></article>}
function Status({text}:{text:string}){return <span className={`status ${text.toLowerCase().replaceAll(" ","-").replaceAll("í","i").replaceAll("á","a")}`}>{text}</span>}
function DocRow({d,select}:any){return <button className="tr clickable" onClick={()=>select(d)}><span><b>{d.assunto}</b><small>{d.id} • {d.tipo}</small></span><span><b>{d.origem}</b><small>{d.destino}</small></span><span><b>{d.entrada}</b><small>Prazo: {d.prazo}</small></span><span><Status text={d.estado}/></span><span className="row-arrow">›</span></button>}
function Timeline(){return <div className="timeline"><div><span className="avatar green">MC</span><p><b>Maria Cossa</b> encaminhou um documento para a DPC<small>Há 12 minutos</small></p></div><div><span className="avatar blue">JN</span><p><b>João Nhantumbo</b> emitiu parecer no expediente 0839<small>Há 34 minutos</small></p></div><div><span className="avatar gold">AM</span><p><b>Ana Mucavele</b> concluiu o despacho de um ofício<small>Há 1 hora</small></p></div><div><span className="avatar purple">SC</span><p><b>Secretaria Central</b> registou 4 novos documentos<small>Há 2 horas</small></p></div></div>}
function Flow({label,value,pct}:any){return <div className="flow-row"><span><b>{label}</b><strong>{value}</strong></span><i><i style={{width:`${pct}%`}}/></i></div>}
