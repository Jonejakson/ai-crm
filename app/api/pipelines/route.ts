import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/get-session";
import { checkPipelineLimit } from "@/lib/subscription-limits";

// Получить все воронки компании
export async function GET() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const companyId = parseInt(user.companyId);

    const pipelines = await prisma.pipeline.findMany({
      where: {
        companyId,
      },
      orderBy: { isDefault: 'desc' },
    });
    return NextResponse.json(pipelines);
  } catch (error: any) {
    console.error('Error fetching pipelines:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    return NextResponse.json({ 
      error: process.env.NODE_ENV === 'development' 
        ? `Error: ${error.message}` 
        : "Internal Server Error" 
    }, { status: 500 });
  }
}

// Создать воронку
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    
    if (!data.name || !data.stages) {
      return NextResponse.json({ error: "Name and stages are required" }, { status: 400 });
    }

    const companyId = parseInt(user.companyId);

    // Проверка лимита воронок
    const pipelineLimitCheck = await checkPipelineLimit(companyId);
    if (!pipelineLimitCheck.allowed) {
      return NextResponse.json(
        { 
          error: pipelineLimitCheck.message || "Достигнут лимит воронок",
          limit: pipelineLimitCheck.limit,
          current: pipelineLimitCheck.current,
        },
        { status: 403 }
      );
    }

    const pipeline = await prisma.pipeline.create({
      data: {
        name: data.name,
        stages: typeof data.stages === 'string' ? data.stages : JSON.stringify(data.stages),
        isDefault: data.isDefault || false,
        companyId,
      },
    });
    
    return NextResponse.json(pipeline);
  } catch (error: any) {
    console.error('Error creating pipeline:', error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Обновить воронку
export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    
    if (!data.id) {
      return NextResponse.json({ error: "Pipeline ID is required" }, { status: 400 });
    }

    const companyId = parseInt(user.companyId);

    // Проверяем, что воронка принадлежит компании пользователя
    const existingPipeline = await prisma.pipeline.findFirst({
      where: {
        id: data.id,
        companyId,
      }
    });

    if (!existingPipeline) {
      return NextResponse.json({ error: "Pipeline not found or access denied" }, { status: 404 });
    }

    const updateData: any = {};
    
    if (data.name) {
      updateData.name = data.name;
    }
    
    if (data.stages) {
      updateData.stages = typeof data.stages === 'string' ? data.stages : JSON.stringify(data.stages);
    }
    
    if (data.isDefault !== undefined) {
      // Если устанавливаем воронку как дефолтную, снимаем флаг с других
      if (data.isDefault) {
        await prisma.pipeline.updateMany({
          where: {
            companyId,
            isDefault: true
          },
          data: {
            isDefault: false
          }
        });
      }
      updateData.isDefault = data.isDefault;
    }

    const pipeline = await prisma.pipeline.update({
      where: { id: data.id },
      data: updateData,
    });
    
    return NextResponse.json(pipeline);
  } catch (error: any) {
    console.error('Error updating pipeline:', error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

