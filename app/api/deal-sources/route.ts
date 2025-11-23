import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/get-session";

// Получить все источники сделок компании
export async function GET() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const companyId = parseInt(user.companyId);

    const sources = await prisma.dealSource.findMany({
      where: {
        companyId,
      },
      include: {
        pipeline: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: {
        order: 'asc',
      },
    });

    return NextResponse.json(sources);
  } catch (error: any) {
    console.error('Error fetching deal sources:', error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Создать источник сделок
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    
    if (!data.name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const companyId = parseInt(user.companyId);

    const source = await prisma.dealSource.create({
      data: {
        name: data.name,
        companyId,
        pipelineId: data.pipelineId ? parseInt(data.pipelineId) : null,
        order: data.order || 0,
      },
      include: {
        pipeline: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });
    
    return NextResponse.json(source);
  } catch (error: any) {
    console.error('Error creating deal source:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: "Source with this name already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Обновить источник сделок
export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    
    if (!data.id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const companyId = parseInt(user.companyId);

    // Проверяем, что источник принадлежит компании
    const existingSource = await prisma.dealSource.findFirst({
      where: {
        id: data.id,
        companyId,
      }
    });

    if (!existingSource) {
      return NextResponse.json({ error: "Source not found or access denied" }, { status: 404 });
    }

    const updateData: any = {};
    
    if (data.name) {
      updateData.name = data.name;
    }
    
    if (data.pipelineId !== undefined) {
      updateData.pipelineId = data.pipelineId ? parseInt(data.pipelineId) : null;
    }
    
    if (data.order !== undefined) {
      updateData.order = data.order;
    }

    const source = await prisma.dealSource.update({
      where: { id: data.id },
      data: updateData,
      include: {
        pipeline: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });
    
    return NextResponse.json(source);
  } catch (error: any) {
    console.error('Error updating deal source:', error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Удалить источник сделок
export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const companyId = parseInt(user.companyId);

    // Проверяем, что источник принадлежит компании
    const existingSource = await prisma.dealSource.findFirst({
      where: {
        id: parseInt(id),
        companyId,
      }
    });

    if (!existingSource) {
      return NextResponse.json({ error: "Source not found or access denied" }, { status: 404 });
    }

    await prisma.dealSource.delete({
      where: { id: parseInt(id) },
    });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting deal source:', error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

