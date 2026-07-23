"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type View = "portal" | "login" | "dashboard" | "expediente" | "detalhe" | "repositorio" | "relatorios" | "unidades";
type SigedUser = { id: number; username: string; name: string; role: string; unit: string; initials: string };
type Movement = { id: number; action: string; fromUnit: string | null; toUnit: string | null; actor: string; comment: string; createdAt: string };
type Attachment = { id: number; fileName: string; contentType: string; size: number; createdAt: string };
type DocumentRecord = {
  id: number;
  reference: string;
  subject: string;
  origin: string;
  destination: string;
  documentType: string;
  flowType: string;
  priority: string;
  status: string;
  deadline: string | null;
  notes: string;
  senderReference: string;
  confidentiality: string;
  archived: boolean;
  progress: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  movements?: Movement[];
  attachments?: Attachment[];
};

const demoAccounts = [
  { username: "sergio.demo", password: "SIGED2026", name: "Sérgio Ndimande", role: "Administrador" },
  { username: "secretaria.demo", password: "SEC2026", name: "Maria Cossa", role: "Gestora de Expediente" },
  { username: "gabinete.demo", password: "GAB2026", name: "Ana Mucavele", role: "Despacho" },
  { username: "inas.demo", password: "INAS2026", name: "João Nhantumbo", role: "Utilizador Institucional" },
];

const units = [
  "Gabinete da Ministra",
  "Secretaria Central",
  "Direcção Nacional do Trabalho",
  "Direcção Nacional do Género",
  "Direcção Nacional de Acção Social",
  "Direcção Nacional do Trabalho Migratório",
  "Direcção Nacional da Criança",
  "Direcção Nacional de Observação do Mercado do Trabalho",
  "Direcção de Planificação e Cooperação",
  "Direcção de Administração e Recursos Humanos",
  "Gabinete Jurídico",
  "Departamento de Tecnologias de Informação e Comunicação",
  "Instituto Nacional de Segurança Social",
  "Inspecção-Geral do Trabalho",
  "Comissão de Mediação e Arbitragem Laboral",
  "Instituto Nacional de Acção Social, IP",
  "Serviços Provinciais",
];

const statusOptions = ["Registado", "Distribuído", "Em tramitação", "Em análise", "Em despacho", "Devolvido", "Enviado", "Concluído", "Arquivado"];

const Icon = ({ name }: { name: string }) => {
  const icons: Record<string, string> = {
    home: "⌂", inbox: "↓", send: "↗", flow: "⇄", archive: "▣", chart: "▥", unit: "◇",
    bell: "●", search: "⌕", file: "▤", clock: "◷", check: "✓", plus: "＋", arrow: "→",
    shield: "◆", menu: "☰", back: "←", logout: "↪", close: "×", download: "⇩",
  };
  return <span className="icon" aria-hidden="true">{icons[name] ?? "•"}</span>;
};

function formatDate(value: string | null) {
  if (!value) return "Sem prazo";
  return new Intl.DateTimeFormat("pt-MZ", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("pt-MZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function isOverdue(document: DocumentRecord) {
  return Boolean(document.deadline && new Date(`${document.deadline}T23:59:59`) < new Date() && !["Concluído", "Enviado", "Arquivado"].includes(document.status));
}

function daysUntil(value: string | null) {
  if (!value) return null;
  return Math.ceil((new Date(`${value}T23:59:59`).getTime() - Date.now()) / 86_400_000);
}

export default function Home() {
  const [view, setView] = useState<View>("portal");
  const [user, setUser] = useState<SigedUser | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selected, setSelected] = useState<DocumentRecord | null>(null);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [filter, setFilter] = useState("Todos");

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  };

  useEffect(() => {
    fetch("/api/auth").then((response) => response.ok ? response.json() : null).then((data) => {
      if (data?.user) setUser(data.user);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetch("/api/documents", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (active) setDocuments(data.documents);
      })
      .catch((error) => {
        if (active) notify(error instanceof Error ? error.message : "Não foi possível consultar os expedientes.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [user]);

  async function login(username: string, password: string) {
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setUser(data.user);
    setView("dashboard");
  }

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" }).catch(() => undefined);
    setUser(null);
    setDocuments([]);
    setSelected(null);
    setQuery("");
    setView("login");
  }

  async function createDocument(payload: Record<string, string>, file?: File) {
    setLoading(true);
    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      let record: DocumentRecord = data.document;
      if (file) {
        const form = new FormData();
        form.append("documentId", String(record.id));
        form.append("file", file);
        const upload = await fetch("/api/uploads", { method: "POST", body: form });
        if (!upload.ok) {
          const uploadData = await upload.json();
          notify(`Expediente registado. Anexo pendente: ${uploadData.error}`);
        } else {
          const detail = await fetch(`/api/documents?id=${record.id}`).then((result) => result.json());
          record = detail.document;
        }
      }
      setDocuments((current) => [record, ...current]);
      setSelected(record);
      setNewOpen(false);
      setView("detalhe");
      notify(`Expediente ${record.reference} registado com sucesso.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Erro no registo.");
    } finally {
      setLoading(false);
    }
  }

  async function openDocument(document: DocumentRecord) {
    setSelected(document);
    setView("detalhe");
    try {
      const response = await fetch(`/api/documents?id=${document.id}`, { cache: "no-store" });
      const data = await response.json();
      if (response.ok) setSelected(data.document);
    } catch {
      notify("O resumo foi aberto; o histórico detalhado não pôde ser actualizado.");
    }
  }

  async function updateDocument(payload: { id: number; status?: string; destination?: string; comment?: string; archived?: boolean }) {
    setLoading(true);
    try {
      const response = await fetch("/api/documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSelected(data.document);
      setDocuments((current) => current.map((document) => document.id === data.document.id ? data.document : document));
      notify(`Expediente ${data.document.reference} actualizado.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Erro ao actualizar expediente.");
    } finally {
      setLoading(false);
    }
  }

  const visibleDocuments = useMemo(() => {
    const needle = query.toLowerCase().trim();
    return documents.filter((document) => {
      const matchesText = !needle || `${document.reference} ${document.subject} ${document.origin} ${document.destination} ${document.documentType}`.toLowerCase().includes(needle);
      const matchesFilter = filter === "Todos"
        || (filter === "Recebidos" && document.flowType === "Documento recebido")
        || (filter === "Enviados" && document.flowType === "Documento de saída")
        || (filter === "Pendentes" && !["Concluído", "Enviado", "Arquivado"].includes(document.status))
        || (filter === "Atrasados" && isOverdue(document));
      return matchesText && matchesFilter;
    });
  }, [documents, filter, query]);

  if (view === "portal") return <Portal onEnter={() => setView(user ? "dashboard" : "login")} />;
  if (view === "login") return <Login onBack={() => setView("portal")} onLogin={login} />;
  if (!user) return <Login onBack={() => setView("portal")} onLogin={login} />;

  const navigate = (next: View) => {
    setView(next);
    setMobileOpen(false);
  };

  return (
    <div className="app-shell">
      <div className={mobileOpen ? "mobile-overlay show" : "mobile-overlay"} onClick={() => setMobileOpen(false)} />
      <aside className={mobileOpen ? "sidebar open" : "sidebar"}>
        <button className="brand brand-button" onClick={() => navigate("portal")} aria-label="Voltar ao portal">
          <span className="brand-mark"><span>MT</span></span>
          <span><b>SIGED</b><small>Sistema Integrado de Gestão de Expediente</small></span>
        </button>
        <nav>
          <p>VISÃO GERAL</p>
          <Nav icon="home" label="Painel principal" active={view === "dashboard"} onClick={() => navigate("dashboard")} />
          <p>EXPEDIENTE</p>
          <Nav icon="inbox" label="Todos os documentos" badge={String(documents.length)} active={view === "expediente"} onClick={() => { setFilter("Todos"); navigate("expediente"); }} />
          <Nav icon="send" label="Documentos enviados" onClick={() => { setFilter("Enviados"); navigate("expediente"); }} />
          <Nav icon="flow" label="Em tramitação" badge={String(documents.filter((document) => !["Concluído", "Enviado", "Arquivado"].includes(document.status)).length)} onClick={() => { setFilter("Pendentes"); navigate("expediente"); }} />
          <Nav icon="clock" label="Prazos e pendências" badge={String(documents.filter(isOverdue).length)} onClick={() => { setFilter("Atrasados"); navigate("expediente"); }} />
          <p>GESTÃO</p>
          <Nav icon="archive" label="Repositório digital" active={view === "repositorio"} onClick={() => navigate("repositorio")} />
          <Nav icon="chart" label="Relatórios" active={view === "relatorios"} onClick={() => navigate("relatorios")} />
          <Nav icon="unit" label="Unidades e tuteladas" active={view === "unidades"} onClick={() => navigate("unidades")} />
        </nav>
        <div className="help-card"><b>Precisa de ajuda?</b><span>Consulte o guia rápido ou contacte o suporte do SIGED.</span><button onClick={() => notify("Guia rápido: registe, encaminhe e acompanhe o expediente pelo histórico.")}>Guia rápido <Icon name="arrow" /></button></div>
        <div className="side-user"><span className="avatar">{user.initials}</span><span><b>{user.name}</b><small>{user.role}</small></span><button onClick={logout} title="Terminar sessão"><Icon name="logout" /></button></div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Abrir menu"><Icon name="menu" /></button>
          <div className="mobile-brand">SIGED</div>
          <label className="global-search"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar por assunto, referência, unidade ou tipo..." /><kbd>⌘ K</kbd></label>
          <div className="top-actions"><button className="round" aria-label="Notificações" onClick={() => notify(`${documents.filter(isOverdue).length} expediente(s) fora do prazo.`)}><Icon name="bell" /><i /></button><span className="divider" /><div className="user-chip"><span className="avatar">{user.initials}</span><span><b>{user.name}</b><small>{user.unit}</small></span><button className="logout-button" onClick={logout}>Sair <Icon name="logout" /></button></div></div>
        </header>
        <section className="content" aria-busy={loading}>
          {view === "dashboard" && <Dashboard user={user} documents={visibleDocuments} onOpen={openDocument} onNavigate={navigate} onNew={() => setNewOpen(true)} />}
          {view === "expediente" && <Expediente documents={visibleDocuments} filter={filter} onFilter={setFilter} onOpen={openDocument} onNew={() => setNewOpen(true)} onExport={() => exportCsv(visibleDocuments, notify)} />}
          {view === "detalhe" && selected && <DocumentDetail key={`${selected.id}-${selected.updatedAt}`} document={selected} onBack={() => navigate("expediente")} onUpdate={updateDocument} loading={loading} />}
          {view === "repositorio" && <Repository documents={visibleDocuments} onOpen={openDocument} onNew={() => setNewOpen(true)} />}
          {view === "relatorios" && <Reports documents={documents} onExport={() => exportCsv(documents, notify)} />}
          {view === "unidades" && <Units documents={documents} />}
          {loading && <div className="loading-line" />}
        </section>
      </main>
      {toast && <div className="toast"><Icon name="check" />{toast}</div>}
      {newOpen && <NewDocument close={() => setNewOpen(false)} save={createDocument} saving={loading} user={user} />}
    </div>
  );
}

function Portal({ onEnter }: { onEnter: () => void }) {
  return <main className="portal">
    <div className="portal-strip" />
    <header className="portal-header">
      <div className="portal-logo"><span className="crest">MZ</span><span><b>REPÚBLICA DE MOÇAMBIQUE</b><strong>MINISTÉRIO DO TRABALHO, GÉNERO E ACÇÃO SOCIAL</strong></span></div>
      <nav><a href="#sobre">Sobre o SIGED</a><a href="#servicos">Serviços</a><a href="#unidades">Estrutura</a><a href="#contacto">Contactos</a></nav>
      <button className="access" onClick={onEnter}><Icon name="shield" /> Entrar no sistema</button>
    </header>
    <section className="hero">
      <div className="hero-grid" />
      <div className="hero-copy">
        <span className="eyebrow"><i /> SIGED — SISTEMA INTEGRADO DE GESTÃO DE EXPEDIENTE</span>
        <h1>Expediente mais <em>rápido, seguro</em> e transparente.</h1>
        <p>Uma plataforma única para registar, encaminhar, acompanhar e arquivar documentos entre as unidades orgânicas e instituições tuteladas do MTGAS.</p>
        <div className="hero-buttons"><button className="primary" onClick={onEnter}>Aceder ao SIGED <Icon name="arrow" /></button><button className="secondary" onClick={() => document.getElementById("sobre")?.scrollIntoView({ behavior: "smooth" })}>Conhecer a plataforma</button></div>
        <div className="trust"><span><Icon name="check" /> Base de dados persistente</span><span><Icon name="check" /> Histórico integral</span><span><Icon name="check" /> Arquivo documental</span></div>
      </div>
      <div className="hero-visual"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="document-stack"><div className="paper back" /><div className="paper mid" /><div className="paper front"><div className="paper-head"><span className="mini-logo">MT</span><i /><i /></div><span /><span /><span className="short" /><div className="stamp">DIGITAL<br /><b>✓</b></div></div></div><div className="float-card fc-one"><span><Icon name="flow" /></span><div><b>Tramitação rastreável</b><small>Histórico por expediente</small></div></div><div className="float-card fc-two"><span><Icon name="check" /></span><div><b>Dados persistentes</b><small>D1 + arquivo R2</small></div></div></div>
    </section>
    <section className="portal-stats"><div><b>100%</b><span>Percurso documentado</span></div><div><b>17</b><span>Estruturas integráveis</span></div><div><b>24/7</b><span>Acesso ao repositório</span></div><div><b>20 MB</b><span>Por anexo documental</span></div></section>
    <section className="portal-about" id="sobre"><span className="section-label">UMA PLATAFORMA, TODO O MINISTÉRIO</span><h2>Do registo ao arquivo, tudo num único fluxo.</h2><p><strong>SIGED significa Sistema Integrado de Gestão de Expediente.</strong> A solução organiza o expediente interno, recebido e de saída, com prazos, responsabilidades, anexos e auditoria.</p><div className="feature-grid" id="servicos"><Feature icon="inbox" title="Registo estruturado" text="Numeração automática, prioridade, confidencialidade e anexos." /><Feature icon="flow" title="Tramitação controlada" text="Encaminhamento real, estados, comentários e histórico por documento." /><Feature icon="archive" title="Arquivo digital" text="Documentos armazenados com pesquisa e descarga protegida." /><Feature icon="chart" title="Gestão por resultados" text="Indicadores calculados a partir da base de dados do sistema." /></div></section>
    <section className="institution" id="unidades"><div><span className="section-label">FLEXÍVEL E ESCALÁVEL</span><h2>Preparado para o nível central e tuteladas.</h2><p>A estrutura permite integrar progressivamente novas unidades, perfis, tipos documentais e fluxos de aprovação, preservando a rastreabilidade institucional.</p><div className="values"><span>Celeridade</span><span>Transparência</span><span>Integridade</span><span>Segurança</span><span>Responsabilização</span></div></div><div className="structure-box"><h3>Estrutura inicial</h3><b>12</b><p>Unidades e serviços centrais</p><b>4</b><p>Instituições tuteladas</p><small>Configuração ajustável à estrutura oficial do MTGAS</small></div></section>
    <footer id="contacto"><div className="portal-logo small"><span className="crest">MZ</span><span><b>MTGAS</b><strong>Trabalho, Género e Acção Social</strong></span></div><span>Av. 24 de Julho, Maputo • cidadao@mtgas.gov.mz<br />(+258) 82 306 94 98 • 7:30–15:30</span><span>© 2026 MTGAS • Protótipo funcional</span></footer>
  </main>;
}

function Login({ onBack, onLogin }: { onBack: () => void; onLogin: (username: string, password: string) => Promise<void> }) {
  const [account, setAccount] = useState(demoAccounts[0]);
  const [username, setUsername] = useState(account.username);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onLogin(username.trim().toLowerCase(), password);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "Não foi possível iniciar a sessão.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-page"><button className="login-back" onClick={onBack}><Icon name="back" /> Portal institucional</button><section className="login-panel"><div className="login-brand"><span className="crest">MZ</span><b>REPÚBLICA DE MOÇAMBIQUE</b><strong>MINISTÉRIO DO TRABALHO, GÉNERO E ACÇÃO SOCIAL</strong><i /><h1>Bem-vindo ao SIGED</h1><p>Acesso ao ambiente demonstrativo funcional, com dados persistentes e diferentes níveis de responsabilidade.</p><div className="demo-accounts"><b>CONTAS FICTÍCIAS DE DEMONSTRAÇÃO</b>{demoAccounts.map((item) => <button type="button" key={item.username} onClick={() => { setAccount(item); setUsername(item.username); setPassword(item.password); }}><strong>{item.name}</strong><small>{item.username} • {item.role}</small></button>)}</div></div><form onSubmit={submit}><label>Perfil de demonstração<select value={account.username} onChange={(event) => { const next = demoAccounts.find((item) => item.username === event.target.value) ?? demoAccounts[0]; setAccount(next); setUsername(next.username); setPassword(next.password); }} >{demoAccounts.map((item) => <option value={item.username} key={item.username}>{item.name} — {item.role}</option>)}</select></label><label>Utilizador<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></label><label>Código de acesso<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>{error && <p className="login-error">{error}</p>}<button className="primary" type="submit" disabled={busy}><Icon name="shield" /> {busy ? "A validar..." : "Entrar no sistema"}</button><small>Seleccione um perfil para preencher automaticamente os dados de teste.</small></form></section></main>;
}

function Dashboard({ user, documents, onOpen, onNavigate, onNew }: { user: SigedUser; documents: DocumentRecord[]; onOpen: (document: DocumentRecord) => void; onNavigate: (view: View) => void; onNew: () => void }) {
  const pending = documents.filter((document) => !["Concluído", "Enviado", "Arquivado"].includes(document.status));
  const overdue = documents.filter(isOverdue);
  const completed = documents.filter((document) => ["Concluído", "Enviado", "Arquivado"].includes(document.status));
  const withinDeadline = completed.length ? Math.round(completed.filter((document) => !isOverdue(document)).length / completed.length * 100) : 100;
  return <><div className="page-title"><div><span className="breadcrumb">SIGED / Painel principal</span><h1>Bom dia, {user.name.split(" ")[0]} <span>👋</span></h1><p>Dados actualizados a partir do expediente registado no sistema.</p></div><button className="primary compact" onClick={onNew}><Icon name="plus" /> Registar expediente</button></div>
    {overdue.length > 0 && <div className="alert"><span className="alert-icon">!</span><div><b>{overdue.length} expediente(s) fora do prazo</b><p>Requerem encaminhamento, resposta ou conclusão imediata.</p></div><button onClick={() => onNavigate("expediente")}>Ver pendências <Icon name="arrow" /></button></div>}
    <div className="metric-grid"><Metric icon="inbox" value={String(documents.filter((document) => document.flowType === "Documento recebido").length)} label="Documentos recebidos" sub="Registos na base" color="green" /><Metric icon="send" value={String(documents.filter((document) => document.flowType === "Documento de saída").length)} label="Documentos de saída" sub="Produzidos pelo MTGAS" color="blue" /><Metric icon="flow" value={String(pending.length)} label="Em tramitação" sub={`${overdue.length} fora do prazo`} color="orange" /><Metric icon="check" value={`${withinDeadline}%`} label="Conclusão no prazo" sub={`${completed.length} concluídos`} color="purple" /></div>
    <div className="dashboard-grid"><section className="panel recent"><div className="panel-head"><div><h2>Expediente recente</h2><p>Últimos documentos registados e movimentados</p></div><button onClick={() => onNavigate("expediente")}>Ver todos <Icon name="arrow" /></button></div><DocumentTable documents={documents.slice(0, 6)} onOpen={onOpen} /></section><section className="panel activity"><div className="panel-head"><div><h2>Prioridades</h2><p>Prazos mais próximos</p></div></div><div className="deadline-list">{[...pending].sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999")).slice(0, 5).map((document) => <button className="deadline-item" onClick={() => onOpen(document)} key={document.id}><span className={isOverdue(document) ? "date urgent" : "date"}><b>{document.deadline?.slice(8, 10) ?? "—"}</b>{document.deadline ? new Date(`${document.deadline}T12:00:00`).toLocaleDateString("pt-MZ", { month: "short" }).toUpperCase() : ""}</span><span><b>{document.subject}</b><small>{document.reference}</small></span><i>{isOverdue(document) ? "Atrasado" : `${daysUntil(document.deadline) ?? "—"} dias`}</i></button>)}</div></section></div>
  </>;
}

function Expediente({ documents, filter, onFilter, onOpen, onNew, onExport }: { documents: DocumentRecord[]; filter: string; onFilter: (filter: string) => void; onOpen: (document: DocumentRecord) => void; onNew: () => void; onExport: () => void }) {
  return <><div className="page-title"><div><span className="breadcrumb">SIGED / Expediente</span><h1>Gestão de expediente</h1><p>Consulte, filtre e acompanhe documentos recebidos, internos e de saída.</p></div><button className="primary compact" onClick={onNew}><Icon name="plus" /> Novo expediente</button></div><section className="panel full-panel"><div className="filter-row">{["Todos", "Recebidos", "Enviados", "Pendentes", "Atrasados"].map((item) => <button key={item} className={filter === item ? "filter active" : "filter"} onClick={() => onFilter(item)}>{item}{item === "Todos" && <b>{documents.length}</b>}</button>)}<button className="export" onClick={onExport}><Icon name="download" /> Exportar CSV</button></div><DocumentTable documents={documents} onOpen={onOpen} large /></section></>;
}

function DocumentDetail({ document, onBack, onUpdate, loading }: { document: DocumentRecord; onBack: () => void; onUpdate: (payload: { id: number; status?: string; destination?: string; comment?: string; archived?: boolean }) => Promise<void>; loading: boolean }) {
  const [status, setStatus] = useState(document.status);
  const [destination, setDestination] = useState(document.destination);
  const [comment, setComment] = useState("");
  const submit = async (event: FormEvent) => { event.preventDefault(); await onUpdate({ id: document.id, status, destination, comment }); setComment(""); };
  return <><button className="back" onClick={onBack}><Icon name="back" /> Voltar à lista</button><div className="detail-head"><div><span className="doc-type">{document.flowType} • {document.documentType}</span><h1>{document.subject}</h1><p>{document.reference}</p></div><div>{document.attachments?.[0] && <a className="secondary small button-link" href={`/api/uploads?id=${document.attachments[0].id}`}><Icon name="download" /> Documento</a>}<button className="primary compact" onClick={() => document.archived ? undefined : onUpdate({ id: document.id, archived: true, comment: "Expediente arquivado" })} disabled={document.archived}>Arquivar <Icon name="archive" /></button></div></div><div className="detail-grid"><section className="panel detail-card"><h2>Dados do expediente</h2><dl><div><dt>Origem</dt><dd>{document.origin}</dd></div><div><dt>Destino actual</dt><dd>{document.destination}</dd></div><div><dt>Registado em</dt><dd>{formatDate(document.createdAt)}</dd></div><div><dt>Prazo de resposta</dt><dd className={isOverdue(document) ? "overdue-text" : ""}>{formatDate(document.deadline)}</dd></div><div><dt>Prioridade</dt><dd>{document.priority}</dd></div><div><dt>Estado</dt><dd><Status text={document.status} /></dd></div><div><dt>Confidencialidade</dt><dd>{document.confidentiality}</dd></div><div><dt>Referência externa</dt><dd>{document.senderReference || "Não indicada"}</dd></div></dl><h3>Observações</h3><p>{document.notes || "Sem observações adicionais."}</p><h3>Ficheiros anexos</h3>{document.attachments?.length ? <div className="attachment-list">{document.attachments.map((file) => <a className="attachment" href={`/api/uploads?id=${file.id}`} key={file.id}><span>{file.contentType.includes("pdf") ? "PDF" : "DOC"}</span><div><b>{file.fileName}</b><small>{(file.size / 1024 / 1024).toFixed(2)} MB • {shortDate(file.createdAt)}</small></div><Icon name="download" /></a>)}</div> : <p className="empty-note">Nenhum ficheiro anexado.</p>}</section><section className="panel tracking"><div className="panel-head"><div><h2>Percurso do documento</h2><p>Histórico persistente e auditável</p></div><Status text={document.status} /></div><div className="track-list">{document.movements?.length ? document.movements.map((movement, index) => <div className={index === 0 ? "track current" : "track done"} key={movement.id}><span>{index === 0 ? "●" : "✓"}</span><div><b>{movement.action}</b><p>{movement.actor} • {shortDate(movement.createdAt)}</p><small>{movement.fromUnit && movement.toUnit ? `${movement.fromUnit} → ${movement.toUnit}` : movement.toUnit}</small>{movement.comment && <em>{movement.comment}</em>}</div></div>) : <p className="empty-note">Histórico a carregar.</p>}</div><form className="routing-form" onSubmit={submit}><h3>Actualizar e encaminhar</h3><label>Próximo estado<select value={status} onChange={(event) => setStatus(event.target.value)}>{statusOptions.map((item) => <option key={item}>{item}</option>)}</select></label><label>Unidade responsável<select value={destination} onChange={(event) => setDestination(event.target.value)}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></label><label>Instrução ou comentário<textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Ex.: Emitir parecer técnico até sexta-feira" /></label><button className="primary" disabled={loading}>Guardar movimento <Icon name="arrow" /></button></form></section></div></>;
}

function Repository({ documents, onOpen, onNew }: { documents: DocumentRecord[]; onOpen: (document: DocumentRecord) => void; onNew: () => void }) {
  const categories = ["Ofício", "Relatório", "Nota", "Informação"].map((type, index) => ({ type, count: documents.filter((document) => document.documentType === type).length, color: ["#167a50", "#3478c9", "#c58a24", "#7c59bd"][index] }));
  return <><div className="page-title"><div><span className="breadcrumb">SIGED / Repositório</span><h1>Repositório digital</h1><p>Arquivo central pesquisável, alimentado pelos documentos do SIGED.</p></div><button className="primary compact" onClick={onNew}><Icon name="plus" /> Carregar documento</button></div><div className="repository-hero"><Icon name="archive" /><div><h2>{documents.length} documento(s) disponíveis</h2><p>Use a pesquisa global para localizar referências, assuntos, unidades e tipos documentais.</p></div></div><div className="repo-grid">{categories.map((category) => <article className="folder" key={category.type}><span style={{ background: category.color }}>▰</span><div><b>{category.type}s</b><small>{category.count} documento(s)</small></div></article>)}</div><section className="panel repo-list"><div className="panel-head"><div><h2>Documentos encontrados</h2><p>Clique para abrir o expediente e consultar os anexos.</p></div></div><DocumentTable documents={documents} onOpen={onOpen} /></section></>;
}

function Reports({ documents, onExport }: { documents: DocumentRecord[]; onExport: () => void }) {
  const completed = documents.filter((document) => ["Concluído", "Enviado", "Arquivado"].includes(document.status));
  const pending = documents.length - completed.length;
  const overdue = documents.filter(isOverdue).length;
  const onTime = completed.length ? Math.round(completed.filter((document) => !isOverdue(document)).length / completed.length * 100) : 100;
  const byStatus = statusOptions.map((status) => ({ status, count: documents.filter((document) => document.status === status).length })).filter((item) => item.count);
  const max = Math.max(1, ...byStatus.map((item) => item.count));
  return <><div className="page-title"><div><span className="breadcrumb">SIGED / Relatórios</span><h1>Relatórios e indicadores</h1><p>Indicadores calculados em tempo real a partir da base de dados.</p></div><div className="page-actions"><button className="secondary compact" onClick={() => window.print()}>Imprimir relatório</button><button className="primary compact" onClick={onExport}><Icon name="download" /> Exportar dados</button></div></div><div className="metric-grid"><Metric icon="file" value={String(documents.length)} label="Documentos registados" sub="Total na base" color="green" /><Metric icon="flow" value={String(pending)} label="Em processamento" sub={`${overdue} atrasados`} color="orange" /><Metric icon="check" value={`${onTime}%`} label="Conclusão no prazo" sub={`${completed.length} finalizados`} color="purple" /><Metric icon="archive" value={String(documents.filter((document) => document.archived).length)} label="Documentos arquivados" sub="Repositório definitivo" color="blue" /></div><div className="report-grid"><section className="panel chart-card"><div className="panel-head"><div><h2>Distribuição por estado</h2><p>Volume actual do fluxo documental</p></div></div><div className="bar-chart status-chart">{byStatus.map((item) => <div className="bar-group" key={item.status}><div><i style={{ height: `${Math.max(12, item.count / max * 100)}%` }} /></div><strong>{item.count}</strong><span>{item.status}</span></div>)}</div></section><section className="panel unit-performance"><div className="panel-head"><div><h2>Volume por tipo</h2><p>Composição do repositório</p></div></div>{["Ofício", "Relatório", "Nota", "Informação", "Requerimento"].map((type) => { const count = documents.filter((document) => document.documentType === type).length; const pct = documents.length ? Math.round(count / documents.length * 100) : 0; return <Flow key={type} label={type} value={`${count} (${pct}%)`} pct={pct} />; })}</section></div></>;
}

function Units({ documents }: { documents: DocumentRecord[] }) {
  return <><div className="page-title"><div><span className="breadcrumb">SIGED / Estrutura</span><h1>Unidades orgânicas e instituições tuteladas</h1><p>Directório operacional e volume documental por destino.</p></div></div><div className="units-grid">{units.map((unit) => { const count = documents.filter((document) => document.destination === unit || document.origin === unit).length; return <article className="unit-card" key={unit}><span className="unit-symbol">{unit.split(" ").filter((word) => word.length > 2).slice(0, 2).map((word) => word[0]).join("")}</span><div><h3>{unit}</h3><p>{unit.includes("Instituto") || unit.includes("Inspecção") || unit.includes("Comissão") ? "Instituição tutelada" : "Unidade ou serviço"}</p><span><i className="online" /> Activa no SIGED</span></div><b>{count}</b><small>expedientes</small></article>; })}</div></>;
}

function NewDocument({ close, save, saving, user }: { close: () => void; save: (payload: Record<string, string>, file?: File) => Promise<void>; saving: boolean; user: SigedUser }) {
  return <div className="modal-backdrop" onMouseDown={close}><form className="modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const file = form.get("file"); void save(Object.fromEntries([...form.entries()].filter(([key]) => key !== "file").map(([key, value]) => [key, String(value)])), file instanceof File && file.size ? file : undefined); }}><div className="modal-head"><div><span>NOVO REGISTO</span><h2>Registar expediente</h2><p>O documento será numerado e registado no histórico automaticamente.</p></div><button type="button" onClick={close}><Icon name="close" /></button></div><div className="form-grid"><label>Fluxo documental<select name="flowType" required><option>Documento recebido</option><option>Documento interno</option><option>Documento de saída</option></select></label><label>Tipo documental<select name="documentType" required><option>Ofício</option><option>Nota</option><option>Relatório</option><option>Informação</option><option>Requerimento</option><option>Despacho</option><option>Acta</option></select></label><label className="wide">Assunto<input name="subject" required maxLength={180} placeholder="Assunto principal do documento" /></label><label>Entidade ou unidade de origem<input name="origin" required defaultValue={user.unit} /></label><label>Unidade responsável<select name="destination" required>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></label><label>Referência do remetente<input name="senderReference" placeholder="Opcional" /></label><label>Prioridade<select name="priority"><option>Normal</option><option>Alta</option><option>Urgente</option></select></label><label>Confidencialidade<select name="confidentiality"><option>Público</option><option>Interno</option><option>Restrito</option><option>Confidencial</option></select></label><label>Prazo de resposta<input name="deadline" type="date" /></label><label className="wide">Observações e instruções<textarea name="notes" maxLength={800} placeholder="Resumo, instruções de tramitação ou informação complementar" /></label><label className="wide upload">⇧ <b>Carregar documento principal</b><small>PDF, DOCX, XLSX, PNG ou JPG • máximo 20 MB</small><input name="file" type="file" accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg" /></label></div><div className="modal-actions"><button type="button" className="secondary" onClick={close}>Cancelar</button><button type="submit" className="primary" disabled={saving}>{saving ? "A registar..." : "Registar e encaminhar"} <Icon name="arrow" /></button></div></form></div>;
}

function DocumentTable({ documents, onOpen, large = false }: { documents: DocumentRecord[]; onOpen: (document: DocumentRecord) => void; large?: boolean }) {
  if (!documents.length) return <div className="empty-state"><Icon name="search" /><b>Nenhum expediente encontrado</b><span>Ajuste a pesquisa ou registe um novo documento.</span></div>;
  return <div className={large ? "doc-table large" : "doc-table"}><div className="tr th"><span>REFERÊNCIA / ASSUNTO</span><span>ORIGEM → DESTINO</span><span>PRAZO</span><span>ESTADO</span><span>PROGRESSO</span></div>{documents.map((document) => <button className="tr clickable" key={document.id} onClick={() => onOpen(document)}><span><b>{document.subject}</b><small>{document.reference} • {document.documentType}</small></span><span><b>{document.origin}</b><small>→ {document.destination}</small></span><span><b className={isOverdue(document) ? "overdue-text" : ""}>{formatDate(document.deadline)}</b><small>{document.priority}</small></span><span><Status text={document.status} /></span><span><i className="progress"><i style={{ width: `${document.progress}%` }} /></i><small>{document.progress}%</small></span></button>)}</div>;
}

function exportCsv(documents: DocumentRecord[], notify: (message: string) => void) {
  const fields = ["Referência", "Assunto", "Origem", "Destino", "Tipo", "Fluxo", "Prioridade", "Estado", "Prazo", "Progresso"];
  const rows = documents.map((document) => [document.reference, document.subject, document.origin, document.destination, document.documentType, document.flowType, document.priority, document.status, document.deadline ?? "", document.progress]);
  const csv = [fields, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `SIGED_Expediente_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  notify(`${documents.length} registo(s) exportado(s).`);
}

function Nav({ icon, label, badge, active, onClick }: { icon: string; label: string; badge?: string; active?: boolean; onClick: () => void }) {
  return <button className={active ? "nav-item active" : "nav-item"} onClick={onClick}><Icon name={icon} /><span>{label}</span>{badge && <b>{badge}</b>}</button>;
}

function Feature({ icon, title, text }: { icon: string; title: string; text: string }) {
  return <article className="feature"><span><Icon name={icon} /></span><h3>{title}</h3><p>{text}</p></article>;
}

function Metric({ icon, value, label, sub, color }: { icon: string; value: string; label: string; sub: string; color: string }) {
  return <article className="metric"><span className={`metric-icon ${color}`}><Icon name={icon} /></span><div><p>{label}</p><b>{value}</b><small>{sub}</small></div></article>;
}

function Status({ text }: { text: string }) {
  return <span className={`status ${text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll(" ", "-")}`}>{text}</span>;
}

function Flow({ label, value, pct }: { label: string; value: string; pct: number }) {
  return <div className="flow-row"><span><b>{label}</b><strong>{value}</strong></span><i><i style={{ width: `${pct}%` }} /></i></div>;
}
