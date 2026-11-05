import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { todayStr } from '../lib/dates'
import { todaysLessons } from '../lib/timetable'
import type { SectionId } from '../lib/nav'
import { useApp } from '../state/AppContext'

/**
 * 큰 메뉴 화면 맨 위 요약 숫자 4칸 (2026-11-05 교사 선택: 밝은 카드). 숫자는 세기만 하고 점수 · 등급으로 바꾸지 않는다.
 * 수업: 오늘 수업 · 오늘 칭찬 · 오늘 지도 · 오늘 견학 / 평가: 수행평가 · 채점한 학생 칸 · 세특 확정 · 세특 초안
 */
export default function HubStats({ section }: { section: SectionId }) {
  const { settings } = useApp()
  const today = todayStr()
  const year = settings.schoolYear
  const stats = useLiveQuery(async () => {
    if (section === 'class') {
      const recs = await db.records.where('date').equals(today).toArray()
      const abs = await db.absences.where('date').equals(today).count()
      return [
        { label: '오늘 수업', value: todaysLessons(new Date(), settings.timetable).length, unit: '교시' },
        { label: '오늘 칭찬', value: recs.filter((r) => r.schoolYear === year && r.type === 'exemplary').length, unit: '번' },
        { label: '오늘 지도', value: recs.filter((r) => r.schoolYear === year && r.type === 'unprepared').length, unit: '번', warn: true },
        { label: '오늘 견학', value: abs, unit: '명' },
      ]
    }
    if (section === 'eval') {
      const list = await db.assessments.where('schoolYear').equals(year).toArray()
      const ids = new Set(list.map((a) => a.id))
      const scored = ids.size ? await db.assessmentScores.filter((s) => ids.has(s.assessmentId)).count() : 0
      const drafts = await db.seteukDrafts.where('schoolYear').equals(year).toArray()
      return [
        { label: '수행평가', value: list.length, unit: '개' },
        { label: '채점한 학생', value: scored, unit: '칸' },
        { label: '세특 확정', value: drafts.filter((d) => d.status === 'confirmed').length, unit: '명' },
        { label: '세특 초안', value: drafts.filter((d) => d.status !== 'confirmed').length, unit: '명' },
      ]
    }
    return null
  }, [section, today, year, settings.timetable])
  if (!stats) return null
  return (
    <section className="grid grid-cols-2 gap-2 md:grid-cols-4" aria-label="요약">
      {stats.map((s) => (
        <div key={s.label} className="card px-4 py-3">
          <p className="text-sm font-bold text-ink-3">{s.label}</p>
          <p className={`text-[1.7rem] leading-tight font-black tabular-nums ${s.warn && s.value > 0 ? 'text-danger' : ''}`}>
            {s.value}
            <span className="ml-0.5 text-base font-bold text-ink-3">{s.unit}</span>
          </p>
        </div>
      ))}
    </section>
  )
}
