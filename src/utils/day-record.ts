/**
 * 描述添加日期，在多个描述存在时方便整理发生时间
 * @param desc 描述
 * @returns
 */
export default function dayRecord(desc:string): string {
  const now = new Date(); // 获取当前日期对象
  const year = now.getFullYear(); // 获取完整年份（4位数）
  const month = String(now.getMonth() + 1).padStart(2, '0'); // 月份补零（0 → "01"）
  const day = String(now.getDate()).padStart(2, '0'); // 日期补零（5 → "05"）
  return `${desc}（${year}-${month}-${day}）`; // 返回 YYYY-MM-DD
}
