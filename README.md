# SIGED MTGAS

Sistema Integrado de Gestão de Expediente do Ministério do Trabalho, Género e Acção Social de Moçambique.

## Funcionalidades implementadas

- Portal institucional do MTGAS;
- Autenticação demonstrativa com sessões seguras e persistentes;
- Registo de expediente recebido, interno e de saída;
- Encaminhamento entre unidades orgânicas e instituições tuteladas;
- Controlo do percurso, estados, prioridades, confidencialidade e prazos;
- Histórico auditável de cada movimento e interveniente;
- Carregamento e descarga protegida de documentos e anexos;
- Repositório documental pesquisável;
- Filtros operacionais e exportação em CSV;
- Relatórios e indicadores calculados a partir dos dados registados;
- Interface adaptável ao computador, tablet e telemóvel;
- Directório de unidades orgânicas e instituições tuteladas.

## Base de dados e armazenamento

- **Cloudflare D1 / SQLite:** utilizadores, sessões, expedientes, movimentos, unidades e auditoria;
- **Cloudflare R2:** ficheiros e anexos documentais;
- **Drizzle ORM:** esquema tipado e migrações versionadas;
- Inicialização segura para instalações novas e actualização de bases existentes.

## Perfis de demonstração

| Perfil | Utilizador | Código |
| --- | --- | --- |
| Administrador | `sergio.demo` | `SIGED2026` |
| Gestora de Expediente | `secretaria.demo` | `SEC2026` |
| Despacho | `gabinete.demo` | `GAB2026` |
| Instituição tutelada | `inas.demo` | `INAS2026` |

## Executar localmente

Requer Node.js 22 ou superior.

```bash
npm install
npm run dev
```

## Versão online

https://siged-mtgas.sergiom-ndimande.chatgpt.site

© 2026 MTGAS — Protótipo funcional para desenvolvimento, validação e recolha de requisitos.
