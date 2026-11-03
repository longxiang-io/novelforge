// 流式生成的一行一个 JSON。服务端每条事件都以换行结束，解析端按块拼接。
export const encodeNdjson = (value) => `${JSON.stringify(value)}\n`

const takeLines = (buffer, onEvent) => {
  const lines = buffer.split('\n')
  const rest = lines.pop() ?? ''
  const events = []
  for (const line of lines) {
    if (!line.trim()) continue
    const event = JSON.parse(line)
    events.push(event)
    onEvent?.(event)
  }
  return { rest, events }
}

export const createNdjsonParser = (onEvent) => {
  let buffer = ''
  return {
    push(chunk) {
      buffer += chunk
      const taken = takeLines(buffer, onEvent)
      buffer = taken.rest
      return taken.events
    },
    // 流结束时若最后一行没有换行，也解析它
    flush() {
      const line = buffer
      buffer = ''
      if (!line.trim()) return []
      const event = JSON.parse(line)
      onEvent?.(event)
      return [event]
    }
  }
}
