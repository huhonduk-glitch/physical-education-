import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { getDocData, listDocs, removeDoc, saveDoc } from '../src/db/docStore'

const DB = 'test-docs'

describe('참고 자료 파일 (이 기기에만)', () => {
  it('넣기 · 목록 · 꺼내기 · 지우기', async () => {
    const blob = new Blob(['%PDF-가상'], { type: 'application/pdf' })
    const meta = await saveDoc('plan', blob, 161, '운영방향.pdf')
    expect(meta).toMatchObject({ key: 'plan', name: '운영방향.pdf', pages: 161, size: blob.size })
    const list = await listDocs()
    expect(list.map((x) => x.key)).toEqual(['plan'])
    expect('data' in list[0]).toBe(false)
    const data = await getDocData('plan')
    expect(data?.size).toBe(blob.size)
    await removeDoc('plan')
    expect(await listDocs()).toEqual([])
    expect(await getDocData('plan')).toBeNull()
    expect(await listDocs(DB)).toEqual([])
  })
})
