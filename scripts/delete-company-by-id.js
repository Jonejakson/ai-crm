/**
 * Однократное удаление одной компании по ID и всех связанных данных.
 * Запуск на сервере (из /opt/flamecrm, DATABASE_URL в .env):
 *   node scripts/delete-company-by-id.js 201540
 * Или из хоста с подключением к postgres:
 *   DATABASE_URL="postgresql://crm_user:PASS@127.0.0.1:5432/crm_db" node scripts/delete-company-by-id.js 201540
 */
const { PrismaClient } = require('@prisma/client');

const companyId = parseInt(process.argv[2] || '0', 10);
if (!companyId || Number.isNaN(companyId)) {
  console.error('Usage: node scripts/delete-company-by-id.js <companyId>');
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

  const dealWhere =
    pipelineIds.length && userIds.length
      ? { OR: [{ pipelineId: { in: pipelineIds } }, { userId: { in: userIds } }] }
      : pipelineIds.length
        ? { pipelineId: { in: pipelineIds } }
        : userIds.length
          ? { userId: { in: userIds } }
          : null;

  await prisma.$transaction(async (tx) => {
    const dealIds = dealWhere
      ? (await tx.deal.findMany({ where: dealWhere, select: { id: true } })).map((x) => x.id)
      : [];
    if (dealIds.length) await tx.dealMoyskladItem.deleteMany({ where: { dealId: { in: dealIds } } });
    if (userIds.length) await tx.comment.deleteMany({ where: { userId: { in: userIds } } });
    if (dealWhere) await tx.deal.deleteMany({ where: dealWhere });
    if (userIds.length) await tx.contact.deleteMany({ where: { userId: { in: userIds } } });
    if (userIds.length) await tx.task.deleteMany({ where: { userId: { in: userIds } } });
    if (userIds.length) await tx.event.deleteMany({ where: { userId: { in: userIds } } });
    if (userIds.length) await tx.notification.deleteMany({ where: { userId: { in: userIds } } });
    if (userIds.length) await tx.file.deleteMany({ where: { userId: { in: userIds } } });
    await tx.activityLog.deleteMany({ where: { companyId } });
    await tx.supportTicket.deleteMany({ where: { companyId } });
    await tx.pipeline.deleteMany({ where: { companyId } });
    const subIds = (await tx.subscription.findMany({ where: { companyId }, select: { id: true } })).map((s) => s.id);
    if (subIds.length) await tx.invoice.deleteMany({ where: { subscriptionId: { in: subIds } } });
    await tx.invoice.deleteMany({ where: { companyId } });
    await tx.subscription.deleteMany({ where: { companyId } });
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
    await tx.user.deleteMany({ where: { companyId } });
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
