import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BellRing,
  BookOpenCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Eye,
  Gauge,
  HeartPulse,
  MonitorCog,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";
import { useState } from "react";

type DemoRole = "patient" | "physician" | "educator" | "admin";

const roles: Array<{ id: DemoRole; name: string; title: string; icon: typeof HeartPulse }> = [
  { id: "patient", name: "환자", title: "오늘의 관리", icon: HeartPulse },
  { id: "physician", name: "의사", title: "진료 운영", icon: Stethoscope },
  { id: "educator", name: "교육담당자", title: "교육 운영", icon: BookOpenCheck },
  { id: "admin", name: "관리자", title: "기관 운영", icon: MonitorCog },
];

function DemoLabel() {
  return <p className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-extrabold text-amber-900"><Eye className="h-3.5 w-3.5" />가상 시연 · 개인정보·실제 의료 기록 없음</p>;
}

function Stat({ label, value, note, tone = "sky" }: { label: string; value: string; note: string; tone?: "sky" | "rose" | "slate" | "emerald" }) {
  const tones = {
    sky: "border-sky-200 bg-sky-50 text-sky-950",
    rose: "border-rose-200 bg-rose-50 text-rose-950",
    slate: "border-slate-200 bg-white text-slate-950",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
  };
  return <div className={`rounded-2xl border p-4 ${tones[tone]}`}><p className="text-xs font-bold text-slate-600">{label}</p><p className="mt-2 text-2xl font-extrabold tracking-tight">{value}</p><p className="mt-1 text-xs text-slate-600">{note}</p></div>;
}

function PatientDemo() {
  return <div className="space-y-5">
    <section className="grid gap-5 lg:grid-cols-[1.35fr_.85fr]">
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6"><div className="flex items-start justify-between gap-4"><div><p className="inline-flex items-center gap-2 text-sm font-bold text-rose-800"><BellRing className="h-4 w-4" />오늘의 우선 행동</p><h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-950">오후 점안 전 안압을 다시 측정해 주세요</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-700">가상 시나리오상 우안 수치가 목표 범위를 넘었습니다. 실제 화면에서는 환자의 기록을 기준으로 한 가지 행동을 먼저 제안합니다.</p></div><AlertTriangle className="h-6 w-6 shrink-0 text-rose-700" /></div><div className="mt-6 flex flex-wrap gap-3"><button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white"><Gauge className="h-4 w-4" />새 안압 기록</button><button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-800">측정 이력 보기 <ChevronRight className="h-4 w-4" /></button></div></div>
      <aside className="rounded-3xl bg-slate-950 p-6 text-white"><p className="inline-flex items-center gap-2 text-sm font-bold text-sky-200"><ShieldCheck className="h-4 w-4" />처방 기준</p><h2 className="mt-3 text-xl font-extrabold">목표 안압 · 읽기 전용</h2><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-slate-300">OD · 우안</p><p className="mt-1 text-3xl font-extrabold">15.0</p><p className="text-xs text-sky-200">mmHg</p></div><div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-slate-300">OS · 좌안</p><p className="mt-1 text-3xl font-extrabold">16.0</p><p className="text-xs text-sky-200">mmHg</p></div></div></aside>
    </section>
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Stat label="OD 최근 측정" value="19.0" note="mmHg · 우안" tone="rose" /><Stat label="OS 최근 측정" value="15.5" note="mmHg · 좌안" /><Stat label="오늘 점안" value="1/2" note="완료 / 예정" tone="rose" /><Stat label="대여 기기" value="D-3" note="반납 알림 예정" tone="slate" /></section>
    <section className="grid gap-5 lg:grid-cols-2"><div className="rounded-3xl border border-slate-200 bg-white p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-bold text-sky-700">측정 이력</p><h2 className="mt-1 text-xl font-extrabold">최근 안압 기록</h2></div><Activity className="h-6 w-6 text-sky-700" /></div><div className="mt-5 divide-y divide-slate-100"><HistoryRow eye="OD · 우안" value="19.0" time="오늘 08:10" emphasis /><HistoryRow eye="OS · 좌안" value="15.5" time="오늘 08:10" /><HistoryRow eye="OD · 우안" value="14.5" time="어제 20:00" /></div></div><div className="rounded-3xl border border-slate-200 bg-white p-6"><p className="text-sm font-bold text-sky-700">점안 관리</p><h2 className="mt-1 text-xl font-extrabold">오늘의 점안 일정</h2><div className="mt-5 space-y-3"><DoseRow time="08:00" eye="OD · OS" state="완료" /><DoseRow time="20:00" eye="OD · OS" state="예정" /></div><div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950"><p className="font-bold">기기 반납 안내</p><p className="mt-1 text-xs leading-5">대여 기기 반납일은 3일 뒤입니다. D-3, D-1, 당일, 연체 상태에 따라 알림이 생성됩니다.</p></div></div></section>
  </div>;
}

function HistoryRow({ eye, value, time, emphasis = false }: { eye: string; value: string; time: string; emphasis?: boolean }) {
  return <div className="flex items-center justify-between py-3"><div><p className="font-bold text-slate-900">{eye}</p><p className="mt-1 text-xs text-slate-500">{time} · 가상 기록</p></div><p className={`text-xl font-extrabold ${emphasis ? "text-rose-700" : "text-slate-950"}`}>{value} <span className="text-xs font-medium text-slate-500">mmHg</span></p></div>;
}

function DoseRow({ time, eye, state }: { time: string; eye: string; state: "완료" | "예정" }) {
  const completed = state === "완료";
  return <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4"><div><p className="font-bold">{eye} · {time}</p><p className="mt-1 text-xs text-slate-500">처방별 좌·우안 이벤트</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${completed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{state}</span></div>;
}

function ClinicianDemo({ admin = false }: { admin?: boolean }) {
  const queues = [
    ["즉시 조치", "P-DEMO-102", "우안 측정값이 목표 상한을 넘음", "OD 19.0", "OD 15.0 / OS 16.0"],
    ["오늘 예정", "P-DEMO-207", "점안 순응도 확인 필요", "OS 16.5", "OD 16.0 / OS 16.0"],
    ["모니터링", "P-DEMO-315", "대여 기기 반납 D-3", "OD 14.0", "OD 15.0 / OS 15.0"],
  ];
  return <div className="space-y-5"><section className="rounded-3xl bg-slate-950 p-6 text-white"><div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><p className="text-sm font-bold text-sky-200">CLINICAL OPERATIONS</p><h2 className="mt-2 text-3xl font-extrabold tracking-tight">위험 환자 큐가 먼저입니다</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">실제 서비스에서는 소속 기관 환자만 표시하고, 의사와 관리자만 임상 데이터에 접근합니다.</p></div><div className="grid grid-cols-2 gap-3"><Stat label="즉시 조치" value="1" note="우선 확인 필요" tone="rose" /><Stat label="오늘 예정" value="1" note="당일 후속 조치" /></div></div></section><section className="rounded-3xl border border-slate-200 bg-white p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-bold text-sky-700">위험 환자 큐</p><h2 className="mt-1 text-xl font-extrabold">즉시 조치 · 오늘 예정 · 모니터링</h2></div><span className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700">표시 기준: 전체</span></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead><tr className="border-y border-slate-200 text-xs font-bold text-slate-500"><th className="p-3">우선순위</th><th className="p-3">환자 ID</th><th className="p-3">사유</th><th className="p-3">최근 안압</th><th className="p-3">처방 목표</th></tr></thead><tbody>{queues.map(([tier, patient, reason, latest, target]) => <tr key={patient} className="border-b border-slate-100 text-sm"><td className="p-3"><QueueBadge tier={tier} /></td><td className="p-3 font-bold">{patient}</td><td className="p-3">{reason}</td><td className="p-3">{latest}</td><td className="p-3">{target}</td></tr>)}</tbody></table></div><p className="mt-4 text-xs text-slate-500">가상 환자 ID만 사용했습니다. 실제 화면의 필터와 열 설정은 사용자별로 저장됩니다.</p></section>{admin && <AdminPanel />}</div>;
}

function QueueBadge({ tier }: { tier: string }) { const className = tier === "즉시 조치" ? "bg-rose-100 text-rose-800" : tier === "오늘 예정" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"; return <span className={`rounded-full px-3 py-1 text-xs font-bold ${className}`}>{tier}</span>; }

function EducatorDemo() { return <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]"><section className="rounded-3xl bg-slate-950 p-7 text-white"><p className="text-sm font-bold text-sky-200">EDUCATION WORKSPACE</p><h2 className="mt-3 text-3xl font-extrabold tracking-tight">이해와 순응을 돕는<br />교육 운영 공간</h2><p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">가상 시연에서는 교육 콘텐츠, 점안 안내, 기기 반납 절차를 보여 줍니다. 교육담당자는 개별 임상 기록·처방 목표 변경 권한이 없습니다.</p><div className="mt-7 flex flex-wrap gap-3"><span className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-bold"><ShieldCheck className="h-4 w-4 text-sky-200" />서버 권한 분리 적용</span><span className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-bold"><BookOpenCheck className="h-4 w-4 text-sky-200" />교육 이력 관리</span></div></section><section className="rounded-3xl border border-slate-200 bg-white p-7"><BookOpenCheck className="h-8 w-8 text-sky-700" /><p className="mt-5 text-sm font-bold text-sky-700">이번 주 교육 운영</p><h2 className="mt-1 text-xl font-extrabold">콘텐츠와 안내 현황</h2><div className="mt-5 space-y-3"><EducationRow title="올바른 점안 방법" status="배포됨" /><EducationRow title="자가 안압 측정 품질" status="검토 필요" /><EducationRow title="대여 기기 반납 절차" status="배포됨" /></div></section></div>; }

function EducationRow({ title, status }: { title: string; status: string }) { return <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4"><p className="text-sm font-bold text-slate-900">{title}</p><span className={`rounded-full px-3 py-1 text-xs font-bold ${status === "배포됨" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{status}</span></div>; }

function AdminPanel() { const members = [["A. Kim", "admin", "기관 설정·사용자 관리"], ["D. Lee", "physician", "진료·처방·목표 안압"], ["E. Park", "educator", "교육 콘텐츠"], ["P-DEMO-102", "patient", "본인 데이터"]]; return <section className="rounded-3xl border border-slate-200 bg-white p-6"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-100 text-sky-800"><Users className="h-5 w-5" /></div><div><p className="text-sm font-bold text-sky-700">관리자 권한</p><h2 className="text-xl font-extrabold">기관 사용자 역할 관리</h2></div></div><div className="mt-5 divide-y divide-slate-100">{members.map(([name, role, permission]) => <div key={name} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">{name}</p><p className="mt-1 text-xs text-slate-500">가상 계정 · {permission}</p></div><span className="inline-flex min-h-10 items-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700">{role}</span></div>)}</div></section>; }

export default function Demo() {
  const requestedRole = new URLSearchParams(window.location.search).get("role");
  const [role, setRole] = useState<DemoRole>(() => roles.some(item => item.id === requestedRole) ? requestedRole as DemoRole : "patient");
  const activeRole = roles.find(item => item.id === role)!;
  const RoleIcon = activeRole.icon;
  return <main className="min-h-screen bg-slate-50 text-slate-950"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8"><a href="/" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold text-slate-700 hover:bg-slate-100"><ArrowLeft className="h-4 w-4" />로그인 화면</a><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-sky-700 text-white"><Eye className="h-5 w-5" /></div><div><p className="font-extrabold">안압케어</p><p className="text-xs text-slate-500">역할별 가상 구동 시연</p></div></div></div></header><div className="mx-auto max-w-7xl px-5 py-8 sm:px-8"><DemoLabel /><section className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-bold text-sky-700">SAFE PRODUCT WALKTHROUGH</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">역할별 전체 구동 흐름</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">역할을 바꾸면 같은 플랫폼이 각 사용자에게 어떤 화면과 권한을 제공하는지 확인할 수 있습니다. 아래 값은 모두 시연용 가상 데이터입니다.</p></div><div className="flex flex-wrap gap-2" role="tablist" aria-label="가상 사용자 역할 선택">{roles.map(item => { const Icon = item.icon; const selected = item.id === role; return <button key={item.id} type="button" role="tab" aria-selected={selected} onClick={() => setRole(item.id)} className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 ${selected ? "border-sky-700 bg-sky-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}><Icon className="h-4 w-4" />{item.name}</button>; })}</div></section><section className="mt-8 rounded-3xl border border-sky-200 bg-sky-50 p-5"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-sky-700 text-white"><RoleIcon className="h-5 w-5" /></div><div><p className="font-extrabold text-sky-950">현재 시연 역할: {activeRole.name} · {activeRole.title}</p><p className="mt-1 text-sm leading-6 text-sky-900">실제 서비스에서는 Supabase Auth 세션, 서버 RBAC, PostgreSQL RLS가 함께 이 역할의 화면과 데이터 범위를 검사합니다.</p></div></div></section><div className="mt-6">{role === "patient" ? <PatientDemo /> : role === "physician" ? <ClinicianDemo /> : role === "educator" ? <EducatorDemo /> : <ClinicianDemo admin />}</div><section className="mt-6 grid gap-4 border-t border-slate-200 py-6 sm:grid-cols-3"><div className="flex gap-3"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" /><div><p className="text-sm font-bold">환자 안전 우선</p><p className="mt-1 text-xs leading-5 text-slate-600">위험도 기반으로 오늘의 행동과 의료진 큐를 분리합니다.</p></div></div><div className="flex gap-3"><ClipboardCheck className="h-5 w-5 shrink-0 text-sky-700" /><div><p className="text-sm font-bold">감사 가능한 기록</p><p className="mt-1 text-xs leading-5 text-slate-600">안압·점안·권한 변경은 감사 로그와 함께 관리됩니다.</p></div></div><div className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-slate-700" /><div><p className="text-sm font-bold">역할별 접근 제어</p><p className="mt-1 text-xs leading-5 text-slate-600">화면뿐 아니라 서버와 데이터베이스 수준에서 권한을 이중 검사합니다.</p></div></div></section></div></main>;
}
