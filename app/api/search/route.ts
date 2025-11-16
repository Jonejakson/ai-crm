import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, getUserId } from "@/lib/get-session";

// Универсальный поиск по всем сущностям
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    
    const userId = getUserId(user);
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const type = searchParams.get('type') || 'all'; // all, contacts, tasks, deals, events

    if (!query.trim()) {
      return NextResponse.json({
        contacts: [],
        tasks: [],
        deals: [],
        events: []
      });
    }

    const searchLower = query.toLowerCase();
    const searchPattern = `%${searchLower}%`;

    const results: any = {
      contacts: [],
      tasks: [],
      deals: [],
      events: []
    };

    // Поиск по контактам (используем LOWER для нечувствительности к регистру в SQLite)
    if (type === 'all' || type === 'contacts') {
      console.log('Searching contacts:', { query, searchLower, searchPattern, userId });
      
      // Используем обычный findMany с фильтрацией на стороне JS для надежности
      const allContacts = await prisma.contact.findMany({
        where: {
          userId: userId
        },
        take: 100 // Берем больше, чтобы потом отфильтровать
      });
      
      // Фильтруем на стороне JS с нечувствительностью к регистру
      results.contacts = allContacts
        .filter(contact => {
          const name = (contact.name || '').toLowerCase();
          const email = (contact.email || '').toLowerCase();
          const phone = (contact.phone || '').toLowerCase();
          const company = (contact.company || '').toLowerCase();
          
          return name.includes(searchLower) || 
                 email.includes(searchLower) || 
                 phone.includes(searchLower) || 
                 company.includes(searchLower);
        })
        .slice(0, 10)
        .map(contact => ({
          id: contact.id,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          company: contact.company
        }));
      
      console.log('Processed contacts:', results.contacts);
    }

    // Поиск по задачам
    if (type === 'all' || type === 'tasks') {
      const allTasks = await prisma.task.findMany({
        where: {
          userId: userId
        },
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        take: 100
      });
      
      results.tasks = allTasks
        .filter(task => {
          const title = (task.title || '').toLowerCase();
          const description = (task.description || '').toLowerCase();
          return title.includes(searchLower) || description.includes(searchLower);
        })
        .slice(0, 10)
        .map(task => ({
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          contact: task.contact
        }));
    }

    // Поиск по сделкам
    if (type === 'all' || type === 'deals') {
      const allDeals = await prisma.deal.findMany({
        where: {
          userId: userId
        },
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        take: 100
      });
      
      results.deals = allDeals
        .filter(deal => {
          const title = (deal.title || '').toLowerCase();
          return title.includes(searchLower);
        })
        .slice(0, 10)
        .map(deal => ({
          id: deal.id,
          title: deal.title,
          amount: deal.amount,
          currency: deal.currency,
          stage: deal.stage,
          contact: deal.contact
        }));
    }

    // Поиск по событиям
    if (type === 'all' || type === 'events') {
      const allEvents = await prisma.event.findMany({
        where: {
          userId: userId
        },
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        take: 100
      });
      
      results.events = allEvents
        .filter(event => {
          const title = (event.title || '').toLowerCase();
          const description = (event.description || '').toLowerCase();
          const location = (event.location || '').toLowerCase();
          return title.includes(searchLower) || 
                 description.includes(searchLower) || 
                 location.includes(searchLower);
        })
        .slice(0, 10)
        .map(event => ({
          id: event.id,
          title: event.title,
          startDate: event.startDate,
          type: event.type,
          contact: event.contact
        }));
    }

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('Error searching:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    
    return NextResponse.json({ 
      error: process.env.NODE_ENV === 'development' 
        ? `Error: ${error.message}` 
        : "Internal Server Error",
      contacts: [],
      tasks: [],
      deals: [],
      events: []
    }, { status: 500 });
  }
}
