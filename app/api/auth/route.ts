import { authenticate, clearSessionCookie, createSession, ensureDemoUsers, getSessionUser, removeSession } from "../../../lib/auth";

export async function GET(request: Request) {
  try {
    await ensureDemoUsers();
    const user = await getSessionUser(request);
    return Response.json({ user });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro de autenticação" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json() as { username?: string; password?: string };
    if (!username || !password) return Response.json({ error: "Introduza o utilizador e o código de acesso." }, { status: 400 });
    const user = await authenticate(username, password);
    if (!user) return Response.json({ error: "Utilizador ou código de acesso incorrecto." }, { status: 401 });
    const session = await createSession(user, request);
    return Response.json({ user }, { headers: { "Set-Cookie": session.cookie } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível iniciar a sessão" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await removeSession(request);
    return Response.json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie() } });
  } catch {
    return Response.json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie() } });
  }
}
