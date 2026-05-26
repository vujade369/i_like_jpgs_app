import type { NextRequest } from "next/server";
import { searchWalletIdentities } from "@/lib/jpgs/opensea";

const SUGGESTION_LIMIT = 6;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return Response.json({ suggestions: [] });
  }

  try {
    const suggestions = await searchWalletIdentities(q, SUGGESTION_LIMIT);
    return Response.json({ suggestions });
  } catch {
    return Response.json({ suggestions: [] });
  }
}
