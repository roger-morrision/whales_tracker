import { NextResponse } from "next/server";
import { checkGmgnCliStatus } from "@/lib/gmgn";

/**
 * GET /api/gmgn/status
 *
 * Reports whether gmgn-cli is installed and whether the API key is configured.
 * Used by the UI to show a setup banner when the user needs to configure GMGN.
 */
export async function GET() {
  const status = await checkGmgnCliStatus();
  return NextResponse.json({
    ...status,
    timestamp: Date.now(),
    setupInstructions: !status.installed
      ? "Run `npm install -g gmgn-cli` to install the GMGN CLI."
      : !status.apiKeyConfigured
      ? "Run `gmgn-cli config` to get your API key URL, then `gmgn-cli config --apply <KEY>` to configure."
      : undefined,
  });
}
