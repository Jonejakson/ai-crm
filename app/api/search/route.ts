import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/get-session";
import { getDirectWhereCondition } from "@/lib/access-control";
import { validateQuery, searchSchema } from "@/lib/validation";

// Улучшенный универсальный поиск по всем сущностям с поддержкой тегов
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const type = searchParams.get('type') || 'all'; // all, contacts, tasks, deals, events
    const tagIds = searchParams.get('tags')?.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) || [];

    if (!query.trim() && tagIds.length === 0) {
      return NextResponse.json({
        contacts: [],
        tasks: [],
        deals: [],
        events: []
      });
    }

    const searchLower = query.toLowerCase();
    const [whereContact, whereDeal] = await Promise.all([
      getDirectWhereCondition('contact'),
      getDirectWhereCondition('deal'),
    ]);

    const results: any = {
      contacts: [],
      tasks: [],
      deals: [],
      events: []
    };

    // Поиск по контактам
    if (type === 'all' || type === 'contacts') {
      let contactsWhere: any = whereContact;

      // Фильтр по тегам
      if (tagIds.length > 0) {
        contactsWhere = {
          ...whereContact,
          tags: {
            some: {
              tagId: { in: tagIds }
            }
          }
        };
      }

      const allContacts = await prisma.contact.findMany({
        where: contactsWhere,
        include: {
          tags: {
            include: {
              tag: true
            }
          }
        },
        take: 100
      });
      
      // Фильтруем на стороне JS с нечувствительностью к регистру
      results.contacts = allContacts
        .filter(contact => {
          if (query.trim()) {
            const name = (contact.name || '').toLowerCase();
            const email = (contact.email || '').toLowerCase();
            const phone = (contact.phone || '').toLowerCase();
            const company = (contact.company || '').toLowerCase();
            
            const matchesSearch = name.includes(searchLower) || 
                                 email.includes(searchLower) || 
                                 phone.includes(searchLower) || 
                                 company.includes(searchLower);
            
            if (!matchesSearch) return false;
          }
          
          // Если есть фильтр по тегам, проверяем наличие тегов
          if (tagIds.length > 0) {
            const contactTagIds = contact.tags.map(ct => ct.tagId);
            return tagIds.some(tagId => contactTagIds.includes(tagId));
          }
          
          return true;
        })
        .slice(0, 10)
        .map(contact => ({
          id: contact.id,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          company: contact.company,
          tags: contact.tags.map(ct => ({
            id: ct.tag.id,
            name: ct.tag.name,
            color: ct.tag.color
          }))
        }));
    }

    // Поиск по задачам
    if (type === 'all' || type === 'tasks') {
      const allTasks = await prisma.task.findMany({
        where: whereContact,
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
          if (!query.trim()) return true;
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
      let dealsWhere: any = whereDeal;

      // Фильтр по тегам
      if (tagIds.length > 0) {
        dealsWhere = {
          ...whereDeal,
          tags: {
            some: {
              tagId: { in: tagIds }
            }
          }
        };
      }

      const allDeals = await prisma.deal.findMany({
        where: dealsWhere,
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          tags: {
            include: {
              tag: true
            }
          }
        },
        take: 100
      });
      
      results.deals = allDeals
        .filter(deal => {
          if (query.trim()) {
            const title = (deal.title || '').toLowerCase();
            if (!title.includes(searchLower)) return false;
          }
          
          // Если есть фильтр по тегам, проверяем наличие тегов
          if (tagIds.length > 0) {
            const dealTagIds = deal.tags.map(dt => dt.tagId);
            return tagIds.some(tagId => dealTagIds.includes(tagId));
          }
          
          return true;
        })
        .slice(0, 10)
        .map(deal => ({
          id: deal.id,
          title: deal.title,
          amount: deal.amount,
          currency: deal.currency,
          stage: deal.stage,
          contact: deal.contact,
          tags: deal.tags.map(dt => ({
            id: dt.tag.id,
            name: dt.tag.name,
            color: dt.tag.color
          }))
        }));
    }

    // Поиск по событиям
    if (type === 'all' || type === 'events') {
      const allEvents = await prisma.event.findMany({
        where: whereContact,
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
          if (!query.trim()) return true;
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
