// 单实例内存限流。Workers 多隔离实例之间不共享，和原来的进程内限流一样。
const buckets = new Map()

const getBucket = (key) => {
  const bucket = buckets.get(key)
  if (bucket && bucket.resetAt > Date.now()) return bucket
  if (bucket) buckets.delete(key)
  return null
}

export const getRateLimitWait = (key, limit) => {
  const bucket = getBucket(key)
  return bucket && bucket.count >= limit ? Math.ceil((bucket.resetAt - Date.now()) / 1000) : 0
}

export const hitRateLimit = (key, windowMs) => {
  const bucket = getBucket(key)
  if (bucket) bucket.count += 1
  else buckets.set(key, { count: 1, resetAt: Date.now() + windowMs })
}

export const resetRateLimit = (key) => {
  buckets.delete(key)
}

export const formatWait = (seconds) => (seconds >= 60 ? `${Math.ceil(seconds / 60)} 分钟` : `${seconds} 秒`)
