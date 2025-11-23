import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/get-session";

// Получить все типы сделок компании
export async function GET() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const companyId = parseInt(user.companyId);

    const types = await prisma.dealType.findMany({
      where: {
        companyId,
      },
      orderBy: {
        order: 'asc',
      },
    });

    return NextResponse.json(types);
  } catch (error: any) {
    console.error('Error fetching deal types:', error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Создать тип сделок
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

    const dealType = await prisma.dealType.create({
      data: {
        name: data.name,
        companyId,
        order: data.order || 0,
      },
    });
    
    return NextResponse.json(dealType);
  } catch (error: any) {
    console.error('Error creating deal type:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: "Type with this name already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Обновить тип сделок
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

    // Проверяем, что тип принадлежит компании
    const existingType = await prisma.dealType.findFirst({
      where: {
        id: data.id,
        companyId,
      }
    });

    if (!existingType) {
      return NextResponse.json({ error: "Type not found or access denied" }, { status: 404 });
    }

    const updateData: any = {};
    
    if (data.name) {
      updateData.name = data.name;
    }
    
    if (data.order !== undefined) {
      updateData.order = data.order;
    }

    const dealType = await prisma.dealType.update({
      where: { id: data.id },
      data: updateData,
    });
    
    return NextResponse.json(dealType);
  } catch (error: any) {
    console.error('Error updating deal type:', error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Удалить тип сделок
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

    // Проверяем, что тип принадлежит компании
    const existingType = await prisma.dealType.findFirst({
      where: {
        id: parseInt(id),
        companyId,
      }
    });

    if (!existingType) {
      return NextResponse.json({ error: "Type not found or access denied" }, { status: 404 });
    }

    await prisma.dealType.delete({
      where: { id: parseInt(id) },
    });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting deal type:', error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

