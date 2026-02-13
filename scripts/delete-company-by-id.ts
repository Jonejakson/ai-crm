/**
 * Однократное удаление одной компании по ID и всех связанных данных.
 * Запуск: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/delete-company-by-id.ts 201540
 * На сервере: docker-compose exec -T app npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/delete-company-by-id.ts 201540
 */
import { PrismaClient } from '@prisma/client';

const companyId = parseInt(process.argv[2] || '0', 10);
if (!companyId || Number.isNaN(companyId)) {
  console.error('Usage: npx ts-node scripts/delete-company-by-id.ts <companyId>');
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  });
  if (!company) {
    console.error(`Company with id ${companyId} not found.`);
    process.exit(1);
  }
  console.log(`Deleting company id=${companyId} name="${company.name}" and all related data...`);

  const userIds = (await prisma.user.findMany({ where: { companyId }, select: { id: true } })).map((u) => u.id);
  const pipelineIds = (await prisma.pipeline.findMany({ where: { companyId }, select: { id: true } })).map((p) => p.id);

  await prisma.$transaction(async (tx) => {
    // 1) DealMoyskladItem для сделок компании (сделки в воронках компании или пользователей компании)
    const dealIds = await tx.deal.findMany({
      where: { OR: [{ pipelineId: { in: pipelineIds } }, { userId: { in: userIds } }] },
      select: { id: true },
    }).then((d) => d.map((x) => x.id));
    if (dealIds.length) await tx.dealMoyskladItem.deleteMany({ where: { dealId: { in: dealIds } } });

    // 2) Комментарии пользователей компании
    if (userIds.length) await tx.comment.deleteMany({ where: { userId: { in: userIds } } });

    // 3) Сделки (в воронках компании или пользователей компании)
    const dealWhere =
      pipelineIds.length && userIds.length
        ? { OR: [{ pipelineId: { in: pipelineIds } }, { userId: { in: userIds } }] }
        : pipelineIds.length
          ? { pipelineId: { in: pipelineIds } }
          : userIds.length
            ? { userId: { in: userIds } }
            : null;
    if (dealWhere) await tx.deal.deleteMany({ where: dealWhere });

    // 4) Контакты пользователей компании
    if (userIds.length) await tx.contact.deleteMany({ where: { userId: { in: userIds } } });

    // 5) Задачи
    if (userIds.length) await tx.task.deleteMany({ where: { userId: { in: userIds } } });

    // 6) События
    if (userIds.length) await tx.event.deleteMany({ where: { userId: { in: userIds } } });

    // 7) Уведомления
    if (userIds.length) await tx.notification.deleteMany({ where: { userId: { in: userIds } } });

    // 8) Файлы (могут быть привязаны к пользователю или к сообщениям тикетов)
    if (userIds.length) await tx.file.deleteMany({ where: { userId: { in: userIds } } });

    // 9) Логи активности компании
    await tx.activityLog.deleteMany({ where: { companyId } });

    // 10) Тикеты поддержки (Cascade удалит SupportTicketMessage)
    await tx.supportTicket.deleteMany({ where: { companyId } });

    // 11) Воронки (после удаления сделок)
    await tx.pipeline.deleteMany({ where: { companyId } });

    // 12) Счета и подписки
    const subIds = (await tx.subscription.findMany({ where: { companyId }, select: { id: true } })).map((s) => s.id);
    if (subIds.length) await tx.invoice.deleteMany({ where: { subscriptionId: { in: subIds } } });
    await tx.invoice.deleteMany({ where: { companyId } });
    await tx.subscription.deleteMany({ where: { companyId } });

    // 13) Остальное по companyId (модели с onDelete: Cascade не мешают, удаляем явно)
    await tx.automation.deleteMany({ where: { companyId } });
    await tx.tag.deleteMany({ where: { companyId } });
    await tx.customField.deleteMany({ where: { companyId } });
    await tx.dealSource.deleteMany({ where: { companyId } });
    await tx.dealType.deleteMany({ where: { companyId } });
    await tx.webForm.deleteMany({ where: { companyId } });
    await tx.emailIntegration.deleteMany({ where: { companyId } });
    await tx.webhookIntegration.deleteMany({ where: { companyId } });
    await tx.messagingIntegration.deleteMany({ where: { companyId } });
    await tx.advertisingIntegration.deleteMany({ where: { companyId } });
    await tx.accountingIntegration.deleteMany({ where: { companyId } });
    await tx.emailTemplate.deleteMany({ where: { companyId } });

    // 14) Пользователи компании
    await tx.user.deleteMany({ where: { companyId } });

    // 15) Компания
    await tx.company.delete({ where: { id: companyId } });
  });

  console.log(`Company id=${companyId} "${company.name}" deleted.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
