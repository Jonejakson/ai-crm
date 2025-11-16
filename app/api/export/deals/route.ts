import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, getUserId } from "@/lib/get-session";

// Экспорт сделок в CSV
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    const userId = getUserId(user);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'csv';

    const deals = await prisma.deal.findMany({
      where: { userId: userId },
      include: { 
        contact: true,
        pipeline: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Заголовки CSV
    const headers = ['ID', 'Название', 'Сумма', 'Валюта', 'Этап', 'Вероятность (%)', 'Ожидаемая дата закрытия', 'Контакт', 'Воронка', 'Дата создания'];
    const fields = ['id', 'title', 'amount', 'currency', 'stage', 'probability', 'expectedCloseDate', 'contact', 'pipeline', 'createdAt'];

    // Конвертация данных
    const csvData = deals.map(deal => ({
      id: deal.id,
      title: deal.title || '',
      amount: deal.amount || 0,
      currency: deal.currency || 'RUB',
      stage: deal.stage || '',
      probability: deal.probability || 0,
      expectedCloseDate: deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString('ru-RU') : '',
      contact: deal.contact?.name || '',
      pipeline: deal.pipeline?.name || '',
      createdAt: new Date(deal.createdAt).toLocaleDateString('ru-RU')
    }));

    // Генерация CSV с разделителем точка с запятой (для Excel)
    const BOM = '\uFEFF';
    const delimiter = ';'; // Точка с запятой для русской версии Excel
    const csvHeaders = headers.join(delimiter);
    const csvRows = csvData.map(row => {
      return [
        row.id,
        `"${(row.title || '').replace(/"/g, '""')}"`,
        row.amount,
        row.currency,
        `"${row.stage}"`,
        row.probability,
        `"${row.expectedCloseDate}"`,
        `"${(row.contact || '').replace(/"/g, '""')}"`,
        `"${(row.pipeline || '').replace(/"/g, '""')}"`,
        `"${row.createdAt}"`
      ].join(delimiter);
    });

    const csvContent = BOM + [csvHeaders, ...csvRows].join('\n');

    const filename = `deals_${new Date().toISOString().split('T')[0]}.csv`;
    const mimeType = format === 'excel' ? 'application/vnd.ms-excel' : 'text/csv;charset=utf-8;';

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting deals:', error);
    return NextResponse.json({
      error: process.env.NODE_ENV === 'development'
        ? `Error: ${error.message}`
        : "Internal Server Error"
    }, { status: 500 });
  }
}

