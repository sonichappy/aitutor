const fs = require('fs/promises');
const path = require('path');

const EXAMS_DIR = path.join(__dirname, '..', 'data', 'exams');

async function checkAllExams() {
  const examDirs = await fs.readdir(EXAMS_DIR);

  for (const examDir of examDirs) {
    const dataPath = path.join(EXAMS_DIR, examDir, 'data.json');
    try {
      const content = await fs.readFile(dataPath, 'utf-8');
      const data = JSON.parse(content);

      if (data.questions && data.questions.length > 0) {
        const numbers = data.questions.map(q => q.number);
        const dup = numbers.filter((n, i) => numbers.indexOf(n) !== i);

        if (dup.length > 0) {
          console.log(`\n${examDir}: 发现重复题号`, dup);

          data.questions.forEach((q, i) => {
            if (dup.includes(q.number)) {
              console.log(`  索引 ${i}: 题号 ${q.number}, 内容: ${q.content.substring(0, 40)}...`);
            }
          });
        }
      }
    } catch (error) {
      // 忽略错误
    }
  }
}

checkAllExams();
