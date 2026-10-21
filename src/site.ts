export const site = {
  title: '日有所思',
  description: '记录日常的观察、灵感与思考。把生活里的微小发现，慢慢写成自己的答案。',
  author: '我',
};
export const href = (path = '') => `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
export const dateLabel = (date: Date) => new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Shanghai' }).format(date);
