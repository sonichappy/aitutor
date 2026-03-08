const data = require('../data/exams/exam-1772939950544/data.json');
const numbers = data.questions.map(q => q.number);
console.log('题号列表:', numbers);
const dup = numbers.filter((n, i) => numbers.indexOf(n) !== i);
console.log('重复题号:', dup);
console.log('总题数:', numbers.length);
data.questions.forEach((q, i) => {
  console.log(`索引 ${i}: 题号 ${q.number}, 内容: ${q.content.substring(0, 30)}...`);
});
