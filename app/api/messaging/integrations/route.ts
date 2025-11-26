import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/get-session";
import { isAdmin } from "@/lib/access-control";

/**
 * GET - получить все интеграции компании
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!await isAdmin()) {
      return NextResponse.json({ error: "Forbidden: Admin only" }, { status: 403 });
    }

    const companyId = typeof user.companyId === 'string' ? parseInt(user.companyId) : user.companyId;
    if (!companyId || isNaN(companyId)) {
      console.error('Invalid company ID:', { user, companyId, companyIdType: typeof user.companyId });
      return NextResponse.json({ error: "Invalid company ID" }, { status: 400 });
    }
    
    try {
      const integrations = await prisma.messagingIntegration.findMany({
        where: { companyId },
        orderBy: { platform: 'asc' },
      });

      return NextResponse.json(integrations);
    } catch (prismaError: any) {
      // Если таблица не существует, возвращаем пустой массив
      if (prismaError.code === 'P2021' || prismaError.message?.includes('does not exist')) {
        console.warn('MessagingIntegration table does not exist yet, returning empty array');
        return NextResponse.json([]);
      }
      throw prismaError; // Пробрасываем другие ошибки дальше
    }
  } catch (error: any) {
    console.error('Error fetching integrations:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
    });
    return NextResponse.json(
      { 
        error: process.env.NODE_ENV === 'development' 
          ? `Error: ${error.message}` 
          : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

/**
 * POST - создать или обновить интеграцию
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!await isAdmin()) {
      return NextResponse.json({ error: "Forbidden: Admin only" }, { status: 403 });
    }

    const body = await req.json();
    const { platform, botToken, isActive, webhookUrl, webhookSecret, settings } = body;

    if (!platform || !['TELEGRAM', 'WHATSAPP'].includes(platform)) {
      return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
    }

    const companyId = typeof user.companyId === 'string' ? parseInt(user.companyId) : user.companyId;
    if (!companyId || isNaN(companyId)) {
      return NextResponse.json({ error: "Invalid company ID" }, { status: 400 });
    }

    // Используем upsert для создания или обновления
    const integration = await prisma.messagingIntegration.upsert({
      where: {
        companyId_platform: {
          companyId,
          platform: platform as 'TELEGRAM' | 'WHATSAPP',
        },
      },
      update: {
        botToken: botToken || undefined,
        isActive: isActive !== undefined ? isActive : undefined,
        webhookUrl: webhookUrl || undefined,
        webhookSecret: webhookSecret || undefined,
        settings: settings ? JSON.parse(JSON.stringify(settings)) : undefined,
        updatedAt: new Date(),
      },
      create: {
        platform: platform as 'TELEGRAM' | 'WHATSAPP',
        botToken: botToken || null,
        isActive: isActive !== undefined ? isActive : false,
        webhookUrl: webhookUrl || null,
        webhookSecret: webhookSecret || null,
        settings: settings ? JSON.parse(JSON.stringify(settings)) : null,
        companyId,
      },
    });

    return NextResponse.json(integration);
  } catch (error: any) {
    console.error('Error saving integration:', error);
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

