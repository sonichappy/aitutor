const fs = require('fs/promises');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const REPORTS_DIR = path.join(DATA_DIR, 'reports');

// 学科名称到ID的映射
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

async function getSubjectReports(subject) {
  const reports = [];
  const subjectId = getSubjectIdByName(subject);
  const subjectDir = path.join(REPORTS_DIR, subjectId);

  console.log('Getting reports for:', subject);
  console.log('Subject ID:', subjectId);
  console.log('Subject dir:', subjectDir);

  try {
    await fs.access(subjectDir);
  } catch (e) {
    console.log('Directory does not exist');
    return reports;
  }

  const folders = await fs.readdir(subjectDir);
  console.log('Found folders:', folders);

  for (const folder of folders) {
    try {
      const reportDirPath = path.join(subjectDir, folder);
      const stat = await fs.stat(reportDirPath);

      if (!stat.isDirectory()) continue;

      console.log('Processing folder:', folder);

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
        console.log('Using new format');
      } catch (e) {
        // Try old format
        console.log('New format not found, trying old format');
        const files = await fs.readdir(reportDirPath);
        console.log('Files in folder:', files);

        const metaFile = files.find(f => f.endsWith('.meta.json'));
        const mdFile = files.find(f => f.endsWith('.md'));

        console.log('Meta file:', metaFile, 'MD file:', mdFile);

        if (metaFile && mdFile) {
          [metaContent, mdContent] = await Promise.all([
            fs.readFile(path.join(reportDirPath, metaFile), 'utf-8'),
            fs.readFile(path.join(reportDirPath, mdFile), 'utf-8')
          ]);
          console.log('Using old format, read', metaContent?.length, 'bytes of meta,', mdContent?.length, 'bytes of md');
        }
      }

      if (!metaContent || !mdContent) {
        console.log('No content found for', folder);
        continue;
      }

      const meta = JSON.parse(metaContent);

      // Add subjectId if missing
      if (!meta.subjectId) {
        meta.subjectId = subjectId;
      }

      reports.push({
        ...meta,
        content: mdContent
      });

      console.log('Successfully parsed report:', meta.title);
    } catch (error) {
      console.error('Failed to read report', folder, ':', error.message);
    }
  }

  return reports.sort((a, b) =>
    new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
  );
}

async function test() {
  const reports = await getSubjectReports('英语');
  console.log('\nTotal reports found:', reports.length);
  reports.forEach(r => {
    console.log('-', r.title, '(', r.id, ')');
  });
}

test().catch(console.error);
