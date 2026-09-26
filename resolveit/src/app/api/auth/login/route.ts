import { createSession, verifyPassword } from "@/server/auth/session";
import { getDatabasePool } from "@/server/database/pool";

export const runtime = "nodejs";

type LoginBody = {
  email?: unknown;
  password?: unknown;
};

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  role: "EMPLOYEE" | "IT_ADMIN";
  display_name: string;
};

function errorResponse(
  status: number,
  code: string,
  message: string,
) {
  return Response.json(
    {
      success: false,
      error: {
        code,
        message,
      },
    },
    { status },
  );
}

export async function POST(request: Request) {
  let body: LoginBody;

  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return errorResponse(
      400,
      "INVALID_JSON",
      "Request body must be valid JSON.",
    );
  }

  const email =
    typeof body.email === "string"
      ? body.email.trim().toLowerCase()
      : "";

  const password =
    typeof body.password === "string"
      ? body.password
      : "";

  if (!email || !password) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      "Email and password are required.",
    );
  }

  try {
    const result = await getDatabasePool().query<UserRow>(
      `SELECT id, email, password_hash, role, display_name
       FROM users
       WHERE email = $1`,
      [email],
    );

    const user = result.rows[0];

    if (!user) {
      return errorResponse(
        401,
        "INVALID_CREDENTIALS",
        "Invalid email or password.",
      );
    }

    const passwordValid = await verifyPassword(
      password,
      user.password_hash,
    );

    if (!passwordValid) {
      return errorResponse(
        401,
        "INVALID_CREDENTIALS",
        "Invalid email or password.",
      );
    }

    await createSession(user.id);

    return Response.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        displayName: user.display_name,
      },
    });
  } catch (error) {
    console.error("Login failed.", error);

    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "Login is temporarily unavailable. Please try again.",
    );
  }
}