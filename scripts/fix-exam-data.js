/**
 * 修复试卷数据文件
 * 将旧的 answers 数组中的数据合并到 questions 数组中
 * 删除 answers 数组和 answerStats 对象
 */

const fs = require('fs/promises');
const path = require('path');

const EXAMS_DIR = path.join(__dirname, '..', 'data', 'exams');

async function fixExamData(examId) {
  const dataPath = path.join(EXAMS_DIR, examId, 'data.json');
  console.log(`\n处理试卷: ${examId}`);

  try {
    const content = await fs.readFile(dataPath, 'utf-8');
    const data = JSON.parse(content);

    let modified = false;

    // 如果有 answers 数组，将其合并到 questions 数组中
    if (data.answers && Array.isArray(data.answers) && data.answers.length > 0) {
      console.log(`  发现 ${data.answers.length} 条答题记录，正在合并...`);

      // 创建一个 Map 来存储每个题号的答题记录
      // 注意：如果题号重复，后面的会覆盖前面的
      const answersMap = new Map();
      for (const answer of data.answers) {
        answersMap.set(answer.questionNumber, answer);
      }

      // 将答题数据合并到 questions 数组中
      data.questions = data.questions.map(q => {
        const answer = answersMap.get(q.number);
        if (!answer) return q;

        return {
          ...q,
          userAnswer: answer.userAnswer || undefined,
          isCorrect: answer.isCorrect,
          isSkipped: answer.isSkipped || false,
          markedAt: answer.markedAt,
          correctAnswer: answer.correctAnswer,
          errorAnalysis: answer.errorAnalysis,
          weakPoints: answer.weakPoints,
          improvement: answer.improvement,
          aiExplanation: answer.aiExplanation,
        };
      });

      // 删除旧的 answers 数组
      delete data.answers;
      modified = true;

      console.log(`  已合并 ${answersMap.size} 道题的答题数据`);
    }

    // 删除 answerStats 对象
    if (data.answerStats) {
      delete data.answerStats;
      modified = true;
      console.log(`  已删除 answerStats`);
    }

    // 如果有修改，保存文件
    if (modified) {
      // 更新时间戳
      data.updatedAt = new Date().toISOString();

      await fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`  ✅ 已保存修复后的数据`);

      // 显示修复后的统计
      const answeredCount = data.questions.filter(q => q.userAnswer !== undefined || q.isCorrect !== undefined).length;
      console.log(`  📊 修复后: ${answeredCount}/${data.questions.length} 题有答题数据`);
    } else {
      console.log(`  ℹ️ 无需修复`);
    }

    return modified;
  } catch (error) {
    console.error(`  ❌ 处理失败:`, error.message);
    return false;
  }
}

async function main() {
  console.log('========================================');
  console.log('试卷数据修复工具');
  console.log('========================================');

  try {
    // 获取所有试卷目录
    const examDirs = await fs.readdir(EXAMS_DIR);
    console.log(`\n找到 ${examDirs.length} 个试卷:`);

    let fixedCount = 0;
    let skippedCount = 0;

    for (const examDir of examDirs) {
      const examPath = path.join(EXAMS_DIR, examDir);
      const stat = await fs.stat(examPath);

      if (!stat.isDirectory()) continue;

      const fixed = await fixExamData(examDir);
      if (fixed) {
        fixedCount++;
      } else {
        skippedCount++;
      }
    }

    console.log('\n========================================');
    console.log('修复完成!');
    console.log(`  ✅ 修复: ${fixedCount} 个`);
    console.log(`  ℹ️ 跳过: ${skippedCount} 个`);
    console.log('========================================');
  } catch (error) {
    console.error('执行失败:', error);
    process.exit(1);
  }
}

// 运行
main();
