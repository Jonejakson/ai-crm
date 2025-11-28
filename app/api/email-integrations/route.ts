import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getCurrentUser } from "@/lib/get-session"

// Получить все email-интеграции компании
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const companyId = parseInt(user.companyId)
    const integrations = await prisma.emailIntegration.findMany({
      where: { companyId },
      include: {
        defaultAssignee: { select: { id: true, name: true, email: true } },
        defaultSource: { select: { id: true, name: true } },
        defaultPipeline: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(integrations)
  } catch (error) {
    console.error("[email-integrations][GET]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// Создать новую email-интеграцию
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // TODO: Проверка платной подписки

    const body = await request.json()
    const companyId = parseInt(user.companyId)

    const integration = await prisma.emailIntegration.create({
      data: {
        provider: body.provider,
        email: body.email,
        displayName: body.displayName,
        isActive: body.isActive !== false,
        isIncomingEnabled: body.isIncomingEnabled !== false,
        isOutgoingEnabled: body.isOutgoingEnabled !== false,
        companyId,
        // IMAP/SMTP настройки
        imapHost: body.imapHost || null,
        imapPort: body.imapPort || null,
        imapUsername: body.imapUsername || null,
        imapPassword: body.imapPassword ? await encryptPassword(body.imapPassword) : null,
        smtpHost: body.smtpHost || null,
        smtpPort: body.smtpPort || null,
        smtpUsername: body.smtpUsername || null,
        smtpPassword: body.smtpPassword ? await encryptPassword(body.smtpPassword) : null,
        useSSL: body.useSSL !== false,
        // OAuth токены (для Gmail/Outlook)
        accessToken: body.accessToken ? await encryptPassword(body.accessToken) : null,
        refreshToken: body.refreshToken ? await encryptPassword(body.refreshToken) : null,
        tokenExpiresAt: body.tokenExpiresAt ? new Date(body.tokenExpiresAt) : null,
        // Настройки синхронизации
        syncInterval: body.syncInterval || 5,
        autoCreateContact: body.autoCreateContact !== false,
        autoCreateDeal: body.autoCreateDeal === true,
        defaultSourceId: body.defaultSourceId ? Number(body.defaultSourceId) : null,
        defaultPipelineId: body.defaultPipelineId ? Number(body.defaultPipelineId) : null,
        defaultAssigneeId: body.defaultAssigneeId ? Number(body.defaultAssigneeId) : null,
        settings: body.settings || null,
      },
      include: {
        defaultAssignee: { select: { id: true, name: true, email: true } },
        defaultSource: { select: { id: true, name: true } },
        defaultPipeline: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(integration)
  } catch (error) {
    console.error("[email-integrations][POST]", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Простое шифрование паролей (в продакшене использовать более надежное решение)
async function encryptPassword(password: string): Promise<string> {
  // TODO: Использовать crypto для шифрования
  // Пока просто возвращаем как есть (в продакшене обязательно шифровать!)
  return password
}

