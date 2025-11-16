import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/get-session';
import OpenAI from 'openai';

export async function POST(req: Request) {
  try {
    const { message, contactId } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "Message is required" });
    }

    console.log('AI Request:', message);

    // Получаем данные из БД
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [contacts, tasks, deals] = await Promise.all([
      prisma.contact.findMany({
        where: { userId: parseInt(user.id) },
        include: { 
          tasks: true, 
          dialogs: {
            orderBy: { createdAt: 'desc' },
            take: 10
          },
          deals: true
        }
      }),
      prisma.task.findMany({
        where: { 
          status: 'pending',
          userId: parseInt(user.id)
        },
        include: { contact: true },
        orderBy: { dueDate: 'asc' }
      }),
      prisma.deal.findMany({
        where: { userId: parseInt(user.id) },
        include: { contact: true },
        orderBy: { updatedAt: 'desc' }
      })
    ]);

    // Формируем контекст для AI
    let contactContext = '';
    if (contactId) {
      const contact = contacts.find(c => c.id === Number(contactId));
      if (contact) {
        const activeTasks = contact.tasks.filter(t => t.status === 'pending');
        contactContext = `
Информация о текущем клиенте:
- Имя: ${contact.name}
- Email: ${contact.email}
- Телефон: ${contact.phone || 'не указан'}
- Компания: ${contact.company || 'не указана'}
- Активных задач: ${activeTasks.length}
- Последние сообщения: ${contact.dialogs.slice(0, 3).map(d => d.message).join('; ')}
`;
      }
    }

    const activeDeals = deals.filter(d => !d.stage.startsWith('closed_'));
    const totalDealsAmount = deals.reduce((sum, d) => sum + d.amount, 0);
    const wonDeals = deals.filter(d => d.stage === 'closed_won');
    const wonAmount = wonDeals.reduce((sum, d) => sum + d.amount, 0);

    const context = `
Ты AI ассистент в CRM системе. Отвечай кратко, по делу и на русском языке.

Данные CRM:
- Всего клиентов: ${contacts.length}
- Активных задач: ${tasks.length}
- Активных сделок: ${activeDeals.length}
- Общая сумма сделок: ${totalDealsAmount.toLocaleString('ru-RU')} ₽
- Выиграно сделок: ${wonDeals.length} на сумму ${wonAmount.toLocaleString('ru-RU')} ₽
${contactContext}
${tasks.length > 0 ? `- Ближайшие задачи: ${tasks.slice(0, 5).map(t => `${t.title}${t.contact ? ` (${t.contact.name})` : ''}${t.dueDate ? ` до ${new Date(t.dueDate).toLocaleDateString('ru-RU')}` : ''}`).join('; ')}` : ''}
${activeDeals.length > 0 ? `- Активные сделки: ${activeDeals.slice(0, 5).map(d => `"${d.title}" (${d.amount.toLocaleString('ru-RU')} ${d.currency}, этап: ${d.stage})`).join('; ')}` : ''}
${contacts.filter(c => c.tasks.some(t => t.status === 'pending')).length > 0 ? `- Клиенты, требующие внимания: ${contacts.filter(c => c.tasks.some(t => t.status === 'pending')).slice(0, 5).map(c => c.name).join(', ')}` : ''}

Вопрос пользователя: ${message}

Ответь на русском языке, используя данные выше. Будь конкретным и полезным.
`;

    // Проверяем наличие API ключа OpenAI
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
      console.log('Using demo mode - no API key');
      
      // Демо-режим с улучшенными ответами
      const lowerMessage = message.toLowerCase();
      let demoResponse = `📊 На основе ваших данных:\n`;
      demoResponse += `• Клиентов: ${contacts.length}\n`;
      demoResponse += `• Активных задач: ${tasks.length}\n`;
      demoResponse += `• Активных сделок: ${activeDeals.length}\n`;
      demoResponse += `• Общая сумма сделок: ${totalDealsAmount.toLocaleString('ru-RU')} ₽\n`;

      if (contactContext) {
        const contact = contacts.find(c => c.id === Number(contactId));
        if (contact) {
          demoResponse += `\n👤 О клиенте ${contact.name}:\n`;
          demoResponse += `• Email: ${contact.email}\n`;
          demoResponse += `• Активных задач: ${contact.tasks.filter(t => t.status === 'pending').length}\n`;
          demoResponse += `• Сделок: ${contact.deals.length}\n`;
        }
      }

      if (tasks.length > 0) {
        demoResponse += `\n📅 Ближайшие задачи: ${tasks.slice(0, 3).map(t => t.title).join(', ')}\n`;
      }

      if (activeDeals.length > 0) {
        demoResponse += `\n💰 Активные сделки: ${activeDeals.slice(0, 3).map(d => d.title).join(', ')}\n`;
      }

      const clientsWithTasks = contacts.filter(c => c.tasks.some(t => t.status === 'pending'));
      if (clientsWithTasks.length > 0) {
        demoResponse += `\n🔔 Внимания требуют: ${clientsWithTasks.slice(0, 3).map(c => c.name).join(', ')}\n`;
      }

      demoResponse += `\n💡 Для полноценной работы AI добавьте OPENAI_API_KEY в .env файл`;
      
      return NextResponse.json({ 
        response: demoResponse,
        mode: 'demo'
      });
    }

    // Реальный запрос к OpenAI
    console.log('Making OpenAI API call');
    
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Ты полезный AI ассистент в CRM системе. Отвечай кратко, по делу и на русском языке. Используй данные из контекста для конкретных ответов."
        },
        {
          role: "user",
          content: context
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const aiResponse = completion.choices[0]?.message?.content || "Не удалось получить ответ от AI";

    return NextResponse.json({
      response: aiResponse,
      mode: 'openai'
    });

  } catch (error) {
    console.error('AI Error:', error);
    
    // Если ошибка OpenAI, возвращаем демо-режим
    if (error instanceof Error && error.message.includes('API key')) {
      return NextResponse.json({
        response: "❌ Неверный API ключ OpenAI. Проверьте переменную окружения OPENAI_API_KEY.",
        error: true,
        mode: 'error'
      }, { status: 500 });
    }

    return NextResponse.json({
      response: "❌ Ошибка сервиса. Попробуйте позже.",
      error: true
    }, { status: 500 });
  }
}