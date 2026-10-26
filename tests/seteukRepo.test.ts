import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { PeDatabase } from '../src/db/db'
import { exportAll, restoreAll } from '../src/db/backup'
import { applyAi, canConfirm, confirmDraft, getDraft, saveText, setAiConfirm, unconfirm } from '../src/db/seteukRepo'

let n = 0
const dbs: PeDatabase[] = []
const fresh = () => {
  const d = new PeDatabase(`seteuk-test-${n++}`)
  dbs.push(d)
  return d
}
afterEach(async () => {
  for (const d of dbs.splice(0)) {
    d.close()
    await Dexie.delete(d.name)
  }
})
const key = { schoolYear: 2026, groupId: 'g', studentId: 's' }

describe('세특 확정 규칙 (기재요령 총칙 5-다)', () => {
  it('교사가 직접 쓴 글은 검사만 통과하면 확정', async () => {
    const db = fresh()
    await saveText(db, key, '하이클리어 동작을 분석해 친구에게 설명함.')
    expect((await confirmDraft(db, key)).ok).toBe(true)
    const d = await getDraft(db, 'g', 's')
    expect(d).toMatchObject({ status: 'confirmed', confirmedText: '하이클리어 동작을 분석해 친구에게 설명함.' })
    await unconfirm(db, key)
    expect((await getDraft(db, 'g', 's'))?.status).toBe('draft')
  })
  it('검사 오류(대회 수상)가 있으면 확정 안 됨', () => {
    expect(canConfirm({ text: '교내 대회에서 금상을 받음.' }).reasons[0]).toContain('검사 오류')
  })
  it('AI 글을 그대로 두면 확정 안 됨 → 교사가 고치고 확인 4개를 체크해야 확정', async () => {
    const db = fresh()
    await saveText(db, key, '초안')
    await applyAi(db, key, '배드민턴 랠리에서 파트너와 타이밍을 맞추어 안정적으로 수행함.')
    let c = await confirmDraft(db, key)
    expect(c.ok).toBe(false)
    expect(c.reasons.join(' ')).toContain('그대로 입력할 수 없어요')
    expect(c.reasons.join(' ')).toContain('확인 항목')
    await saveText(db, key, '배드민턴 랠리에서 파트너와 타이밍을 맞추며 끝까지 집중해 수행함.')
    await setAiConfirm(db, key, [true, true, true, false])
    c = await confirmDraft(db, key)
    expect(c.reasons).toEqual(['AI 도움 확인 항목을 모두 체크해 주세요'])
    await setAiConfirm(db, key, [true, true, true, true])
    expect((await confirmDraft(db, key)).ok).toBe(true)
  })
})

describe('세특 AI 키는 백업 파일에 들어가지 않는다', () => {
  it('내보내기에서 빠지고, 복원해도 이 기기 키는 그대로', async () => {
    const db = fresh()
    await db.settings.bulkPut([
      { key: 'claudeApiKey', value: 'sk-test' },
      { key: 'schoolName', value: '시연고등학교' },
    ])
    await saveText(db, key, '글')
    const file = await exportAll(db)
    expect(JSON.stringify(file)).not.toContain('sk-test')
    expect(file.counts.seteukDrafts).toBe(1)
    await db.settings.put({ key: 'claudeApiKey', value: 'sk-mine' })
    await restoreAll(db, file)
    expect((await db.settings.get('claudeApiKey'))?.value).toBe('sk-mine')
    expect(await db.seteukDrafts.count()).toBe(1)
  })
})
