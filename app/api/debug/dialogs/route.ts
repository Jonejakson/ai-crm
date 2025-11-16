import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('DEBUG Dialog POST:', body);
    
    // Простая проверка - создаем запись в БД
    const testDialog = await prisma.dialog.create({
      data: {
        message: body.message || 'Test message',
        sender: body.sender || 'user',
        contactId: body.contactId || 1, // используем первый контакт если не указан
      }
    });
    
    return NextResponse.json({ 
      success: true, 
      testDialog,
      received: body 
    });
    
  } catch (error: any) {
    console.error('DEBUG Dialog Error:', error);
    return NextResponse.json({ 
      error: error?.message || 'Unknown error',
      success: false 
    }, { status: 500 });
  }
}