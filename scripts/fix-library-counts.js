#!/usr/bin/env node

/**
 * 修复字词库数量统计
 * 确保 libraries.json 中的 wordCount 与实际的 words.json 一致
 */

const fs = require('fs/promises');
const path = require('path');

const CHINESE_BASE_DIR = path.join(process.cwd(), 'data', 'knowledge-base', 'chinese');
const LIBRARIES_INDEX_FILE = path.join(CHINESE_BASE_DIR, 'libraries.json');

async function fixLibraryCounts() {
  try {
    // 读取当前的 libraries.json
    const librariesContent = await fs.readFile(LIBRARIES_INDEX_FILE, 'utf-8');
    const librariesData = JSON.parse(librariesContent);

    // 获取所有实际存在的字词库目录
    const dirs = await fs.readdir(CHINESE_BASE_DIR);
    const libraryDirs = dirs.filter(d => d.startsWith('lib-') || d.startsWith('kb-'));

    console.log(`🔍 找到 ${libraryDirs.length} 个字词库目录`);

    // 构建新的有效字词库列表
    const validLibraries = [];

    for (const libraryDir of libraryDirs) {
      const libraryPath = path.join(CHINESE_BASE_DIR, libraryDir);
      const wordsPath = path.join(libraryPath, 'words.json');
      const metadataPath = path.join(libraryPath, 'metadata.json');

      // 检查必要的文件是否存在
      if (!await fileExists(wordsPath) || !await fileExists(metadataPath)) {
        console.log(`⚠️  跳过 ${libraryDir} (缺少必要文件)`);
        continue;
      }

      try {
        // 读取字词数量
        const wordsContent = await fs.readFile(wordsPath, 'utf-8');
        const words = JSON.parse(wordsContent);
        const actualWordCount = words.length;

        // 读取元数据
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(metadataContent);

        // 更新元数据中的字词数量
        if (metadata.wordCount !== actualWordCount) {
          metadata.wordCount = actualWordCount;
          await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
          console.log(`✅ 更新 ${libraryDir} 元数据: ${actualWordCount} 个字词`);
        }

        // 添加到有效列表
        validLibraries.push({
          id: metadata.id,
          subject: 'chinese',
          name: metadata.name,
          description: metadata.description || '',
          wordCount: actualWordCount,
          createdAt: metadata.createdAt,
          updatedAt: metadata.updatedAt
        });

      } catch (error) {
        console.log(`❌ 处理 ${libraryDir} 时出错:`, error.message);
      }
    }

    // 保存更新后的 libraries.json
    const updatedData = { libraries: validLibraries };
    await fs.writeFile(LIBRARIES_INDEX_FILE, JSON.stringify(updatedData, null, 2));

    console.log(`\n🎉 修复完成！`);
    console.log(`📊 有效字词库: ${validLibraries.length}`);
    console.log(`📝 总字词数: ${validLibraries.reduce((sum, lib) => sum + lib.wordCount, 0)}`);

  } catch (error) {
    console.error('❌ 修复失败:', error);
    process.exit(1);
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// 运行修复脚本
fixLibraryCounts();
