import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('بذر البيانات...');

  // المحافظات السورية
  const governorates = [
    'دمشق', 'ريف دمشق', 'حلب', 'حمص', 'حماة', 'اللاذقية', 'طرطوس',
    'إدلب', 'الحسكة', 'دير الزور', 'الرقة', 'درعا', 'السويداء', 'القنيطرة'
  ];

  for (const name of governorates) {
    await prisma.governorate.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log('✓ المحافظات');

  // الأقسام
  const departments = [
    { key: 'materials', labelAr: 'قسم المواد والأثاث التعليمي' },
    { key: 'maintenance', labelAr: 'قسم الصيانة والإصلاح' },
    { key: 'academic-materials', labelAr: 'قسم المواد الأكاديمية والكتب' },
    { key: 'technology', labelAr: 'قسم التقنيات التعليمية' },
    { key: 'safety', labelAr: 'قسم السلامة والأمان' },
  ];

  for (const dept of departments) {
    await prisma.department.upsert({
      where: { key: dept.key },
      update: { labelAr: dept.labelAr },
      create: dept,
    });
  }
  console.log('✓ الأقسام');

  // المؤسسات التعليمية
  const institutions: Record<string, Record<string, string[]>> = {
    school: {
      'دمشق': ['مدرسة الأمويين الابتدائية', 'مدرسة الفاتح الإعدادية', 'مدرسة دمشق الثانوية', 'مدرسة القدس الأساسية', 'مدرسة الشهيد باسل الأسد'],
      'ريف دمشق': ['مدرسة الغوطة الابتدائية', 'مدرسة داريا الإعدادية', 'مدرسة الزبداني الثانوية', 'مدرسة قدسيا الأساسية'],
      'حلب': ['مدرسة الأندلس الابتدائية', 'مدرسة حلب الشهباء الإعدادية', 'مدرسة الكندي الثانوية', 'مدرسة الزهراء الأساسية'],
      'حمص': ['مدرسة الوعر الابتدائية', 'مدرسة العروبة الإعدادية', 'مدرسة حمص الثانوية', 'مدرسة الخالدية الأساسية'],
      'حماة': ['مدرسة العاصي الابتدائية', 'مدرسة حماة الخضراء الإعدادية', 'مدرسة أبو الفداء الثانوية'],
      'اللاذقية': ['مدرسة الساحل الابتدائية', 'مدرسة اللاذقية الزرقاء الإعدادية', 'مدرسة تشرين الثانوية'],
      'طرطوس': ['مدرسة الشاطئ الابتدائية', 'مدرسة طرطوس الإعدادية', 'مدرسة الأرز الثانوية'],
      'إدلب': ['مدرسة الزيتون الابتدائية', 'مدرسة إدلب الخضراء الإعدادية', 'مدرسة معرة النعمان الثانوية'],
      'الحسكة': ['مدرسة الجزيرة الابتدائية', 'مدرسة الحسكة الإعدادية', 'مدرسة القامشلي الثانوية'],
      'دير الزور': ['مدرسة الفرات الابتدائية', 'مدرسة دير الزور الإعدادية', 'مدرسة الميادين الثانوية'],
      'الرقة': ['مدرسة الرافدين الابتدائية', 'مدرسة الرقة الإعدادية', 'مدرسة تل أبيض الثانوية'],
      'درعا': ['مدرسة الجنوب الابتدائية', 'مدرسة درعا الإعدادية', 'مدرسة بصرى الثانوية'],
      'السويداء': ['مدرسة الجبل الابتدائية', 'مدرسة السويداء الإعدادية', 'مدرسة شهبا الثانوية'],
      'القنيطرة': ['مدرسة الجولان الابتدائية', 'مدرسة القنيطرة الإعدادية'],
    },
    university: {
      'دمشق': ['جامعة دمشق', 'الجامعة السورية الخاصة', 'جامعة القلمون الخاصة', 'الجامعة الدولية الخاصة للعلوم والتكنولوجيا'],
      'ريف دمشق': ['الجامعة العربية الدولية', 'جامعة الشام الخاصة'],
      'حلب': ['جامعة حلب', 'جامعة الإيمان الخاصة', 'الجامعة السورية للعلوم والتكنولوجيا'],
      'حمص': ['جامعة البعث', 'جامعة المأمون الخاصة للعلوم والتكنولوجيا'],
      'حماة': ['جامعة حماة'],
      'اللاذقية': ['جامعة تشرين', 'الأكاديمية العربية للعلوم والتكنولوجيا والنقل البحري'],
      'طرطوس': ['جامعة طرطوس'],
      'إدلب': ['جامعة إدلب'],
      'الحسكة': ['جامعة الفرات', 'جامعة الحسكة'],
      'دير الزور': ['جامعة الفرات - فرع دير الزور'],
      'الرقة': ['جامعة الفرات - فرع الرقة'],
      'درعا': ['جامعة درعا'],
      'السويداء': ['جامعة السويداء'],
      'القنيطرة': ['جامعة القنيطرة'],
    }
  };

  for (const [type, govMap] of Object.entries(institutions)) {
    for (const [govName, names] of Object.entries(govMap)) {
      const gov = await prisma.governorate.findUnique({ where: { name: govName } });
      if (!gov) continue;
      for (const name of names) {
        await prisma.institution.upsert({
          where: { name_governorateId: { name, governorateId: gov.id } },
          update: {},
          create: { name, institutionType: type, governorateId: gov.id },
        });
      }
    }
  }
  console.log('✓ المؤسسات التعليمية');

  // المستودعات (5 أقسام × 14 محافظة = 70 مستودع)
  const warehouseTypes: Record<string, string> = {
    'materials': 'مستودع المواد والأثاث التعليمي',
    'maintenance': 'مستودع الصيانة والإصلاح',
    'academic-materials': 'مستودع المواد الأكاديمية والكتب',
    'technology': 'مستودع التقنيات التعليمية',
    'safety': 'مستودع السلامة والأمان',
  };

  for (const [deptKey, typeName] of Object.entries(warehouseTypes)) {
    const dept = await prisma.department.findUnique({ where: { key: deptKey } });
    if (!dept) continue;
    for (const govName of governorates) {
      const gov = await prisma.governorate.findUnique({ where: { name: govName } });
      if (!gov) continue;
      const name = `${typeName} - ${govName}`;
      await prisma.warehouse.upsert({
        where: { departmentId_governorateId: { departmentId: dept.id, governorateId: gov.id } },
        update: {},
        create: { name, departmentId: dept.id, governorateId: gov.id },
      });
    }
  }
  console.log('✓ المستودعات');

  console.log('تم بذر البيانات بنجاح!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
