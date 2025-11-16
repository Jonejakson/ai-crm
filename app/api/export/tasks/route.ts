import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, getUserId } from "@/lib/get-session";

// Экспорт задач в CSV
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    const userId = getUserId(user);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'csv';

    const tasks = await prisma.task.findMany({
      where: { userId: userId },
      include: { contact: true },
      orderBy: { createdAt: 'desc' }
    });

    // Заголовки CSV
    const headers = ['ID', 'Название', 'Описание', 'Статус', 'Дедлайн', 'Контакт', 'Дата создания'];
    const fields = ['id', 'title', 'description', 'status', 'dueDate', 'contact', 'createdAt'];

    // Конвертация данных
    const csvData = tasks.map(task => ({
      id: task.id,
      title: task.title || '',
      description: (task.description || '').replace(/\n/g, ' '),
      status: task.status === 'completed' ? 'Завершена' : 
              task.status === 'in_progress' ? 'В работе' : 
              task.status === 'pending' ? 'Ожидает' : task.status,
      dueDate: task.dueDate ? new Date(task.dueDate).toLocaleDateString('ru-RU') : '',
      contact: task.contact?.name || '',
      createdAt: new Date(task.createdAt).toLocaleDateString('ru-RU')
    }));

    // Генерация CSV с разделителем точка с запятой (для Excel)
    const BOM = '\uFEFF';
    const delimiter = ';'; // Точка с запятой для русской версии Excel
    const csvHeaders = headers.join(delimiter);
    const csvRows = csvData.map(row => {
      return [
        row.id,
        `"${(row.title || '').replace(/"/g, '""')}"`,
        `"${(row.description || '').replace(/"/g, '""')}"`,
        `"${row.status}"`,
        `"${row.dueDate}"`,
        `"${(row.contact || '').replace(/"/g, '""')}"`,
        `"${row.createdAt}"`
      ].join(delimiter);
    });

    const csvContent = BOM + [csvHeaders, ...csvRows].join('\n');

    const filename = `tasks_${new Date().toISOString().split('T')[0]}.csv`;
    const mimeType = format === 'excel' ? 'application/vnd.ms-excel' : 'text/csv;charset=utf-8;';

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting tasks:', error);
    return NextResponse.json({
      error: process.env.NODE_ENV === 'development'
        ? `Error: ${error.message}`
        : "Internal Server Error"
    }, { status: 500 });
  }
}

