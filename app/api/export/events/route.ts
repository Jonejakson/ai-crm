import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, getUserId } from "@/lib/get-session";

// Экспорт событий в CSV
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    const userId = getUserId(user);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'csv';

    const events = await prisma.event.findMany({
      where: { userId: userId },
      include: { contact: true },
      orderBy: { startDate: 'asc' }
    });

    // Заголовки CSV
    const headers = ['ID', 'Название', 'Описание', 'Дата начала', 'Дата окончания', 'Место', 'Тип', 'Контакт', 'Дата создания'];
    const fields = ['id', 'title', 'description', 'startDate', 'endDate', 'location', 'type', 'contact', 'createdAt'];

    // Конвертация данных
    const csvData = events.map(event => ({
      id: event.id,
      title: event.title || '',
      description: (event.description || '').replace(/\n/g, ' '),
      startDate: new Date(event.startDate).toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }),
      endDate: event.endDate ? new Date(event.endDate).toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }) : '',
      location: event.location || '',
      type: event.type === 'meeting' ? 'Встреча' :
            event.type === 'call' ? 'Звонок' :
            event.type === 'task' ? 'Задача' : 'Другое',
      contact: event.contact?.name || '',
      createdAt: new Date(event.createdAt).toLocaleDateString('ru-RU')
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
        `"${row.startDate}"`,
        `"${row.endDate}"`,
        `"${(row.location || '').replace(/"/g, '""')}"`,
        `"${row.type}"`,
        `"${(row.contact || '').replace(/"/g, '""')}"`,
        `"${row.createdAt}"`
      ].join(delimiter);
    });

    const csvContent = BOM + [csvHeaders, ...csvRows].join('\n');

    const filename = `events_${new Date().toISOString().split('T')[0]}.csv`;
    const mimeType = format === 'excel' ? 'application/vnd.ms-excel' : 'text/csv;charset=utf-8;';

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting events:', error);
    return NextResponse.json({
      error: process.env.NODE_ENV === 'development'
        ? `Error: ${error.message}`
        : "Internal Server Error"
    }, { status: 500 });
  }
}

