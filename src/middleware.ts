import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET || "comarka-ads-session-secret-2026");

// Auto-login superadmin: gera token JWT automaticamente quando não há sessão
async function getOrCreateSuperAdminToken(req: NextRequest): Promise<{ token: string; isNew: boolean }> {
  const existing = req.cookies.get("session_token")?.value;
  if (existing) {
    try {
      await jwtVerify(existing, SECRET);
      return { token: existing, isNew: false };
    } catch { /* token expirado, gera novo */ }
  }
  const token = await new SignJWT({
    employeeId: "superadmin-local",
    role: "admin",
    entityId: null,
    nome: "Super Admin",
    usuario: "lucasantos",
    cargo: "Diretor",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .setIssuedAt()
    .sign(SECRET);
  return { token, isNew: true };
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Static files and Next.js internals
  if (pathname.startsWith("/_next") || pathname.includes(".") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  // /tv/* público
  if (pathname.startsWith("/tv")) {
    return NextResponse.next();
  }

  // Auto-login: garante cookie de superadmin em todas as rotas
  const { token, isNew } = await getOrCreateSuperAdminToken(req);
  const response = NextResponse.next();
  if (isNew) {
    response.cookies.set("session_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
