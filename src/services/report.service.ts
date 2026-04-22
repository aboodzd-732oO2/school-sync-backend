import { prisma } from '../config/db';

export async function generateMonthlyReport(institutionId: number) {
  const institution = await prisma.institution.findUnique({ where: { id: institutionId } });
  if (!institution) throw new Error('المؤسسة غير موجودة');

  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  // return existing if already generated this month (idempotent)
  const existing = await prisma.monthlyReport.findUnique({
    where: { month_year_institutionId: { month, year, institutionId } },
  });
  if (existing) return existing;

  // aggregate this month's requests
  const requests = await prisma.request.findMany({
    where: {
      institutionId,
      dateSubmitted: {
        gte: new Date(year, month, 1),
        lt: new Date(year, month + 1, 1),
      },
    },
  });

  return prisma.monthlyReport.create({
    data: {
      month,
      year,
      institutionId,
      institutionName: institution.name, // snapshot for display
      totalRequests: requests.length,
      completedRequests: requests.filter(r => r.status === 'completed').length,
      pendingRequests: requests.filter(r => r.status === 'pending').length,
      inProgressRequests: requests.filter(r => r.status === 'in_progress').length,
      totalItems: requests.reduce((sum, r) => sum + r.quantity, 0),
      totalStudentsAffected: requests.reduce((sum, r) => sum + r.studentsAffected, 0),
    },
  });
}

export async function getReports(
  institutionId: number,
  filters?: { year?: number; month?: number },
) {
  const where: any = { institutionId };
  if (filters?.year !== undefined) where.year = filters.year;
  if (filters?.month !== undefined) where.month = filters.month;

  return prisma.monthlyReport.findMany({
    where,
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });
}

export async function getReportById(reportId: number, institutionId?: number) {
  const report = await prisma.monthlyReport.findUnique({ where: { id: reportId } });
  if (!report) throw new Error('التقرير غير موجود');

  // ownership check (IDOR guard) — institutionId FK
  if (institutionId !== undefined && report.institutionId !== institutionId) {
    throw new Error('التقرير غير موجود');
  }

  return report;
}
