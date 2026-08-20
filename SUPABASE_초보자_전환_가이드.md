# 안압케어를 Supabase에서 운영하기: 초보자용 단계별 가이드

## 먼저 이해할 점

안압케어는 이제 **React 화면 + Express/tRPC 서버 + Supabase PostgreSQL + Supabase Auth 매직링크** 구조로 전환되었습니다. Supabase는 PostgreSQL, Auth, Storage, Data API 등을 제공하는 백엔드 플랫폼입니다. 앱의 코드 전환과 RLS 정책 적용은 완료되었지만, 실제 운영 전에는 로그인 이메일 발송·리디렉션 주소·역할별 화면을 직접 확인해야 합니다.

> 가장 안전한 방법은 현재 운영 중인 앱을 바로 바꾸지 않고, 먼저 Supabase에 **별도의 개발용 프로젝트**를 만든 뒤 연결과 로그인부터 검증하는 것입니다. 실제 환자 데이터는 전환 검증이 끝나기 전까지 입력하거나 복사하지 마세요.

| 구분 | 이전 구조 | 현재 안압케어 |
|---|---|---|
| 데이터베이스 | MySQL/TiDB + Drizzle MySQL | Supabase PostgreSQL + PostgreSQL용 Drizzle |
| 로그인 | Manus OAuth | Supabase Auth 이메일 매직링크 |
| 사용자 권한 | 서버 tRPC RBAC | 서버 RBAC + Supabase RLS 이중 검사 |
| 웹사이트 실행 | Manus 프로젝트 서버 | Manus 기본 호스팅 배포 준비 완료 |

Supabase는 데이터베이스·인증을 제공하지만, 현재의 Express 웹 서버를 그대로 자동 호스팅하는 서비스는 아닙니다. 따라서 **Supabase는 백엔드**, GitHub는 **소스 코드 보관소**, Manus 기본 호스팅 또는 다른 호스팅 서비스는 **웹사이트 실행 장소**로 이해하면 됩니다.

## 권장 전환 순서

초보자에게는 한 번에 모든 것을 옮기기보다 아래의 두 단계 전환을 권장합니다.

| 단계 | 목표 | 지금 바로 해야 할 일 |
|---|---|---|
| 1단계 | Supabase 개발 프로젝트를 만들고 안전한 연결 정보를 준비 | 이 문서의 1~4단계를 완료 |
| 2단계 | 앱 코드를 PostgreSQL/Supabase Auth/RLS 구조로 변환 | 연결 정보가 준비된 뒤 코드 변환 요청 |
| 3단계 | 테스트·배포·알림 스케줄 활성화 | 빈 테스트 데이터로 점검 후 배포 |

## 1단계 — Supabase에서 개발용 프로젝트 만들기

1. [Supabase Dashboard](https://supabase.com/dashboard)에 로그인합니다.
2. 왼쪽 상단의 조직을 선택한 뒤 **New project**를 누릅니다.
3. 프로젝트 이름은 예를 들어 `glaucoma-care-dev`로 정합니다. 실제 운영용과 구분하기 위해 이름 끝에 `-dev`를 붙이는 편이 안전합니다.
4. 의료진 사용자가 한국에 있다면 지연 시간을 줄일 수 있는 가까운 리전을 선택합니다. 이미 서비스 운영 리전이 정해져 있다면 그 리전과 일치시키는 것이 좋습니다.
5. Database Password는 길고 고유한 값으로 정하고, 비밀번호 관리 도구에 저장합니다. 채팅, GitHub, 소스 코드에는 절대 붙여 넣지 않습니다.
6. **Create new project**를 누르고 준비가 끝날 때까지 기다립니다.

Supabase 프로젝트마다 PostgreSQL 데이터베이스가 하나씩 생성됩니다. 프로젝트 생성과 React 연동의 기본 절차는 Supabase 공식 시작 가이드에 정리되어 있습니다.[1]

## 2단계 — 지금은 이 세 가지 정보만 확인하기

프로젝트가 준비되면 Dashboard 상단의 **Connect** 또는 **Project Settings → API**에서 다음 항목을 찾습니다.

| 항목 | 용도 | 어디에 두나 | 브라우저 노출 가능 여부 |
|---|---|---|---|
| Project URL | Supabase 프로젝트 주소 | 서버·클라이언트 환경변수 | 가능 |
| Publishable key | 사용자 로그인 후 RLS가 적용되는 공개 키 | 클라이언트 환경변수 | 가능. 단, RLS 필수 |
| Service role key | 서버 관리자 작업용 비밀 키 | 서버 환경변수만 | **절대 불가** |
| Database connection string | 서버 ORM·마이그레이션용 연결 주소 | 서버 환경변수만 | **절대 불가** |

현재는 이 값을 채팅에 보내지 마세요. 다음 코드 변환 단계에서 안전한 입력 창을 통해 필요한 값만 등록하면 됩니다. 특히 `service_role` 키와 데이터베이스 비밀번호는 공개 GitHub 저장소에 올라가면 안 됩니다.

Supabase React 가이드는 Project URL과 publishable key를 클라이언트 환경변수로 사용하되, 배포 플랫폼의 환경변수에 저장하고 Git에 커밋하지 말라고 안내합니다.[2]

## 3단계 — 데이터베이스 연결 방식 선택하기

현재 앱처럼 서버가 있는 구조에서는 **클라이언트가 PostgreSQL에 직접 접속하면 안 됩니다.** 서버만 데이터베이스 연결 문자열을 사용하고, 화면은 서버 API 또는 Supabase의 RLS 보호 Data API만 호출해야 합니다.

| 사용처 | Supabase에서 선택할 연결 | 이유 |
|---|---|---|
| 마이그레이션·백업·개발 도구 | Direct connection | PostgreSQL 관리 작업에 적합 |
| 현재와 같은 장시간 Express 서버 | Direct connection 또는 Session pooler | 지속 실행 서버에 적합 |
| 서버리스/자동 확장 환경 | Transaction pooler | 짧은 요청이 많은 환경에 적합 |

Supabase 공식 문서는 서버리스·엣지 환경에서는 Transaction pooler를, 지속형 백엔드에는 Direct connection 또는 Session pooler를 선택하도록 설명합니다.[3]

## 4단계 — 로그인 전환 상태 확인하기

안압케어는 **Supabase Auth 이메일 매직링크**로 전환되어 있습니다. 사용자가 이메일 주소를 입력하면 Supabase가 로그인 링크를 보내고, 링크를 열면 브라우저가 Supabase 세션을 받아 서버 API에 전달합니다. 서버 RBAC와 PostgreSQL RLS가 함께 역할·기관·환자 범위를 검사합니다.

| 항목 | 현재 적용 상태 | 운영 전 확인할 내용 |
|---|---|---|
| 로그인 방식 | Supabase Auth 매직링크 | 이메일 수신·링크 클릭·로그아웃 직접 확인 |
| 프로필 자동 생성 | 기본 `patient` 역할·기관·환자 프로필 생성 | 새 테스트 계정으로 생성 결과 확인 |
| 운영자 초기화 | 지정 운영자 프로필의 `admin` 승격 완료 | 운영자 계정 로그인 후 관리자 화면 확인 |
| 권한 보안 | 서버 RBAC + PostgreSQL RLS | patient·physician·educator·admin별 허용·차단 확인 |

## 5단계 — 코드 전환 완료 항목 확인하기

다음 전환 작업은 코드·마이그레이션·자동 테스트 수준에서 완료되었습니다.

1. MySQL 전용 Drizzle 구성을 PostgreSQL용 드라이버와 스키마로 교체했습니다.
2. `organizations`, `profiles`, `patients`, `iop_measurements`, `dose_events`, `devices`, `notifications`, `audit_logs`를 포함한 도메인 테이블을 Supabase에 적용했습니다.
3. Supabase Auth 사용자와 `profiles`/역할 테이블을 연결했습니다.
4. `patient`, `physician`, `educator`, `admin` 역할별 RLS 정책을 적용했습니다.
5. 서버 측 tRPC 권한 검사도 유지합니다. **RLS는 추가 안전망이지 서버 RBAC를 대체하지 않습니다.**
6. e약은요 서비스 키, Supabase service role key 같은 비밀 값은 서버 환경변수에만 저장합니다.
7. 자동 테스트로 프로필 생성, 권한 경계, 안압·점안 처리, 감사 로그, RLS 차단을 확인했습니다.

## 6단계 — Supabase SQL Editor에서 임의 SQL을 실행하지 마세요

인터넷 예제에 있는 `create table`, `grant`, `policy` SQL을 그대로 실행하면 의료 기록이 공개될 수 있습니다. 특히 `using (true)`처럼 모든 사용자에게 읽기 권한을 주는 예제 정책은 안압케어에 사용하면 안 됩니다.

안압케어에서는 다음 원칙으로 RLS 정책을 설계합니다.

| 역할 | 읽기 가능 범위 | 쓰기 가능 범위 |
|---|---|---|
| patient | 자기 `patient_id`의 기록만 | 자기 측정·점안 이벤트만 |
| physician | 소속 기관의 담당 환자 | 처방·목표 안압·제외 처리 |
| educator | 교육 관련 데이터만 | 교육 콘텐츠·교육 이력 |
| admin | 기관 운영 범위 | 역할·기관 설정. 임상 기록 수정은 제한 |

Supabase Data API를 브라우저에서 사용하려면 RLS를 활성화하고 정책을 설정해야 합니다.[3] 이 앱에서는 **정책 SQL을 제가 현재 테이블 구조에 맞춰 만든 뒤** 사용자가 Supabase SQL Editor에서 한 번에 실행하는 방식이 안전합니다.

## 7단계 — 배포 위치 결정하기

Supabase 전환 뒤에도 웹 앱을 실행할 호스팅이 필요합니다. 초보자에게는 현재 프로젝트의 **Manus 기본 호스팅**을 유지하는 편이 가장 간단합니다. 필요하면 GitHub와 연결된 다른 Node.js 호스팅도 선택할 수 있지만, 현재 Express/tRPC 서버와 Supabase 환경변수를 함께 설정해야 합니다.

배포 직전 환경변수는 다음처럼 구분합니다.

```text
# 화면에 공개해도 되는 값 (RLS가 반드시 적용되어야 함)
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=

# 서버에서만 사용하는 값 — GitHub/브라우저에 절대 노출 금지
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
EYAK_SERVICE_KEY=
```

## 8단계 — 매직링크가 열릴 주소 등록하기

매직링크는 사용자를 앱으로 되돌려 보내야 하므로, 앱의 주소를 Supabase에 허용 목록으로 등록해야 합니다. 공식 메뉴는 **Authentication → URL Configuration**입니다.[5]

1. Supabase Dashboard에서 `glaucoma-care-dev` 프로젝트를 엽니다.
2. 왼쪽 메뉴에서 **Authentication**을 누르고 **URL Configuration**을 엽니다. 직접 링크는 [URL Configuration](https://supabase.com/dashboard/project/_/auth/url-configuration)입니다.
3. **Site URL**에는 실제 공개할 안압케어 주소를 `https://`부터 정확하게 입력합니다. 배포 전이면 아직 임시 주소를 기본값으로 지정하지 않습니다.
4. **Redirect URLs**에는 개발·검증·운영에서 매직링크를 받은 뒤 돌아올 주소만 하나씩 추가합니다. 임시 미리보기 주소가 필요할 때만 해당 주소를 추가하고, 운영에서는 와일드카드보다 정확한 HTTPS 주소를 사용합니다.
5. 저장한 뒤 매직링크를 다시 요청해, 링크를 연 브라우저가 안압케어 홈으로 돌아오는지 확인합니다.

> `redirectTo`가 코드에서 지정된 경우에는 그 주소가 Redirect URLs 허용 목록과 일치해야 합니다. Site URL은 `redirectTo`가 없을 때의 기본 복귀 주소입니다.[5]

## 9단계 — SMTP로 이메일 발송 한도 해소하기

Supabase의 기본 이메일 발송 기능은 개발·테스트용입니다. 프로젝트 팀에 등록된 주소로만 보낼 수 있고, 현재 시간당 **2통**이라는 제한이 적용됩니다. 이 제한은 기본 발송 기능에서는 변경할 수 없습니다.[6] 따라서 실제 사용자 로그인에는 사용자 지정 SMTP가 필요합니다.

| 순서 | Dashboard 위치 또는 준비물 | 확인할 내용 |
|---|---|---|
| 1 | SMTP 제공업체 계정 | Resend, AWS SES, Postmark, SendGrid, Brevo 등 SMTP를 제공하는 서비스를 선택 |
| 2 | 발신 도메인 | `auth.example.com` 같은 인증 전용 발신 도메인을 검증하고 SPF·DKIM·DMARC 설정 |
| 3 | **Authentication → SMTP** | [사용자 지정 SMTP 설정](https://supabase.com/dashboard/project/_/auth/smtp)에서 Custom SMTP를 활성화 |
| 4 | SMTP 입력 항목 | SMTP Host, Port, Username, Password, Sender email, Sender name 입력 |
| 5 | **Authentication → Rate Limits** | [Rate Limits](https://supabase.com/dashboard/project/_/auth/rate-limits)에서 SMTP 제공업체의 허용량에 맞게 이메일 발송 한도를 검토 |
| 6 | 테스트 | 팀 이메일과 별도 테스트 이메일에 매직링크를 각각 한 번 보내고 수신·복귀 주소 확인 |

SMTP 입력값은 **SMTP 제공업체에서 발급한 값만** 사용합니다. `SUPABASE_SERVICE_ROLE_KEY`, 데이터베이스 비밀번호, SMTP 비밀번호는 GitHub·브라우저 코드·일반 채팅에 넣지 않습니다. 저장 뒤에는 Supabase가 새 SMTP를 통해 모든 주소에 메일을 보낼 수 있으며, 기본적으로 시간당 30통의 낮은 보호 한도가 적용되므로 Rate Limits에서 운영 규모에 맞게 검토해야 합니다.[6]

로그인 화면의 60초 재요청 제한은 Supabase의 동일 사용자 OTP/매직링크 제한과도 일치합니다. 사용자가 여러 번 눌러도 발송량이 급증하지 않도록 이 제한은 유지합니다.[7]

## 오늘 해야 할 일: 아주 짧은 체크리스트

1. Supabase에서 `glaucoma-care-dev` 프로젝트를 만듭니다.
2. Project URL과 publishable key가 어디에 있는지 확인합니다. 비밀 키는 공유하지 않습니다.
3. 로그인 방식에서 **Supabase Auth로 전환**할지, **Manus OAuth를 잠시 유지**할지 결정합니다.
4. 완료했다면 “Supabase 개발 프로젝트를 만들었고, Supabase Auth로 전환하겠다”라고 알려 주세요.
5. 그러면 제가 다음 단계로 **PostgreSQL 스키마, RLS 정책, 코드 변환 계획**을 실제 프로젝트에 적용하겠습니다. 비밀값이 필요한 순간에는 일반 메시지가 아닌 안전한 입력 방식으로만 요청합니다.

## 의료 서비스 운영 전 필수 확인

이 앱은 안압·처방·점안 정보처럼 민감할 수 있는 건강 정보를 다룹니다. 실제 환자 데이터를 입력하기 전에는 병원 내부 보안 규정, 개인정보 보호 의무, 접근 권한 승인 절차, 백업·복구 절차, 운영 모니터링을 별도로 검토해야 합니다. 이 가이드는 개발 전환 절차이며 법률·의료 규제 적합성 판단을 대신하지 않습니다.

## 참고 자료

[1]: https://supabase.com/docs/guides/getting-started "Supabase Getting Started"
[2]: https://supabase.com/docs/guides/getting-started/quickstarts/reactjs "Use Supabase with React"
[3]: https://supabase.com/docs/guides/database/connecting-to-postgres "Connect to your database"
[4]: https://supabase.com/docs/guides/auth "Supabase Auth"
[5]: https://supabase.com/docs/guides/auth/redirect-urls "Supabase Auth Redirect URLs"
[6]: https://supabase.com/docs/guides/auth/auth-smtp "Supabase Custom SMTP"
[7]: https://supabase.com/docs/guides/auth/rate-limits "Supabase Auth Rate Limits"
