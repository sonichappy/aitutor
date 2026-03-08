// 测试 API 路由逻辑
const path = require('path');

// 模拟导入 storage 模块
async function testGetReportsAPI() {
  // 直接导入并测试
  const storagePath = path.join(__dirname, '..', 'lib', 'storage.ts');

  console.log('Testing getSubjectReports for "英语"...');

  // 由于这是 TypeScript 文件，我们需要编译或使用 tsx
  // 让我们使用已经编译的逻辑

  const REPORTS_DIR = path.join(__dirname, '..', 'data', 'reports');
  const fs = require('fs/promises');

  function getSubjectIdByName(subjectName) {
    const nameToIdMap = {
      "数学": "math",
      "代数": "algebra",
      "几何": "geometry",
      "语文": "chinese",
      "英语": "english",
      "物理": "physics",
      "化学": "chemistry",
      "生物": "biology",
      "历史": "history",
      "地理": "geography",
      "道法": "politics",
      "政治": "politics2",
    };

    if (nameToIdMap[subjectName]) {
      return nameToIdMap[subjectName];
    }

    return subjectName.toLowerCase().replace(/\s+/g, '-');
  }

  const subject = "英语";
  const subjectId = getSubjectIdByName(subject);
  const subjectDir = path.join(REPORTS_DIR, subjectId);

  console.log('Subject:', subject);
  console.log('Subject ID:', subjectId);
  console.log('Subject Dir:', subjectDir);

  const reports = [];

  try {
    await fs.access(subjectDir);
  } catch (e) {
    console.log('Directory does not exist:', e.message);
    return { subject, reports: [], total: 0 };
  }

  const folders = await fs.readdir(subjectDir);
  console.log('Folders:', folders);

  for (const folder of folders) {
    try {
      const reportDirPath = path.join(subjectDir, folder);
      const stat = await fs.stat(reportDirPath);

      if (!stat.isDirectory()) continue;

      // Try new format
      let metaPath = path.join(reportDirPath, 'meta.json');
      let mdPath = path.join(reportDirPath, 'report.md');
      let metaContent = null;
      let mdContent = null;

      try {
        [metaContent, mdContent] = await Promise.all([
          fs.readFile(metaPath, 'utf-8'),
          fs.readFile(mdPath, 'utf-8')
        ]);
      } catch (e) {
        // Try old format
        const files = await fs.readdir(reportDirPath);
        const metaFile = files.find(f => f.endsWith('.meta.json'));
        const mdFile = files.find(f => f.endsWith('.md'));

        if (metaFile && mdFile) {
          [metaContent, mdContent] = await Promise.all([
            fs.readFile(path.join(reportDirPath, metaFile), 'utf-8'),
            fs.readFile(path.join(reportDirPath, mdFile), 'utf-8')
          ]);
        }
      }

      if (!metaContent || !mdContent) {
        continue;
      }

      const meta = JSON.parse(metaContent);

      // Add subjectId if missing
      if (!meta.subjectId) {
        meta.subjectId = subjectId;
      }

      // 只返回列表字段，不返回 content（模拟 API 行为）
      reports.push({
        id: meta.id,
        subject: meta.subject,
        title: meta.title,
        startDate: meta.startDate,
        endDate: meta.endDate,
        generatedAt: meta.generatedAt,
        stats: meta.stats,
        hasAnalysis: !!meta.analysis
      });

      console.log('Found report:', meta.title);
    } catch (error) {
      console.error('Failed to read report', folder, ':', error.message);
    }
  }

  const result = {
    subject,
    reports,
    total: reports.length
  };

  console.log('\nAPI Response:', JSON.stringify(result, null, 2));
  return result;
}

testGetReportsAPI().catch(console.error);
