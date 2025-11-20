import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/get-session";

// Удалить воронку
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const pipelineId = parseInt(id);
    const companyId = parseInt(user.companyId);

    // Проверяем, что воронка принадлежит компании пользователя
    const pipeline = await prisma.pipeline.findFirst({
      where: {
        id: pipelineId,
        companyId,
      }
    });

    if (!pipeline) {
      return NextResponse.json({ error: "Pipeline not found or access denied" }, { status: 404 });
    }

    // Нельзя удалить дефолтную воронку, если она единственная
    if (pipeline.isDefault) {
      const pipelineCount = await prisma.pipeline.count({
        where: { companyId }
      });
      
      if (pipelineCount === 1) {
        return NextResponse.json({ 
          error: "Нельзя удалить единственную воронку" 
        }, { status: 400 });
      }
    }

    // Находим дефолтную воронку для перемещения сделок
    const defaultPipeline = await prisma.pipeline.findFirst({
      where: {
        companyId,
        isDefault: true,
        id: { not: pipelineId }
      }
    }) || await prisma.pipeline.findFirst({
      where: {
        companyId,
        id: { not: pipelineId }
      }
    });

    if (defaultPipeline) {
      // Перемещаем все сделки из удаляемой воронки в дефолтную
      await prisma.deal.updateMany({
        where: {
          pipelineId: pipelineId
        },
        data: {
          pipelineId: defaultPipeline.id
        }
      });
    } else {
      // Если нет другой воронки, удаляем сделки (или можно оставить их без воронки)
      // Для безопасности просто обнуляем pipelineId
      await prisma.deal.updateMany({
        where: {
          pipelineId: pipelineId
        },
        data: {
          pipelineId: null
        }
      });
    }

    // Удаляем воронку
    await prisma.pipeline.delete({
      where: { id: pipelineId }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting pipeline:', error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

