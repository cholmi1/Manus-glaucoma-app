import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, ArrowRight, BellRing, BookOpenCheck, CheckCircle2, Eye, Gauge, HeartPulse, Loader2, LogOut, MonitorCog, Plus, ShieldCheck, Stethoscope, Users } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Role = "patient" | "physician" | "educator" | "admin";

const roleNames: Record<Role, string> = {
  patient: "patient · 환자",
  physician: "physician · 의사",
  educator: "educator · 교육담당자",
  admin: "admin · 관리자",
};

const roleIcons = { patient: HeartPulse, physician: Stethoscope, educator: BookOpenCheck, admin: MonitorCog } as const;

function Stat({ label, value, description, tone = "sky" }: { label: string; value: string; description: string; tone?: "sky" | "rose" | "slate" }) {
  const colors = { sky: "border-sky-200 bg-sky-50 text-sky-950", rose: "border-rose-200 bg-rose-50 text-rose-950", slate: "border-slate-200 bg-white text-slate-950" };
  return <div className={`rounded-2xl border p-4 ${colors[tone]}`}><p className="text-xs font-bold text-slate-600">{label}</p><p className="mt-2 text-2xl font-extrabold tracking-tight">{value}</p><p className="mt-1 text-xs text-slate-600">{description}</p></div>;
}

function Loading() { return <div className="grid gap-4 sm:grid-cols-3" aria-live="polite"><span className="sr-only">대시보드를 불러오는 중입니다.</span>{[1, 2, 3].map(item => <div className="h-28 animate-pulse rounded-3xl bg-slate-200" key={item} />)}</div>; }
function ErrorState({ message }: { message: string }) { return <section role="alert" className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-950"><AlertTriangle className="h-6 w-6" /><h2 className="mt-3 text-lg font-extrabold">데이터를 불러오지 못했습니다</h2><p className="mt-2 text-sm">{message}</p></section>; }

function PatientDashboard() {
  const utils = trpc.useUtils();
  const homeQuery = trpc.clinical.patient.home.useQuery();
  const home = homeQuery.data;
  const recordsQuery = trpc.clinical.measurements.list.useQuery({ patientId: home?.patientId ?? 0 }, { enabled: Boolean(home?.patientId) });
  const devicesQuery = trpc.clinical.devices.list.useQuery();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [eye, setEye] = useState<"OD" | "OS">("OD");
  const [value, setValue] = useState("15");
  const upload = trpc.clinical.measurements.upload.useMutation({
    onSuccess: result => {
      if (result.reason === "RENTAL_BLOCKED") { toast.error("대여 기기 반납 연체로 데이터 수신이 중단되었습니다."); return; }
      toast.success("안압 기록을 저장했습니다.");
      setDialogOpen(false);
      void utils.clinical.patient.home.invalidate();
      if (home) void utils.clinical.measurements.list.invalidate({ patientId: home.patientId });
    },
    onError: error => toast.error(error.message),
  });

  if (homeQuery.isLoading) return <Loading />;
  if (homeQuery.isError || !home) return <ErrorState message="환자 홈 정보를 다시 불러와 주세요." />;
  const latest = (recordEye: "OD" | "OS") => recordsQuery.data?.find(item => item.eye === recordEye);
  const unresolvedDose = home.todayEvents.some(item => !item.taken);
  const critical = home.priorityAction.urgency === "critical";
  const submit = (event: FormEvent) => {
    event.preventDefault();
    upload.mutate({ patientId: home.patientId, items: [{ idempotencyKey: crypto.randomUUID(), measuredAt: new Date(), eye, valueMmhg: Number(value), quality: "good", source: "manual" }] });
  };

  return <div className="space-y-6">
    <section className="grid gap-5 lg:grid-cols-[1.4fr_.8fr]">
      <div className={`rounded-3xl border p-6 shadow-sm ${critical ? "border-rose-300 bg-rose-50" : "border-sky-200 bg-sky-50"}`} aria-labelledby="today-action-title">
        <div className="flex items-start justify-between gap-4"><div><p className="inline-flex items-center gap-2 text-sm font-bold text-slate-700"><BellRing className="h-4 w-4" />오늘의 우선 행동</p><h2 id="today-action-title" className="mt-3 text-2xl font-extrabold tracking-tight text-slate-950">{home.priorityAction.title}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-700">지금 필요한 행동 하나를 먼저 안내합니다. 처방 목표는 의료진만 변경할 수 있습니다.</p></div>{critical ? <AlertTriangle className="h-6 w-6 text-rose-700" /> : <CheckCircle2 className="h-6 w-6 text-sky-700" />}</div>
        <div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={() => setDialogOpen(true)} className="min-h-11 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-300"><span className="inline-flex items-center gap-2"><Gauge className="h-4 w-4" />{home.priorityAction.cta}</span></button><a href="#measurement-history" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-300">측정 이력 <ArrowRight className="h-4 w-4" /></a></div>
      </div>
      <aside className="rounded-3xl bg-slate-950 p-6 text-white" aria-labelledby="target-title"><p className="inline-flex items-center gap-2 text-sm font-bold text-sky-200"><ShieldCheck className="h-4 w-4" />처방 기준</p><h2 id="target-title" className="mt-3 text-xl font-extrabold">목표 안압 · 읽기 전용</h2><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-slate-300">OD · 우안</p><p className="mt-1 text-3xl font-extrabold">{home.target ? Number(home.target.targetOd).toFixed(1) : "–"}</p><p className="text-xs text-sky-200">mmHg</p></div><div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-slate-300">OS · 좌안</p><p className="mt-1 text-3xl font-extrabold">{home.target ? Number(home.target.targetOs).toFixed(1) : "–"}</p><p className="text-xs text-sky-200">mmHg</p></div></div></aside>
    </section>
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="오늘의 관리 현황"><Stat label="OD 최근 측정" value={latest("OD") ? `${Number(latest("OD")?.valueMmhg).toFixed(1)}` : "–"} description="mmHg · 우안" /><Stat label="OS 최근 측정" value={latest("OS") ? `${Number(latest("OS")?.valueMmhg).toFixed(1)}` : "–"} description="mmHg · 좌안" /><Stat label="오늘 점안" value={`${home.todayEvents.filter(item => item.taken).length}/${home.todayEvents.length}`} description="완료 / 예정" tone={unresolvedDose ? "rose" : "slate"} /><Stat label="연결 기기" value={`${devicesQuery.data?.length ?? 0}`} description="대여·개인 소유" tone="slate" /></section>
    <section id="measurement-history" className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-sky-700">측정 이력</p><h2 className="mt-1 text-xl font-extrabold">최근 안압 기록</h2></div><button type="button" onClick={() => setDialogOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 text-sm font-bold text-sky-800 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"><Plus className="h-4 w-4" />새 기록</button></div><div className="mt-5 divide-y divide-slate-100">{recordsQuery.data?.length ? recordsQuery.data.slice(0, 5).map(record => <div className="flex items-center justify-between py-3" key={record.id}><div><p className="font-bold text-slate-900">{record.eye} · {record.eye === "OD" ? "우안" : "좌안"}</p><p className="mt-1 text-xs text-slate-500">{new Date(record.measuredAt).toLocaleString("ko-KR")}</p></div><p className="text-xl font-extrabold">{Number(record.valueMmhg).toFixed(1)} <span className="text-xs text-slate-500">mmHg</span></p></div>) : <p className="py-10 text-center text-sm text-slate-500">아직 측정 기록이 없습니다.</p>}</div></div>
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm font-bold text-sky-700">점안 관리</p><h2 className="mt-1 text-xl font-extrabold">오늘의 점안 일정</h2><div className="mt-5 space-y-3">{home.todayEvents.length ? home.todayEvents.map(event => <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4" key={event.id}><div><p className="font-bold">{event.eye} · {event.scheduledTime}</p><p className="mt-1 text-xs text-slate-500">처방별 좌·우안 이벤트</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${event.taken ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{event.taken ? "완료" : "예정"}</span></div>) : <p className="py-10 text-center text-sm text-slate-500">처방이 등록되면 일정이 표시됩니다.</p>}</div></div>
    </section>
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent showCloseButton={false} className="max-w-md rounded-3xl"><form onSubmit={submit}><DialogHeader><DialogTitle>새 안압 기록</DialogTitle><DialogDescription>측정한 눈과 안압 값을 입력하면 멱등 키로 한 번만 저장합니다.</DialogDescription></DialogHeader><label className="mt-5 block text-sm font-bold text-slate-800">측정 눈<select value={eye} onChange={event => setEye(event.target.value as "OD" | "OS")} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 focus:outline-none focus:ring-4 focus:ring-sky-200"><option value="OD">OD · 우안</option><option value="OS">OS · 좌안</option></select></label><label className="mt-4 block text-sm font-bold text-slate-800">안압 (mmHg)<input type="number" min="1" max="80" step="0.1" value={value} onChange={event => setValue(event.target.value)} required className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 focus:outline-none focus:ring-4 focus:ring-sky-200" /></label><DialogFooter className="mt-6"><DialogClose asChild><button type="button" className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200">취소</button></DialogClose><button type="submit" disabled={upload.isPending} className="min-h-11 rounded-xl bg-sky-700 px-4 text-sm font-bold text-white hover:bg-sky-800 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200">{upload.isPending ? "저장 중…" : "저장"}</button></DialogFooter></form></DialogContent></Dialog>
  </div>;
}

function ClinicianDashboard({ role, actorId }: { role: "physician" | "admin"; actorId: number }) {
  const utils = trpc.useUtils();
  const queueQuery = trpc.clinical.dashboard.riskQueue.useQuery();
  const preferenceQuery = trpc.clinical.dashboard.preferences.get.useQuery();
  const membersQuery = trpc.members.list.useQuery(undefined, { enabled: role === "admin" });
  const [tier, setTier] = useState("all");
  const savePreference = trpc.clinical.dashboard.preferences.save.useMutation({ onSuccess: () => { void utils.clinical.dashboard.preferences.get.invalidate(); toast.success("표시 기준을 저장했습니다."); }, onError: error => toast.error(error.message) });
  const setRole = trpc.members.setRole.useMutation({ onSuccess: () => { void utils.members.list.invalidate(); toast.success("역할을 변경했습니다."); }, onError: error => toast.error(error.message) });
  const filtered = useMemo(() => (queueQuery.data ?? []).filter(item => tier === "all" || item.tier === tier), [queueQuery.data, tier]);
  if (queueQuery.isLoading) return <Loading />;
  if (queueQuery.isError) return <ErrorState message="위험 환자 큐를 다시 불러와 주세요." />;
  const immediate = queueQuery.data?.filter(item => item.tier === "즉시 조치").length ?? 0;
  const planned = queueQuery.data?.filter(item => item.tier === "오늘 예정").length ?? 0;
  const selectTier = (next: string) => { setTier(next); savePreference.mutate({ patientColumns: preferenceQuery.data?.patientColumns ?? ["patient", "risk", "latestIop", "target", "device"], patientFilters: { tier: next } }); };
  return <div className="space-y-6">
    <section className="rounded-3xl bg-slate-950 p-6 text-white"><div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><p className="text-sm font-bold text-sky-200">CLINICAL OPERATIONS</p><h2 className="mt-2 text-3xl font-extrabold tracking-tight">위험 환자 큐가 먼저입니다</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">환자 안전과 오늘의 의사결정을 기준으로 큐를 정렬합니다.</p></div><div className="grid grid-cols-2 gap-3"><Stat label="즉시 조치" value={`${immediate}`} description="우선 확인 필요" tone="rose" /><Stat label="오늘 예정" value={`${planned}`} description="당일 후속 조치" /></div></div></section>
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-bold text-sky-700">위험 환자 큐</p><h2 className="mt-1 text-xl font-extrabold">즉시 조치 · 오늘 예정 · 모니터링</h2></div><label className="text-sm font-bold text-slate-700">표시 기준<select value={tier} onChange={event => selectTier(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 sm:w-44 focus:outline-none focus:ring-4 focus:ring-sky-200"><option value="all">전체</option><option value="즉시 조치">즉시 조치</option><option value="오늘 예정">오늘 예정</option><option value="모니터링">모니터링</option></select></label></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[650px] text-left"><caption className="sr-only">위험 환자 우선순위 목록</caption><thead><tr className="border-y border-slate-200 text-xs font-bold text-slate-500"><th className="p-3">우선순위</th><th className="p-3">환자</th><th className="p-3">사유</th><th className="p-3">최근 안압</th><th className="p-3">처방 목표</th></tr></thead><tbody>{filtered.length ? filtered.map(item => <tr key={item.patientId} className="border-b border-slate-100 text-sm"><td className="p-3"><span className={`rounded-full px-3 py-1 text-xs font-bold ${item.tier === "즉시 조치" ? "bg-rose-100 text-rose-800" : item.tier === "오늘 예정" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>{item.tier}</span></td><td className="p-3 font-bold">{item.publicId}</td><td className="p-3">{item.reason}</td><td className="p-3">{item.latestMeasurement ? `${item.latestMeasurement.eye} ${Number(item.latestMeasurement.valueMmhg).toFixed(1)}` : "–"}</td><td className="p-3">{item.target ? `OD ${Number(item.target.targetOd).toFixed(1)} / OS ${Number(item.target.targetOs).toFixed(1)}` : "미설정"}</td></tr>) : <tr><td colSpan={5} className="p-10 text-center text-sm text-slate-500">현재 표시 조건에 해당하는 환자가 없습니다.</td></tr>}</tbody></table></div><p className="mt-4 text-xs text-slate-500">열 선택 및 필터는 사용자별 서버 설정에 저장됩니다. 현재 열: {preferenceQuery.data?.patientColumns?.join(", ") ?? "기본값"}</p></section>
    {role === "admin" && <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-100 text-sky-800"><Users className="h-5 w-5" /></div><div><p className="text-sm font-bold text-sky-700">관리자 권한</p><h2 className="text-xl font-extrabold">기관 사용자 역할 관리</h2></div></div><div className="mt-5 divide-y divide-slate-100">{membersQuery.data?.map(member => <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between" key={member.id}><div><p className="font-bold">{member.name || "이름 미설정"}</p><p className="mt-1 text-xs text-slate-500">{member.email || member.openId}</p></div><select aria-label={`${member.name || "사용자"} 역할`} value={member.role} disabled={member.id === actorId} onChange={event => setRole.mutate({ userId: member.id, role: event.target.value as Role })} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-4 focus:ring-sky-200"><option value="patient">patient</option><option value="physician">physician</option><option value="educator">educator</option><option value="admin">admin</option></select></div>) ?? <p className="py-6 text-sm text-slate-500">사용자 목록을 불러오는 중입니다.</p>}</div></section>}
  </div>;
}

function EducatorDashboard() { return <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]"><section className="rounded-3xl bg-slate-950 p-7 text-white"><p className="text-sm font-bold text-sky-200">EDUCATION WORKSPACE</p><h2 className="mt-3 text-3xl font-extrabold tracking-tight">이해와 순응을 돕는<br />교육 운영 공간</h2><p className="mt-4 text-sm leading-6 text-slate-300">educator 역할은 교육 콘텐츠를 관리합니다. 개별 진료 기록과 처방 목표 변경은 서버 권한으로 차단됩니다.</p><p className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-bold"><ShieldCheck className="h-4 w-4 text-sky-200" />서버 권한 분리 적용</p></section><section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm"><BookOpenCheck className="h-8 w-8 text-sky-700" /><h2 className="mt-5 text-xl font-extrabold">교육 콘텐츠 관리</h2><p className="mt-2 text-sm leading-6 text-slate-600">점안 방법, 기기 반납 절차, 측정 품질 안내를 역할에 맞춰 제공할 수 있습니다.</p></section></div>; }

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const bootstrap = trpc.auth.bootstrap.useMutation();
  const [bootstrapped, setBootstrapped] = useState(false);
  useEffect(() => { if (isAuthenticated && user && !bootstrapped && !bootstrap.isPending) bootstrap.mutate(undefined, { onSuccess: () => setBootstrapped(true) }); }, [isAuthenticated, user, bootstrapped, bootstrap.isPending, bootstrap.mutate]);
  if (loading) return <div className="grid min-h-screen place-items-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-sky-700" aria-label="로그인 상태 확인 중" /></div>;
  if (!isAuthenticated || !user) return <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#e0f2fe_0,_#f8fafc_42%,_#eff6ff_100%)] px-5 py-6 sm:px-10"><div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl flex-col justify-between"><header className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-700 text-white"><Eye className="h-6 w-6" /></div><div><p className="text-lg font-extrabold">안압케어</p><p className="text-xs text-slate-500">안압 관리 의료 플랫폼</p></div></header><section className="grid gap-10 py-16 lg:grid-cols-[1.15fr_.85fr] lg:items-center"><div><p className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-3 py-1.5 text-xs font-bold text-sky-800"><ShieldCheck className="h-3.5 w-3.5" />Manus OAuth · 역할 기반 접근</p><h1 className="mt-6 text-4xl font-black tracking-[-.04em] text-slate-950 sm:text-6xl">환자 관리의<br /><span className="text-sky-700">신뢰 기반</span>을 만듭니다.</h1><p className="mt-6 max-w-xl text-base leading-7 text-slate-600">patient, physician, educator, admin이 각자의 역할에 맞춰 안압·점안·기기·알림 업무를 안전하게 관리합니다.</p><button type="button" onClick={() => startLogin()} className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-slate-950 px-6 text-sm font-extrabold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-300">Manus OAuth로 시작하기 <ArrowRight className="h-4 w-4" /></button></div><div className="grid gap-4"><Stat label="환자 홈" value="1개" description="오늘의 우선 행동" /><Stat label="의료진 업무" value="3단계" description="즉시 조치 · 오늘 예정 · 모니터링" tone="rose" /><Stat label="보안 기준" value="RBAC" description="서버 측 역할 권한 검사" tone="slate" /></div></section><footer className="border-t border-slate-200 py-6 text-xs text-slate-500">의료 데이터는 역할별 서버 권한 검사와 감사 로그 해시 체인 기준으로 처리됩니다.</footer></div></main>;
  const role = user.role as Role;
  const RoleIcon = roleIcons[role] ?? ShieldCheck;
  return <div className="min-h-screen bg-slate-50"><header className="border-b border-slate-200 bg-white/90"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-sky-700 text-white"><Eye className="h-5 w-5" /></div><div><p className="font-extrabold">안압케어</p><p className="text-xs text-slate-500">안압 관리 의료 플랫폼</p></div></div><div className="flex items-center gap-3"><p className="hidden items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 sm:flex"><RoleIcon className="h-3.5 w-3.5 text-sky-700" />{roleNames[role]}</p><button type="button" onClick={logout} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">로그아웃</span></button></div></div></header><main className="mx-auto max-w-7xl px-5 py-8 sm:px-8"><p className="text-sm font-bold text-sky-700">{roleNames[role]}</p><h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-950">{role === "patient" ? `${user.name || "환자"}님의 오늘 관리` : role === "physician" ? "진료 운영 대시보드" : role === "educator" ? "교육 운영 공간" : "기관 운영 대시보드"}</h1><div className="mt-7">{bootstrap.isError ? <ErrorState message="서비스 작업 공간을 초기화하지 못했습니다." /> : role === "patient" ? <PatientDashboard /> : role === "physician" || role === "admin" ? <ClinicianDashboard role={role} actorId={user.id} /> : <EducatorDashboard />}</div></main></div>;
}
