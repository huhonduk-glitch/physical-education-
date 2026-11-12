import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { AUTHOR_DOCS } from '../src/data/authorDocs'
import { WORK_FLOWS, workFlow, type FlowStep } from '../src/data/peFlows'
import { WORK_DOCS, type WorkSrc } from '../src/data/peWork'

const app = readFileSync('src/App.tsx', 'utf8')
const routes = [...app.matchAll(/path="([^"]+)"/g)].map((m) => m[1])
const routeOk = (to: string) => {
  const path = to.split('?')[0]
  return routes.some((r) => r === path || (r.includes(':') && new RegExp(`^${r.replace(/:[^/]+/g, '[^/]+')}$`).test(path)))
}
const srcs = (s: FlowStep): WorkSrc[] => (!s.src ? [] : Array.isArray(s.src) ? s.src : [s.src])

describe('업무 흐름도', () => {
  it('6가지 · id 겹치지 않음 · 단계가 있음', () => {
    expect(WORK_FLOWS.map((f) => f.id)).toEqual(['team', 'club', 'committee', 'paps', 'clinic', 'sportsday'])
    for (const f of WORK_FLOWS) {
      expect(f.phases.length).toBeGreaterThan(0)
      for (const p of f.phases) expect(p.steps.length).toBeGreaterThan(0)
    }
    expect(workFlow('club')?.short).toBe('스포츠클럽')
    expect(workFlow('없음')).toBeUndefined()
  })

  it('단계마다 근거 쪽이 있거나, 학교 자체 · 앱 도구 단계로 표시', () => {
    for (const f of WORK_FLOWS)
      for (const p of f.phases)
        for (const s of p.steps) {
          const ok = srcs(s).length > 0 || s.school || s.kind === 'app'
          expect(ok, `${f.id}: ${s.title}`).toBe(true)
          if (s.school) expect(srcs(s).length, `${f.id}: ${s.title} — 근거가 있으면 school 표시 안 함`).toBe(0)
        }
  })

  it('쪽은 자료 쪽수 안', () => {
    for (const f of WORK_FLOWS)
      for (const p of f.phases)
        for (const s of p.steps)
          for (const src of srcs(s)) {
            const pages = Array.isArray(src.page) ? src.page : [src.page]
            for (const n of pages) expect(n >= 1 && n <= WORK_DOCS[src.doc].pages, `${f.id}: ${s.title} ${src.doc} ${n}`).toBe(true)
            if (Array.isArray(src.page)) expect(src.page[0] < src.page[1]).toBe(true)
          }
  })

  it('바로가기는 앱에 있는 화면', () => {
    for (const f of WORK_FLOWS)
      for (const p of f.phases)
        for (const s of p.steps) for (const l of s.links ?? []) expect(routeOk(l.to), `${f.id}: ${l.to}`).toBe(true)
  })

  it('예산 · 견적서 → 품의가 돈이 드는 흐름에 녹아 있음', () => {
    for (const id of ['team', 'club', 'clinic', 'sportsday']) {
      const steps = workFlow(id)!.phases.flatMap((p) => p.steps)
      expect(steps.some((s) => s.kind === 'budget' && s.links?.some((l) => l.to === '/work/quote')), id).toBe(true)
    }
  })

  it('체육대회: 행사 전 교직원 안전교육(의무, 92쪽)과 사고 보고(93쪽)', () => {
    const steps = workFlow('sportsday')!.phases.flatMap((p) => p.steps)
    expect(steps.some((s) => s.kind === 'safety' && srcs(s).some((x) => x.doc === 'final' && x.page === 92))).toBe(true)
    expect(steps.some((s) => s.kind === 'safety' && srcs(s).some((x) => x.doc === 'final' && x.page === 93))).toBe(true)
  })
})

describe('제작자 실제 문서', () => {
  it('업무마다 칸이 있고, 올린 파일은 public/에 실제로 있음', () => {
    for (const f of WORK_FLOWS) expect(Array.isArray(AUTHOR_DOCS[f.id]), f.id).toBe(true)
    for (const list of Object.values(AUTHOR_DOCS))
      for (const d of list) {
        expect(d.title.trim()).not.toBe('')
        expect(d.file.startsWith('docs/'), d.file).toBe(true)
        expect(existsSync(`public/${d.file}`), d.file).toBe(true)
      }
  })
})
