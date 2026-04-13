import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET || "comarka-ads-session-secret-2026");

// Rotas públicas (sem autenticação)
const PUBLIC_ROUTES = ["/portal", "/api/auth/login", "/api/auth/logout", "/tv"];

// Rotas exclusivas do admin (tudo que não é /portal/* ou /api/auth/*)
function isAdminRoute(path: string): boolean {
  if (path.startsWith("/portal")) return false;
  if (path.startsWith("/api/auth")) return false;
  if (path.startsWith("/_next")) return false;
  if (path.startsWith("/favicon")) return false;
  if (path.includes(".")) return false; // static files
  return true;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rotas públicas
  if (PUBLIC_ROUTES.some((r) => pathname === r)) {
    return NextResponse.next();
  }
  // /tv/* (ranking TV fullscreen etc) é totalmente público
  if (pathname.startsWith("/tv/")) {
    return NextResponse.next();
  }

  // Static files and Next.js internals
  if (pathname.startsWith("/_next") || pathname.includes(".") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  // API routes
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth/")) {
    const token = req.cookies.get("session_token")?.value;
    // APIs de portal (compensation, notifications, tarefas) requerem qualquer auth
    const portalApis = ["/api/compensation", "/api/notifications", "/api/tarefas"];
    if (portalApis.some((p) => pathname.startsWith(p))) {
      if (!token) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
      try { await jwtVerify(token, SECRET); } catch { return NextResponse.json({ error: "Sessão inválida" }, { status: 401 }); }
      return NextResponse.next();
    }
    // Demais APIs: acessíveis para admin ou sem auth (dashboard fetches client-side com cookie)
    if (token) {
      try {
        const { payload } = await jwtVerify(token, SECRET);
        if (payload.role !== "admin") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
      } catch { /* token inválido mas permite fallback */ }
    }
    return NextResponse.next();
  }

  // Verificar autenticação
  const token = req.cookies.get("session_token")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/portal", req.url));
  }

  let role: string;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    role = payload.role as string;
  } catch {
    const response = NextResponse.redirect(new URL("/portal", req.url));
    response.cookies.set("session_token", "", { maxAge: 0 });
    return response;
  }

  // Admin pode acessar tudo
  if (role === "admin") return NextResponse.next();

  // Closer/SDR só podem acessar /portal/*
  if (isAdminRoute(pathname)) {
    return NextResponse.redirect(new URL("/portal/painel", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
