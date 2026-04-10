import { prisma } from '../config/db';

export async function generateMonthlyReport(institutionId: number) {
  const institution = await prisma.institution.findUnique({ where: { id: institutionId } });
  if (!institution) throw new Error('المؤسسة غير موجودة');

  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  // تحقق إذا التقرير موجود
  const existing = await prisma.monthlyReport.findUnique({
    where: { month_year_institutionName: { month, year, institutionName: institution.name } }
  });
  if (existing) return existing;

  // اجمع الإحصائيات
  const requests = await prisma.request.findMany({
    where: {
      institutionId,
      dateSubmitted: {
        gte: new Date(year, month, 1),
        lt: new Date(year, month + 1, 1),
      }
    }
  });

  const report = await prisma.monthlyReport.create({
    data: {
      month,
      year,
      institutionName: institution.name,
      totalRequests: requests.length,
      completedRequests: requests.filter(r => r.status === 'completed').length,
      pendingRequests: requests.filter(r => r.status === 'pending').length,
      inProgressRequests: requests.filter(r => r.status === 'in_progress').length,
      totalItems: requests.reduce((sum, r) => sum + r.quantity, 0),
      totalStudentsAffected: requests.reduce((sum, r) => sum + r.studentsAffected, 0),
    }
  });

  return report;
}

export async function getReports(institutionId: number) {
  const institution = await prisma.institution.findUnique({ where: { id: institutionId } });
  if (!institution) throw new Error('المؤسسة غير موجودة');

  return prisma.monthlyReport.findMany({
    where: { institutionName: institution.name },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });
}

export async function getReportById(reportId: number) {
  const report = await prisma.monthlyReport.findUnique({ where: { id: reportId } });
  if (!report) throw new Error('التقرير غير موجود');
  return report;
}
