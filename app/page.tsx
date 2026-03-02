import { redirect } from "next/navigation"

export default function HomePage() {
  // 直接进入 Dashboard，无需登录
  redirect("/dashboard")
}
