import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('بذر البيانات...');

  // إنشاء admin افتراضي
  const adminEmail = 'admin@system.com';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('admin123', 10);
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        userType: 'admin',
        isActive: true,
      }
    });
    console.log('✓ Admin افتراضي (admin@system.com / admin123)');
  } else {
    console.log('✓ Admin موجود');
  }

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

  // أنواع المؤسسات
  const institutionTypes = [
    { key: 'school', labelAr: 'مدرسة' },
    { key: 'university', labelAr: 'جامعة' },
  ];
  for (const it of institutionTypes) {
    await prisma.institutionType.upsert({
      where: { key: it.key },
      update: { labelAr: it.labelAr },
      create: it,
    });
  }
  console.log('✓ أنواع المؤسسات');

  // الأقسام (مع ألوان وأيقونات)
  const departments = [
    { key: 'materials', labelAr: 'قسم المواد والأثاث التعليمي', color: '#3b82f6', icon: 'package' },
    { key: 'maintenance', labelAr: 'قسم الصيانة والإصلاح', color: '#f97316', icon: 'wrench' },
    { key: 'academic-materials', labelAr: 'قسم المواد الأكاديمية والكتب', color: '#10b981', icon: 'book' },
    { key: 'technology', labelAr: 'قسم التقنيات التعليمية', color: '#8b5cf6', icon: 'laptop' },
    { key: 'safety', labelAr: 'قسم السلامة والأمان', color: '#ef4444', icon: 'shield' },
  ];

  for (const dept of departments) {
    await prisma.department.upsert({
      where: { key: dept.key },
      update: { labelAr: dept.labelAr, color: dept.color, icon: dept.icon },
      create: dept,
    });
  }
  console.log('✓ الأقسام');

  // الأولويات (level: رقم أعلى = أولوية أعلى)
  const priorities = [
    { key: 'high', labelAr: 'عالية', color: '#ef4444', level: 3 },
    { key: 'medium', labelAr: 'متوسطة', color: '#f59e0b', level: 2 },
    { key: 'low', labelAr: 'منخفضة', color: '#10b981', level: 1 },
  ];
  for (const p of priorities) {
    await prisma.priority.upsert({
      where: { key: p.key },
      update: { labelAr: p.labelAr, color: p.color, level: p.level },
      create: p,
    });
  }
  console.log('✓ الأولويات');

  // وحدات القياس
  const units = ['قطعة', 'وحدة', 'رزمة', 'علبة', 'مجموعة', 'نسخة', 'خدمة', 'ترخيص', 'كيلو', 'لتر', 'متر', 'عنصر'];
  for (const name of units) {
    await prisma.unit.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log('✓ وحدات القياس');

  // عناصر كل قسم
  const departmentItems: Record<string, Array<{ key: string; labelAr: string; defaultUnit?: string }>> = {
    'materials': [
      { key: 'chairs', labelAr: 'كراسي' },
      { key: 'pens', labelAr: 'أقلام' },
      { key: 'boards', labelAr: 'ألواح' },
      { key: 'fans', labelAr: 'مراوح' },
      { key: 'curtains', labelAr: 'ستائر' },
      { key: 'ac', labelAr: 'مكيفات' },
      { key: 'heaters', labelAr: 'مدافئ' },
      { key: 'chalk', labelAr: 'طباشير', defaultUnit: 'علبة' },
      { key: 'computers', labelAr: 'حاسوب' },
      { key: 'projectors', labelAr: 'بروجكتر' },
    ],
    'maintenance': [
      { key: 'electrical', labelAr: 'مشاكل كهربائية', defaultUnit: 'خدمة' },
      { key: 'water', labelAr: 'مشاكل مياه', defaultUnit: 'خدمة' },
      { key: 'wiring', labelAr: 'توصيلات', defaultUnit: 'خدمة' },
      { key: 'building', labelAr: 'إصلاحات المبنى', defaultUnit: 'خدمة' },
      { key: 'cleaning', labelAr: 'تنظيف', defaultUnit: 'خدمة' },
    ],
    'academic-materials': [
      { key: 'textbooks', labelAr: 'كتب مدرسية' },
      { key: 'papers', labelAr: 'أوراق', defaultUnit: 'رزمة' },
      { key: 'notebooks', labelAr: 'دفاتر' },
      { key: 'stationery', labelAr: 'قرطاسية' },
    ],
    'technology': [
      { key: 'computers', labelAr: 'حاسوب' },
      { key: 'software', labelAr: 'برمجيات', defaultUnit: 'ترخيص' },
      { key: 'network', labelAr: 'شبكة', defaultUnit: 'خدمة' },
      { key: 'audio-visual', labelAr: 'سمعي بصري' },
    ],
    'safety': [
      { key: 'fire-safety', labelAr: 'السلامة من الحريق' },
      { key: 'security', labelAr: 'أمن' },
      { key: 'emergency', labelAr: 'معدات الطوارئ' },
    ],
  };

  for (const [deptKey, items] of Object.entries(departmentItems)) {
    const dept = await prisma.department.findUnique({ where: { key: deptKey } });
    if (!dept) continue;
    for (const item of items) {
      await prisma.departmentItem.upsert({
        where: { key_departmentId: { key: item.key, departmentId: dept.id } },
        update: { labelAr: item.labelAr, defaultUnit: item.defaultUnit || 'قطعة' },
        create: { key: item.key, labelAr: item.labelAr, defaultUnit: item.defaultUnit || 'قطعة', departmentId: dept.id },
      });
    }
  }
  console.log('✓ عناصر الأقسام');

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
