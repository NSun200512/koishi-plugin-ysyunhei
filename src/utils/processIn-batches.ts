
/**
 * 并发控制函数
 * @param items 泛型数组
 * @param processor 执行函数
 * @param batchSize 并发数量
 * @returns
 */
export default async function processInBatches<T>(
  items: T[],
  processor: (item: T) => Promise<any>,
  batchSize: number = 10
): Promise<any[]> {
  const results: any[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }

  return results;
}
