import { NextResponse } from "next/server";

/**
 * WebSocket upgrades are not supported by a Next.js App Router route handler.
 * Keep this endpoint explicit so clients do not mistake an HTTP route for a
 * live socket. Configure NEXT_PUBLIC_WS_URL for a dedicated WS service.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      code: "WEBSOCKET_SERVICE_REQUIRED",
      message: "Configure NEXT_PUBLIC_WS_URL for a dedicated WebSocket service.",
    },
    { status: 426 },
  );
}
