const fs = require('fs');
const path = require('path');

const examsDir = path.join(__dirname, '..', 'data', 'exams');
const examDirs = fs.readdirSync(examsDir, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .map(dirent => dirent.name);

examDirs.forEach(examId => {
  const dataPath = path.join(examsDir, examId, 'data.json');
  try {
    const content = fs.readFileSync(dataPath, 'utf-8');
    const data = JSON.parse(content);

    // 计算题目分类统计
    const questionTypeStats = {};
    data.questions?.forEach(q => {
      const type = q.type || 'unknown';
      questionTypeStats[type] = (questionTypeStats[type] || 0) + 1;
    });

    // 添加到 metadata
    if (!data.metadata) {
      data.metadata = {};
    }
    data.metadata.questionTypeStats = questionTypeStats;

    // 保存
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Updated ${examId}:`, questionTypeStats);
  } catch (err) {
    console.error(`Failed to update ${examId}:`, err.message);
  }
});
console.log('Done!');
