/**
 * 将时间字符串转换为秒数
 * @param timeStr 时间字符串
 * @returns 转换后的秒数
 */
export default function time2Seconds(timeStr: string) {
    if (!timeStr) return 0;

    const regex = /(\d+)\s*(天|小时|时|分钟|分)/g;
    let totalSeconds = 0;
    let match;

    while ((match = regex.exec(timeStr)) !== null) {
        const num = parseInt(match[1], 10);
        const unit = match[2];

        if (unit === '天') {
            totalSeconds += num * 86400;  // 1天 = 86400秒
        } else if (unit === '小时' || unit === '时') {
            totalSeconds += num * 3600;   // 1小时 = 3600秒
        } else if (unit === '分钟' || unit === '分') {
            totalSeconds += num * 60;     // 1分钟 = 60秒
        }
    }
    return totalSeconds;
}
