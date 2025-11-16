import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    // Проверяем Content-Type
    const contentType = req.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return NextResponse.json(
        { error: 'Invalid content type' },
        { status: 400 }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { message, contactId } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }

    console.log('AI Request:', { message, contactId });

    // Получаем данные из базы
    const [contacts, tasks] = await Promise.all([
      prisma.contact.findMany({
        include: {
          tasks: true,
          dialogs: {
            orderBy: { createdAt: 'desc' },
            take: 10
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.task.findMany({
        include: {
          contact: true
        },
        where: {
          status: 'pending'
        },
        orderBy: { dueDate: 'asc' }
      })
    ]);

    // Формируем контекст
    let contactContext = '';
    if (contactId) {
      const contact = contacts.find(c => c.id === Number(contactId));
      if (contact) {
        contactContext = `
Клиент: ${contact.name}
Email: ${contact.email}
Телефон: ${contact.phone || 'не указан'}
Компания: ${contact.company || 'не указана'}
Активные задачи: ${contact.tasks.filter(t => t.status === 'pending').length}
Всего сообщений: ${contact.dialogs.length}
`;
      }
    }

    const context = `
Ты AI ассистент в CRM системе. Отвечай кратко и по делу.

Данные CRM:
- Всего клиентов: ${contacts.length}
- Активных задач: ${tasks.length}
${contactContext}

Вопрос: ${message}

Ответь на русском, используя данные выше.
`;

    // Проверяем API ключ
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
      console.log('Using demo mode - no API key');
      
      // Простые демо-ответы
      const demoResponse = `Демо-режим: У вас ${contacts.length} клиентов и ${tasks.length} активных задач. ${contactContext ? `Текущий клиент: ${contacts.find(c => c.id === Number(contactId))?.name}` : ''}`;
      
      return NextResponse.json({ 
        response: demoResponse,
        mode: 'demo'
      });
    }

    // Реальный запрос к OpenAI
    console.log('Making OpenAI API call');
    
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Ты полезный ассистент CRM системы. Отвечай кратко и по делу.'
          },
          {
            role: 'user',
            content: context
          }
        ],
        max_tokens: 300,
        temperature: 0.7
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', openaiResponse.status, errorText);
      throw new Error(`OpenAI API: ${openaiResponse.status}`);
    }

    const data = await openaiResponse.json();
    const aiResponse = data.choices[0]?.message?.content || 'Нет ответа от AI';

    return NextResponse.json({ 
      response: aiResponse,
      mode: 'openai'
    });

  } catch (error) {
    console.error('AI API error:', error);
    
    return NextResponse.json(
      { 
        error: "AI service unavailable",
        response: "Извините, сервис временно недоступен. Попробуйте позже."
      }, 
      { status: 500 }
    );
  }
}