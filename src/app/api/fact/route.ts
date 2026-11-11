import { getCurrentUser } from "@/lib/auth";
import { getFactForUser } from "@/lib/facts";

export const runtime = "nodejs";

const headers = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "This request is not allowed." }, { status: 403, headers });
  }

  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: "Please sign in again." }, { status: 401, headers });
    if (!user.favoriteMovie) {
      return Response.json({ error: "Save your favorite movie first." }, { status: 409, headers });
    }

    // Ownership and movie selection come only from the authenticated database user.
    const result = await getFactForUser(user.id, user.favoriteMovie);
    return Response.json(result, { headers });
  } catch {
    return Response.json(
      { error: "We couldn't load a movie fact. Please try again." },
      { status: 503, headers },
    );
  }
}
