# 안압케어: Supabase 테이블 생성과 앱 연동 단계별 가이드

현재 안압케어 프로젝트는 Supabase의 **PostgreSQL 데이터베이스**와 **Supabase Auth**에 연결되도록 전환되었습니다. 따라서 지금은 Supabase Dashboard에서 테이블을 하나씩 새로 만들 필요가 없습니다. 프로젝트의 PostgreSQL 마이그레이션이 이미 실행되어 필요한 테이블과 기본 RLS 정책을 생성했습니다.

> 이 문서의 목적은 **이미 생성된 테이블을 확인하고**, 어떤 데이터가 어디에 저장되며, 앱 화면이 안전하게 데이터를 불러오는지 이해하는 것입니다. 실제 환자 데이터를 입력하기 전에는 반드시 역할과 RLS 확인 단계를 마치세요.

## 1. 먼저 이해할 핵심 구조

안압케어에서는 Supabase Auth가 로그인한 사람의 UUID를 만들고, 앱은 그 UUID를 `public.profiles` 테이블에 연결합니다. 그 프로필의 `role` 값이 `patient`, `physician`, `educator`, `admin` 중 하나가 됩니다.

| 단계 | 담당 구성 요소 | 하는 일 |
|---|---|---|
| 1 | **Supabase Auth** | 이메일 매직링크로 사용자를 인증하고 UUID를 발급합니다. |
| 2 | **`public.profiles`** | UUID, 이메일, 기관, 역할, 활성 상태를 저장합니다. |
| 3 | **안압케어 서버** | 로그인 토큰을 확인하고 역할별 API 권한을 검사합니다. |
| 4 | **PostgreSQL + RLS** | 같은 기관·같은 환자 범위인지 데이터베이스에서 다시 확인합니다. |
| 5 | **앱 화면** | 서버가 허용한 데이터만 대시보드에 표시합니다. |

이중 확인 구조가 필요한 이유는 브라우저에서 보이는 화면만으로 권한을 판단하면 안 되기 때문입니다. RLS는 행 단위로 데이터 접근을 제한하는 PostgreSQL 보안 기능이며, Supabase Auth와 함께 사용하면 브라우저에서 데이터베이스까지 권한을 이어서 적용할 수 있습니다.[1]

## 2. Supabase에서 생성된 테이블을 확인하는 방법

Supabase Dashboard에서 해당 프로젝트를 연 뒤, 왼쪽 메뉴의 **Table Editor**를 선택하세요. 스키마 선택란이 보이면 `public`을 선택합니다. 아래 표의 테이블이 표시되면 정상입니다.

| 구분 | 테이블 | 주요 역할 |
|---|---|---|
| 기관·권한 | `organizations` | 병원 또는 운영 기관 정보 |
| 기관·권한 | `profiles` | Supabase Auth UUID, 이메일, 역할, 활성 상태 |
| 환자 | `patients` | 환자 공개 식별자, 차트 번호, 진단, Auth 사용자 연결 |
| 안압 | `iop_targets` | OD·OS 목표 안압과 적용 시작일 |
| 안압 | `iop_measurements` | 좌·우안 안압 기록, 품질, 업로드 멱등 키, 제외 상태 |
| 점안 | `prescriptions` | 약품, 좌·우안, 일정, 처방 기간 |
| 점안 | `dose_events` | 처방별·눈별 점안 완료 이벤트와 오프라인 동기화 키 |
| 기기 | `devices` | 기관 대여·개인 소유 기기 정보와 상태 |
| 기기 | `device_assignments` | 기기-환자 연결, 반납 예정일, 반납·연결 해제 시점 |
| 기기 | `device_status_history` | 기기 상태 변경 이력 |
| 운영 | `notifications` | D-3·D-1·당일·연체·수신 중단 알림 이벤트 |
| 운영 | `audit_logs` | 데이터 조회·변경·제외의 감사 로그와 해시 체인 |
| 운영 | `dashboard_preferences` | 의료진별 환자 목록 열·필터 설정 |

> `OD`는 우안, `OS`는 좌안을 의미합니다. 안압·점안 이벤트는 두 눈을 하나의 값으로 합치지 않고 각각 저장하도록 설계되어 있습니다.

## 3. 가장 먼저 확인할 테이블: `profiles`

**Table Editor → `profiles`**를 열고, 본인 이메일 행을 찾으세요. 다음 값이 확인되면 로그인 연동이 정상입니다.

| 열 | 기대 값 | 의미 |
|---|---|---|
| `id` | UUID 형식 | Supabase Auth의 사용자 ID |
| `email` | 본인 로그인 이메일 | Auth 계정과 연결된 이메일 |
| `organization_id` | 숫자 | 소속 기관 식별자 |
| `role` | 초기 운영자는 `admin` | 앱에서 표시·서버에서 검사하는 역할 |
| `is_active` | `true` | 사용 가능한 계정 상태 |

처음 운영 계정은 `admin`으로 승격되어 있습니다. 이후에는 안압케어 관리자 화면의 **기관 사용자 역할 관리** 영역에서 새 사용자에게 `patient`, `physician`, `educator`, `admin` 역할을 부여합니다. 의료 데이터 때문에 Table Editor에서 역할을 임의로 자주 바꾸는 방식은 권장하지 않습니다.

## 4. 환자 테이블 연결을 확인하는 방법

첫 로그인 사용자가 `patient` 역할이면 서버는 `patients` 테이블에 해당 계정의 환자 프로필을 자동으로 만듭니다. **Table Editor → `patients`**에서 `user_id`가 `profiles.id`와 같은 행을 확인할 수 있습니다.

| 연결 | 의미 |
|---|---|
| `profiles.id` → `patients.user_id` | 로그인한 사람이 어떤 환자 프로필인지 연결 |
| `patients.id` → `iop_measurements.patient_id` | 어떤 환자의 안압 기록인지 연결 |
| `patients.id` → `prescriptions.patient_id` | 어떤 환자의 처방인지 연결 |
| `patients.id` → `dose_events.patient_id` | 어떤 환자의 점안 이벤트인지 연결 |
| `patients.id` → `device_assignments.patient_id` | 어떤 환자에게 기기가 연결되었는지 표시 |

## 5. SQL Editor에서 안전하게 확인하는 읽기 전용 쿼리

Table Editor가 익숙하지 않다면 Supabase 왼쪽 메뉴의 **SQL Editor**에서 아래 쿼리를 한 줄씩 실행해도 됩니다. 이 쿼리는 데이터를 바꾸지 않고 최대 20행만 읽습니다.

```sql
-- 1) 사용자 역할 확인
select id, email, role, is_active, organization_id, created_at
from public.profiles
order by created_at desc
limit 20;
```

```sql
-- 2) 환자 프로필 연결 확인
select public_id, user_id, diagnosis, is_active, created_at
from public.patients
order by created_at desc
limit 20;
```

```sql
-- 3) 저장된 안압 기록 확인
select patient_id, eye, value_mmhg, measured_at, quality, source, is_excluded
from public.iop_measurements
order by measured_at desc
limit 20;
```

```sql
-- 4) 감사 로그가 남는지 확인
select action, target_type, target_id, actor_user_id, created_at
from public.audit_logs
order by created_at desc
limit 20;
```

> 초보 단계에서는 `delete`, `truncate`, `drop`, `update`로 시작하는 SQL은 실행하지 마세요. 의료 데이터 테스트도 Table Editor보다 앱 화면을 통해 입력하는 편이 감사 로그와 멱등 처리까지 함께 검증할 수 있어 안전합니다.

## 6. 앱에서 테이블로 데이터가 저장되는 흐름

환자가 앱에서 **새 안압 기록**을 저장할 때의 흐름은 아래와 같습니다.

1. 브라우저의 Supabase Auth 세션이 사용자 토큰을 보냅니다.
2. 안압케어 서버가 토큰을 검증하고 해당 사용자의 `profiles.role`을 읽습니다.
3. 서버는 `patient`가 자기 `patient_id`에만 기록하는지, `physician`·`admin`이 진료 범위에서 작업하는지 확인합니다.
4. `iop_measurements`에 `OD` 또는 `OS` 값, 측정 시각, 품질, `idempotency_key`를 저장합니다.
5. 같은 `idempotency_key`가 다시 도착하면 중복 기록을 만들지 않습니다.
6. `audit_logs`에 작업 이력과 이전 해시·현재 해시를 저장합니다.

점안 완료는 `dose_events`, 기기 반납 일정은 `device_assignments`, 알림 발송 준비는 `notifications`에 같은 방식으로 저장됩니다. 앱이 외부 약품 API를 쓸 때도 서비스 키는 브라우저가 아니라 서버 환경변수에만 남도록 구성했습니다.

## 7. RLS를 확인해야 하는 이유

`public` 스키마의 테이블은 반드시 RLS를 켜고 정책을 함께 설정해야 합니다. RLS 정책은 사용자가 조회·삽입·수정할 수 있는 행을 데이터베이스 수준에서 제한합니다.[1]

현재 안압케어의 기본 원칙은 아래와 같습니다.

| 역할 | 허용되는 기본 범위 | 제한되는 기본 범위 |
|---|---|---|
| `patient` | 본인 환자 프로필, 본인 안압·점안·알림 | 다른 환자, 처방 목표 변경, 측정 제외 |
| `physician` | 소속 기관의 임상 기록, 처방·목표 안압 관리 | 다른 기관의 환자, 사용자 역할 관리 |
| `educator` | 교육 운영 화면 | 임상 기록 변경과 처방·목표 안압 변경 |
| `admin` | 소속 기관의 역할 관리와 운영 화면 | 다른 기관의 데이터 |

이 정책은 앱 서버의 권한 검사와 함께 작동합니다. 다만 `service_role` 또는 Supabase의 secret key는 RLS를 우회할 수 있으므로 서버에서만 사용해야 하며, 브라우저나 GitHub에 절대 넣으면 안 됩니다.[2]

## 8. 지금 사용자가 할 순서

| 순서 | 할 일 | 완료 기준 |
|---|---|---|
| 1 | Supabase **Table Editor**에서 `profiles`를 연다. | 본인 이메일과 역할을 확인한다. |
| 2 | `patients`를 열어 환자 연결 상태를 본다. | `user_id` 연결 또는 향후 생성 예정 상태를 이해한다. |
| 3 | SQL Editor에서 위의 읽기 전용 쿼리를 실행한다. | 오류 없이 표가 표시된다. |
| 4 | 이메일 발송 제한이 풀린 뒤 앱에 재로그인한다. | `admin · 관리자` 대시보드를 확인한다. |
| 5 | 개발용 두 번째 계정을 만들어 `patient`로 둔다. | admin과 patient의 화면·조회 범위 차이를 확인한다. |

## 9. 테이블을 새로 만들고 싶을 때

앞으로 기능을 추가할 때는 Table Editor에서 임의로 테이블을 먼저 만드는 대신, **GitHub의 프로젝트 코드에서 스키마와 마이그레이션을 먼저 변경**하는 방식을 사용하세요. 그래야 개발·운영 환경에 같은 구조를 반복 적용할 수 있습니다. Supabase Dashboard는 조회·검증에 사용하고, 구조 변경은 마이그레이션 파일로 기록하는 것이 안전합니다.[3]

## 참고 자료

[1]: https://supabase.com/docs/guides/database/postgres/row-level-security "Supabase — Row Level Security"
[2]: https://supabase.com/docs/guides/api/api-keys "Supabase — Understanding API keys"
[3]: https://supabase.com/docs/guides/database/tables "Supabase — Tables and Data"
