import { NextRequest, NextResponse } from "next/server"
import { getExerciseMaterials, getLearningPlan } from "@/lib/storage"

/**
 * 获取学科的练习资料
 * GET /api/learning/[subject]/materials
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subject: string }> }
) {
  const { subject } = await params

  try {
    const materials = await getExerciseMaterials(subject)
    const plan = await getLearningPlan(subject)

    return NextResponse.json({
      success: true,
      materials,
      plan
    })
  } catch (error: any) {
    console.error("[Learning Materials] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "获取学习资料失败",
        details: error.message
      },
      { status: 500 }
    )
  }
}
