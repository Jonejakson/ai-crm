import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/get-session";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const body = await req.json();
    const contactId = Number(body?.contactId);
    const targetUserId = Number(body?.targetUserId);

    if (!contactId || !targetUserId) {
      return NextResponse.json(
        { error: "contactId и targetUserId обязательны" },
        { status: 400 }
      );
    }

    const companyId = parseInt(user.companyId);

    const [contact, targetUser] = await Promise.all([
      prisma.contact.findFirst({
        where: {
          id: contactId,
          user: {
            companyId,
          },
        },
        select: {
          id: true,
          name: true,
          userId: true,
        },
      }),
      prisma.user.findFirst({
        where: {
          id: targetUserId,
          companyId,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      }),
    ]);

    if (!contact) {
      return NextResponse.json(
        { error: "Контакт не найден или недоступен" },
        { status: 404 }
      );
    }

    if (!targetUser) {
      return NextResponse.json(
        { error: "Пользователь не найден или принадлежит другой компании" },
        { status: 404 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedContact = await tx.contact.update({
        where: { id: contactId },
        data: { userId: targetUserId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      const [tasks, deals, events] = await Promise.all([
        tx.task.updateMany({
          where: { contactId },
          data: { userId: targetUserId },
        }),
        tx.deal.updateMany({
          where: { contactId },
          data: { userId: targetUserId },
        }),
        tx.event.updateMany({
          where: { contactId },
          data: { userId: targetUserId },
        }),
      ]);

      return {
        contact: updatedContact,
        tasksUpdated: tasks.count,
        dealsUpdated: deals.count,
        eventsUpdated: events.count,
      };
    });

    return NextResponse.json({
      success: true,
      ...result,
      targetUser,
    });
  } catch (error) {
    console.error("Error reassigning contact manager:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

