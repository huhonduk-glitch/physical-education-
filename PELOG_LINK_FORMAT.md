# PE LOG → 튼튼몬 연동 코드 형식 (v1)

> PE LOG(체육수업 누가기록)에서 학생별 **PAPS 등급 연동 코드**를 발급하고, 학생이 튼튼몬 알 만들기 화면에 입력(또는 QR 스캔)해서 등급을 불러오기 위한 약속입니다.
> 이 문서만 보고 PE LOG 쪽 발급 기능을 만들 수 있게 썼습니다. 서버는 쓰지 않습니다.

---

## 1. 한눈에 보기

```
ABSH-SU4
│└─┬─┘ └ 체크 글자 1자 (오타 확인)
│  └ 내용 5자 (등급 4개 + 측정일)
└ 형식 버전 1자 (A = v1)
```

- **7글자**, 보기 쉽게 4글자 뒤에 `-` 를 넣어 `XXXX-XXX` 로 보여 줍니다. (`-` 와 띄어쓰기는 입력할 때 없어도 됩니다)
- 글자는 **31자**만 씁니다: `23456789ABCDEFGHJKMNPQRSTUVWXYZ` — 헷갈리는 **0 · 1 · I · L · O 는 없습니다.**
- 소문자로 쳐도 읽힙니다.
- 한 글자를 잘못 치거나, 이웃한 두 글자의 순서를 바꿔 치면 **반드시** 잡아냅니다 (아래 9장 검증).
- QR 에는 이 7글자(+`-`)만 담습니다. **URL(주소)로 만들지 않습니다.**

## 2. 넣는 것 · 넣지 않는 것

| 넣는 것 | 값 |
|---|---|
| 심폐지구력 등급 | 1~5, 측정 안 했으면 빈칸 |
| 근력·근지구력 등급 | 1~5 또는 빈칸 |
| 유연성 등급 | 1~5 또는 빈칸 |
| 순발력 등급 | 1~5 또는 빈칸 |
| 측정일 | 회차 측정일 `YYYY-MM-DD` (2024-01-01 ~ 2068-11-08) |
| 형식 버전 | 1 |
| 체크값 | 오타 확인용 |

**넣지 않는 것:** 이름 · 학번 · 성별 · 측정값(기록) · 체지방 · BMI · 키 · 몸무게.

- 등급은 PE LOG 가 **발급하는 순간 측정값으로 계산한 결과**만 넣습니다. (성별·학년 기준표는 PE LOG 안에서만 씀)
- 4개 등급이 **모두 빈칸이면 발급하지 않습니다.**
- 코드 안에는 누구 것인지 알 수 있는 정보가 없습니다. 이름과 코드의 연결은 PE LOG(선생님 기기)에만 남습니다.

## 3. 글자표 (글자 → 값)

| 글자 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 값 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |

| 글자 | J | K | M | N | P | Q | R | S | T | U | V | W | X | Y | Z |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 값 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 |

글자 수가 31(소수)이라서 체크값이 오타를 빠짐없이 잡을 수 있습니다.

## 4. 만드는 방법 (계산 순서)

예시: 심폐 **2**등급 · 근력 **3**등급 · 유연 **1**등급 · 순발 **4**등급, 측정일 **2026-04-15**

**① 등급 번호** — 빈칸은 0, 등급은 그대로(1~5). 6진법처럼 이어 붙입니다.
```
G = ((심폐 × 6 + 근력) × 6 + 유연) × 6 + 순발
  = ((2 × 6 + 3) × 6 + 1) × 6 + 4 = 550        (범위 1 ~ 1295)
```

**② 날 번호** — 2024-01-01 부터 며칠 지났는지. **UTC 기준으로 계산**해야 서머타임·시간대 때문에 하루가 밀리지 않습니다.
```
D = (Date.UTC(2026, 3, 15) − Date.UTC(2024, 0, 1)) ÷ 86 400 000 = 835     (범위 0 ~ 16383)
```

**③ 합친 수**
```
N = G × 16384 + D = 550 × 16384 + 835 = 9 012 035
```

**④ 내용 5글자** — N 을 31진법 5자리로 (앞자리부터).
```
9 012 035 = 9·31⁴ + 23·31³ + 15·31² + 23·31 + 25
값  [9, 23, 15, 23, 25]  →  글자  B S H S U
```

**⑤ 버전 글자** — v1 은 값 8 = `A`. 앞에 붙이면 `A B S H S U` (값 `[8, 9, 23, 15, 23, 25]`)

**⑥ 체크 글자** — 각 글자 값 × 자리 번호(1부터)의 합을 구한 뒤, 7번째 글자를 더했을 때 31로 나누어떨어지게 정합니다.
```
s = 1·8 + 2·9 + 3·23 + 4·15 + 5·23 + 6·25 = 420,   420 mod 31 = 17
체크 값 c = (31 − 17) × 9 mod 31 = 2   →  글자 4        (9 는 7 의 역수: 7 × 9 = 63 ≡ 1 mod 31)
확인: 420 + 7 × 2 = 434 = 31 × 14 ✓
```

**⑦ 결과:** `ABSHSU4` → 보여 줄 때 **`ABSH-SU4`**

## 5. 참고 코드 (JavaScript, 그대로 복사해서 쓰면 됨)

라이브러리 없이 동작합니다. `makeCode` 는 PE LOG, `readCode` 는 튼튼몬에서 씁니다. (두 쪽이 같은 코드를 쓰면 안전)

```js
// PE LOG 연동 코드 v1
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // 31자: 0 1 I L O 없음
const BASE = 31;                    // 소수 → 체크값이 한 글자 오타·이웃 글자 바뀜을 모두 잡음
const VERSION = 1;
const EPOCH = Date.UTC(2024, 0, 1); // 날짜 0 = 2024-01-01
const DAY_MS = 86400000;
const DAYS = 16384;                 // 2024-01-01 ~ 2068-11-08

const dayIndex = ymd => { const [y, m, d] = ymd.split('-').map(Number); return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / DAY_MS); };
const fromDayIndex = n => new Date(EPOCH + n * DAY_MS).toISOString().slice(0, 10);
/** 체크값: 1~7번째 글자 값 × 자리 번호(1~7)의 합이 31로 나누어떨어지게 */
const checkValue = vals => { const s = vals.reduce((a, v, i) => a + (i + 1) * v, 0) % BASE; return ((BASE - s) * 9) % BASE; }; // 9 = 7의 역수 (mod 31)

/** 코드 만들기 (PE LOG). 등급은 1~5, 측정 안 했으면 null. date = 'YYYY-MM-DD' */
export function makeCode({ cardio, strength, flex, power, date }) {
  const g = [cardio, strength, flex, power].map(x => (x === null || x === undefined || x === '' ? 0 : Number(x)));
  if (g.some(x => !Number.isInteger(x) || x < 0 || x > 5)) throw new Error('등급은 1~5 또는 빈칸');
  if (g.every(x => x === 0)) throw new Error('등급이 하나도 없어요');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || fromDayIndex(dayIndex(date)) !== date) throw new Error('날짜 형식: YYYY-MM-DD');
  const d = dayIndex(date);
  if (d < 0 || d >= DAYS) throw new Error('날짜 범위: 2024-01-01 ~ 2068-11-08');
  let n = (((g[0] * 6 + g[1]) * 6 + g[2]) * 6 + g[3]) * DAYS + d;
  const body = [];
  for (let i = 0; i < 5; i++) { body.unshift(n % BASE); n = Math.floor(n / BASE); }
  const vals = [7 + VERSION, ...body];
  vals.push(checkValue(vals));
  const s = vals.map(v => ALPHABET[v]).join('');
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

/** 코드 읽기 (튼튼몬). 결과 {ok:true, version, date, grades:{cardio,strength,flex,power}} 또는 {ok:false, reason} */
export function readCode(text) {
  const s = String(text || '').toUpperCase().replace(/[\s-]/g, '');
  if (/[01ILO]/.test(s)) return { ok: false, reason: 'confusable' }; // 코드에 없는 글자
  if (s.length !== 7) return { ok: false, reason: 'length' };
  const vals = [...s].map(c => ALPHABET.indexOf(c));
  if (vals.some(v => v < 0)) return { ok: false, reason: 'char' };
  if (vals.reduce((a, v, i) => a + (i + 1) * v, 0) % BASE !== 0) return { ok: false, reason: 'check' };
  const version = vals[0] - 7;
  if (version !== VERSION) return { ok: false, reason: 'version' };
  let n = 0;
  for (const v of vals.slice(1, 6)) n = n * BASE + v;
  const d = n % DAYS;
  let gi = Math.floor(n / DAYS);
  if (gi > 1295) return { ok: false, reason: 'range' };
  const g = [];
  for (let i = 0; i < 4; i++) { g.unshift(gi % 6); gi = Math.floor(gi / 6); }
  if (g.every(x => x === 0)) return { ok: false, reason: 'range' };
  const grade = x => x || null;
  return { ok: true, version, date: fromDayIndex(d), grades: { cardio: grade(g[0]), strength: grade(g[1]), flex: grade(g[2]), power: grade(g[3]) } };
}
```

`export` 를 쓰지 않는 한 파일짜리 앱이면 `export` 두 단어만 지우면 됩니다.

## 6. 예시 코드 (발급 기능 테스트에 그대로 쓰세요)

| 심폐 | 근력 | 유연 | 순발 | 측정일 | 코드 |
|---|---|---|---|---|---|
| 2 | 3 | 1 | 4 | 2026-04-15 | `ABSH-SU4` |
| 1 | 1 | 1 | 1 | 2026-09-21 | `A6MG-QSW` |
| (빈칸) | 3 | 5 | 2 | 2025-10-01 | `A4H2-HWP` |
| 5 | 5 | 5 | 5 | 2027-03-10 | `ARZ9-JYX` |
| 3 | (빈칸) | (빈칸) | (빈칸) | 2024-01-01 | `ADHD-QGM` |
| 4 | 2 | 3 | 3 | 2068-11-08 | `AJZV-VFQ` |

읽기 쪽에서 막혀야 하는 입력:

| 입력 | 결과 | 학생에게 보여 줄 말 (예) |
|---|---|---|
| `absh su4`, `ABSHSU4` | ✅ 읽힘 (소문자·띄어쓰기·`-` 없음 괜찮음) | |
| `ABSH-SU5` (한 글자 틀림) | `check` | 코드를 다시 확인해 주세요. 한 글자가 틀린 것 같아요. |
| `ABHS-SU4` (두 글자 순서 바뀜) | `check` | 〃 |
| `AO2B-34C` | `confusable` | 코드에는 0 · 1 · I · L · O 가 없어요. |
| `A3K` | `length` | 코드는 7글자예요. |
| `2222-222` | `version` | 튼튼몬 앱을 새로 고친 뒤 다시 넣어 주세요. |

## 7. QR 로 만들기

- QR 내용은 **코드 글자 그대로** (예: `ABSH-SU4`). 앞에 주소나 다른 글자를 붙이지 않습니다.
- 대문자·숫자·`-` 만 있으므로 QR **영숫자(Alphanumeric) 모드**로 담기고, 가장 작은 QR(버전 1, 21×21)에 들어갑니다. 오류 정정 수준은 **M** 을 권장합니다.
- 서버 없이 브라우저에서 만들 수 있습니다. 예: `qrcode-generator` 라이브러리

```html
<script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"></script>
<div id="qr"></div>
<script>
  const code = makeCode({ cardio: 2, strength: 3, flex: 1, power: 4, date: '2026-04-15' }); // 'ABSH-SU4'
  const qr = qrcode(0, 'M');           // 0 = 크기 자동
  qr.addData(code, 'Alphanumeric');
  qr.make();
  document.getElementById('qr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2 });
</script>
```

(오프라인에서도 쓰려면 위 파일을 PE LOG 폴더에 받아 두고 그 경로로 불러오면 됩니다.)

## 8. PE LOG 화면에 만들 것 (권장)

1. 학생 한 명 → **회차 선택**(측정일) → 그 회차 측정값으로 등급 4개를 계산 → `makeCode` → **코드 + QR** 을 보여 줌.
2. 측정하지 않은 종목은 빈칸으로 넣음. 4개가 모두 빈칸이면 "등급이 없어 코드를 만들 수 없어요".
3. 반 전체를 한 번에 뽑아 줄 때(출력물)는 **이름은 종이에만**, 코드는 학생 본인에게만 나눠 줌. 코드 목록을 단체방 등에 올리지 않도록 안내.
4. 같은 학생·같은 회차는 언제 다시 만들어도 같은 코드가 나옴(저장할 필요 없음).
5. 측정값을 고쳐 등급이 바뀌면 코드도 바뀜 → 새 코드를 다시 주면 됨.

## 9. 검증 (참고 코드로 확인함)

- 모든 등급 조합(빈칸 포함 1,295가지) × 측정일 6개 = **7,770개 코드**: 만들기 → 읽기 왕복이 모두 일치, 서로 겹치는 코드 없음.
- 그 7,770개 각각에서 **한 글자를 다른 글자로 바꾼 1,631,700가지 → 모두 잡음**, **이웃 두 글자를 바꾼 45,058가지 → 모두 잡음**.
- 막아야 하는 값(등급 6, 모두 빈칸, 2023년 날짜, 2026-02-30 같은 없는 날짜)은 `makeCode` 가 거부함.

## 10. 버전 규칙

- 첫 글자가 버전입니다: v1 = `A`(값 8), 다음 형식을 만들면 v2 = `B`(값 9) …
- 읽는 쪽은 모르는 버전이면 거부하고 "앱을 새로 고쳐 주세요" 라고 안내합니다. v1 코드는 앞으로도 계속 읽을 수 있게 둡니다.
- 형식을 바꿀 때(예: 2068년 이후 날짜, 종목 추가)만 버전을 올립니다.

## 11. 지킬 것

- 코드에는 건강정보(PAPS 등급)가 들어 있으므로 **학생 본인에게만** 줍니다. 이름·학번은 절대 넣지 않습니다.
- 링크 주소(URL 파라미터)에 코드나 등급을 담지 않습니다.
- 튼튼몬은 코드를 읽어 등급만 알 만들기 칸에 채웁니다. 손으로 등급을 넣는 방법도 그대로 둡니다.
