import { NextResponse } from "next/server"
import { checkAIConfig, getConfigHelp } from "@/lib/ai/config"

export async function GET() {
  const status = checkAIConfig()

  return NextResponse.json({
    provider: status.provider,
    configured: status.configured,
    hasApiKey: status.hasApiKey,
    hasModel: status.hasModel,
    missingEnvVars: status.missingEnvVars,
    help: status.missingEnvVars.length > 0 ? getConfigHelp(status.provider) : null,
  })
}
