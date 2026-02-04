import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/get-session";
import { getDirectWhereCondition } from "@/lib/access-control";
import { isClosedWonStage } from "@/lib/dealStages";
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

/**
 * Экспорт аналитики в CSV, Excel или PDF
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'deals'; // deals, tasks, contacts, managers, sales, forecast
    const period = searchParams.get('period') || 'month';
    const format = searchParams.get('format') || 'csv'; // csv, xlsx, pdf

    // Вычисляем даты для периода
    const now = new Date();
    const startDate = new Date();
    
    switch (period) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    const [whereContact, whereDeal] = await Promise.all([
      getDirectWhereCondition('contact'),
      getDirectWhereCondition('deal'),
    ]);

    let data: any[] = [];
    let headers: string[] = [];
    let filename = '';

    // Получаем данные в зависимости от типа
    switch (type) {
      case 'deals': {
        const deals = await prisma.deal.findMany({
          where: {
            ...whereDeal,
            createdAt: { gte: startDate },
          },
          include: {
            contact: {
              select: {
                name: true,
                email: true,
                company: true,
              },
            },
            user: {
              select: {
                name: true,
                email: true,
              },
            },
            pipeline: {
              select: {
                name: true,
              },
            },
          },
        });

        headers = ['Название', 'Клиент', 'Email', 'Компания', 'Менеджер', 'Воронка', 'Сумма', 'Валюта', 'Этап', 'Вероятность', 'Дата создания', 'Ожидаемая дата закрытия'];
        data = deals.map(deal => ({
          'Название': deal.title,
          'Клиент': deal.contact?.name || '',
          'Email': deal.contact?.email || '',
          'Компания': deal.contact?.company || '',
          'Менеджер': deal.user?.name || '',
          'Воронка': deal.pipeline?.name || '',
          'Сумма': deal.amount,
          'Валюта': deal.currency,
          'Этап': deal.stage,
          'Вероятность': deal.probability,
          'Дата создания': new Date(deal.createdAt).toLocaleDateString('ru-RU'),
          'Ожидаемая дата закрытия': deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString('ru-RU') : '',
        }));

        filename = `deals_${period}_${new Date().toISOString().split('T')[0]}`;
        break;
      }

      case 'tasks': {
        const tasks = await prisma.task.findMany({
          where: {
            ...whereContact,
            createdAt: { gte: startDate },
          },
          include: {
            contact: {
              select: {
                name: true,
              },
            },
            user: {
              select: {
                name: true,
              },
            },
          },
        });

        headers = ['Название', 'Описание', 'Статус', 'Клиент', 'Менеджер', 'Срок выполнения', 'Дата создания'];
        data = tasks.map(task => ({
          'Название': task.title,
          'Описание': task.description || '',
          'Статус': task.status,
          'Клиент': task.contact?.name || '',
          'Менеджер': task.user?.name || '',
          'Срок выполнения': task.dueDate ? new Date(task.dueDate).toLocaleDateString('ru-RU') : '',
          'Дата создания': new Date(task.createdAt).toLocaleDateString('ru-RU'),
        }));

        filename = `tasks_${period}_${new Date().toISOString().split('T')[0]}`;
        break;
      }

      case 'contacts': {
        const contacts = await prisma.contact.findMany({
          where: {
            ...whereContact,
            createdAt: { gte: startDate },
          },
          include: {
            user: {
              select: {
                name: true,
              },
            },
            deals: {
              select: {
                id: true,
                amount: true,
                stage: true,
              },
            },
          },
        });

        headers = ['Имя', 'Email', 'Телефон', 'Компания', 'Менеджер', 'Количество сделок', 'Сумма сделок', 'Дата создания'];
        data = contacts.map(contact => {
          const dealsAmount = contact.deals.reduce((sum, d) => sum + d.amount, 0);
          return {
            'Имя': contact.name,
            'Email': contact.email || '',
            'Телефон': contact.phone || '',
            'Компания': contact.company || '',
            'Менеджер': contact.user?.name || '',
            'Количество сделок': contact.deals.length,
            'Сумма сделок': dealsAmount,
            'Дата создания': new Date(contact.createdAt).toLocaleDateString('ru-RU'),
          };
        });

        filename = `contacts_${period}_${new Date().toISOString().split('T')[0]}`;
        break;
      }

      case 'managers': {
        // Получаем данные менеджеров
        const managers = await prisma.user.findMany({
          where: {
            companyId: parseInt(user.companyId),
            role: { in: ['manager', 'user'] },
          },
          select: {
            id: true,
            name: true,
            email: true,
          },
        });

        const managersStats = await Promise.all(
          managers.map(async (manager) => {
            const [deals, tasks, contacts] = await Promise.all([
              prisma.deal.findMany({
                where: {
                  userId: manager.id,
                  createdAt: { gte: startDate },
                },
              }),
              prisma.task.findMany({
                where: {
                  userId: manager.id,
                  createdAt: { gte: startDate },
                },
              }),
              prisma.contact.findMany({
                where: {
                  userId: manager.id,
                  createdAt: { gte: startDate },
                },
                include: {
                  deals: {
                    select: {
                      id: true,
                    },
                  },
                },
              }),
            ]);

            const wonDeals = deals.filter(d => isClosedWonStage(d.stage));
            const wonAmount = wonDeals.reduce((sum, d) => sum + d.amount, 0);
            const completedTasks = tasks.filter(t => t.status === 'completed');

            return {
              'Менеджер': manager.name,
              'Email': manager.email,
              'Всего сделок': deals.length,
              'Закрыто успешно сделок': wonDeals.length,
              'Сумма закрытых сделок': wonAmount,
              'Конверсия (%)': deals.length > 0 ? ((wonDeals.length / deals.length) * 100).toFixed(1) : '0',
              'Всего задач': tasks.length,
              'Завершено задач': completedTasks.length,
              'Выполнение (%)': tasks.length > 0 ? ((completedTasks.length / tasks.length) * 100).toFixed(1) : '0',
              'Контактов': contacts.length,
              'Контактов со сделками': contacts.filter(c => c.deals.length > 0).length,
            };
          })
        );

        headers = ['Менеджер', 'Email', 'Всего сделок', 'Закрыто успешно сделок', 'Сумма закрытых сделок', 'Конверсия (%)', 'Всего задач', 'Завершено задач', 'Выполнение (%)', 'Контактов', 'Контактов со сделками'];
        data = managersStats;

        filename = `managers_${period}_${new Date().toISOString().split('T')[0]}`;
        break;
      }

      default:
        return NextResponse.json({ error: 'Invalid export type' }, { status: 400 });
    }

    // Генерируем файл в зависимости от формата
    if (format === 'csv') {
      // CSV экспорт
      let csvContent = '\uFEFF'; // BOM для UTF-8
      csvContent += headers.join(',') + '\n';
      
      for (const row of data) {
        csvContent += headers.map(header => {
          const value = row[header];
          return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
        }).join(',') + '\n';
      }

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}.csv"`,
        },
      });
    } else if (format === 'xlsx') {
      // Excel экспорт
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Данные');
      
      // Настройка ширины колонок
      const colWidths = headers.map(() => ({ wch: 15 }));
      worksheet['!cols'] = colWidths;

      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      return new NextResponse(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
        },
      });
    } else if (format === 'pdf') {
      // PDF экспорт
      const doc = new jsPDF('l', 'mm', 'a4'); // landscape orientation
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const rowHeight = 7;
      const startY = 20;
      let currentY = startY;

      // Заголовок
      doc.setFontSize(16);
      doc.text(`${type === 'deals' ? 'Сделки' : type === 'tasks' ? 'Задачи' : type === 'contacts' ? 'Контакты' : 'Менеджеры'} - ${period}`, margin, currentY);
      currentY += 10;

      // Таблица
      doc.setFontSize(10);
      const colWidths: number[] = [];
      const numCols = headers.length;
      const availableWidth = pageWidth - 2 * margin;
      const colWidth = availableWidth / numCols;

      // Заголовки таблицы
      doc.setFillColor(63, 102, 241); // indigo-500
      doc.setTextColor(255, 255, 255);
      doc.rect(margin, currentY, availableWidth, rowHeight, 'F');
      
      headers.forEach((header, index) => {
        const x = margin + index * colWidth;
        doc.text(header, x + 2, currentY + 5);
      });
      currentY += rowHeight;

      // Данные
      doc.setTextColor(0, 0, 0);
      data.forEach((row, rowIndex) => {
        if (currentY + rowHeight > pageHeight - margin) {
          doc.addPage();
          currentY = margin;
        }

        // Чередование цветов строк
        if (rowIndex % 2 === 0) {
          doc.setFillColor(249, 250, 251);
          doc.rect(margin, currentY, availableWidth, rowHeight, 'F');
        }

        headers.forEach((header, colIndex) => {
          const x = margin + colIndex * colWidth;
          const value = String(row[header] || '');
          // Обрезаем длинные значения
          const displayValue = value.length > 20 ? value.substring(0, 17) + '...' : value;
          doc.text(displayValue, x + 2, currentY + 5);
        });

        currentY += rowHeight;
      });

      const pdfBuffer = Buffer.from(doc.output('arraybuffer') as ArrayBuffer);

      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}.pdf"`,
        },
      });
    } else {
      return NextResponse.json({ error: 'Invalid format. Use csv, xlsx, or pdf' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error exporting analytics:', error);
    return NextResponse.json({ 
      error: process.env.NODE_ENV === 'development' 
        ? `Error: ${error.message}` 
        : "Internal Server Error"
    }, { status: 500 });
  }
}
