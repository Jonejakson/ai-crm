import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/get-session";

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

