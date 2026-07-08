/** @type {import('next').NextConfig} */
const nextConfig = {
  // 减少 dev 模式下 chunk 加载超时（工作网络较慢时有用）
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
};

export default nextConfig;
