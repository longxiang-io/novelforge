// 极简 ZIP 打包（仅存储、不压缩），用于导出整本书和分章 TXT，不引入新依赖
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

const crc32 = (buffer) => {
  let crc = 0xffffffff
  for (let i = 0; i < buffer.length; i++) crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

const dosDateTime = (date) => {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  return { time, day }
}

const concat = (parts) => {
  const size = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(size)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

const u16 = (view, offset, value) => view.setUint16(offset, value, true)
const u32 = (view, offset, value) => view.setUint32(offset, value, true)

const encodeName = (name) => new TextEncoder().encode(name)

// files: [{ name: '目录/文件.md', content: string | Uint8Array }]
export const createZip = (files) => {
  const { time, day } = dosDateTime(new Date())
  const locals = []
  const centrals = []
  let offset = 0
  for (const file of files) {
    const name = encodeName(file.name)
    const data = file.content instanceof Uint8Array ? file.content : encodeName(String(file.content ?? ''))
    const crc = crc32(data)
    const local = new DataView(new ArrayBuffer(30))
    u32(local, 0, 0x04034b50)
    u16(local, 4, 20)
    u16(local, 6, 0x0800) // 文件名使用 UTF-8
    u16(local, 8, 0)
    u16(local, 10, time)
    u16(local, 12, day)
    u32(local, 14, crc)
    u32(local, 18, data.length)
    u32(local, 22, data.length)
    u16(local, 26, name.length)
    u16(local, 28, 0)
    const localBytes = new Uint8Array(local.buffer)
    locals.push(localBytes, name, data)

    const central = new DataView(new ArrayBuffer(46))
    u32(central, 0, 0x02014b50)
    u16(central, 4, 20)
    u16(central, 6, 20)
    u16(central, 8, 0x0800)
    u16(central, 10, 0)
    u16(central, 12, time)
    u16(central, 14, day)
    u32(central, 16, crc)
    u32(central, 20, data.length)
    u32(central, 24, data.length)
    u16(central, 28, name.length)
    u32(central, 42, offset)
    const centralBytes = new Uint8Array(central.buffer)
    centrals.push(centralBytes, name)
    offset += localBytes.length + name.length + data.length
  }
  const centralSize = centrals.reduce((sum, item) => sum + item.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  u32(end, 0, 0x06054b50)
  u16(end, 8, files.length)
  u16(end, 10, files.length)
  u32(end, 12, centralSize)
  u32(end, 16, offset)
  return concat([...locals, ...centrals, new Uint8Array(end.buffer)])
}
