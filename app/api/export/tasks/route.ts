import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, getUserId } from "@/lib/get-session";
import { jsPDF } from 'jspdf';

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

    if (format === 'pdf') {
      // PDF экспорт
      const doc = new jsPDF('l', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const rowHeight = 7;
      const startY = 20;
      let currentY = startY;

      doc.setFontSize(16);
      doc.text('Задачи', margin, currentY);
      currentY += 10;

      doc.setFontSize(10);
      const numCols = headers.length;
      const availableWidth = pageWidth - 2 * margin;
      const colWidth = availableWidth / numCols;

      doc.setFillColor(63, 102, 241);
      doc.setTextColor(255, 255, 255);
      doc.rect(margin, currentY, availableWidth, rowHeight, 'F');
      
      headers.forEach((header, index) => {
        const x = margin + index * colWidth;
        doc.text(header, x + 2, currentY + 5);
      });
      currentY += rowHeight;

      doc.setTextColor(0, 0, 0);
      csvData.forEach((row, rowIndex) => {
        if (currentY + rowHeight > pageHeight - margin) {
          doc.addPage();
          currentY = margin;
        }

        if (rowIndex % 2 === 0) {
          doc.setFillColor(249, 250, 251);
          doc.rect(margin, currentY, availableWidth, rowHeight, 'F');
        }

        headers.forEach((header, colIndex) => {
          const x = margin + colIndex * colWidth;
          const fieldKey = fields[colIndex] as keyof typeof row;
          const value = String((row[fieldKey] as any) || '');
          const displayValue = value.length > 20 ? value.substring(0, 17) + '...' : value;
          doc.text(displayValue, x + 2, currentY + 5);
        });

        currentY += rowHeight;
      });

      const pdfBuffer = Buffer.from(doc.output('arraybuffer') as ArrayBuffer);

      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="tasks_${new Date().toISOString().split('T')[0]}.pdf"`,
        },
      });
    }

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

