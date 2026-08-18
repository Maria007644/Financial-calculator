import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import html2canvas from "html2canvas";
import {
  Home,
  CalendarDays,
  Target,
  WalletCards,
  ChartNoAxesColumnIncreasing,
  Plus,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Download,
  Upload,
  Trash2,
  X,
  CheckCircle2,
  TrendingUp,
  Sun,
  BookOpen,
  Users,
  User,
  BadgeRussianRuble,
} from "lucide-react";
import type {
  AppState,
  Expense,
  Lesson,
  LessonType,
  PricingMode,
} from "./types";
import {
  calculateExpensesForMonth,
  calculateGoalProgress,
  calculateLessonRevenue,
  calculateRequiredLessonsForGoal,
  calculateRevenueForMonth,
  defaultState,
  generateLessonOccurrences,
  iso,
  loadState,
  money,
  revenueBetween,
  saveState,
  startOfWeek,
  STORAGE_KEY,
} from "./lib";
type Page = "home" | "schedule" | "goal" | "expenses" | "pricing" | "analytics";
const labels: Record<LessonType, string> = {
  individual: "Индивидуальное",
  pair: "Парное",
  group: "Групповое",
};
const nav = [
  ["home", "Главная", Home],
  ["schedule", "Расписание", CalendarDays],
  ["goal", "Цель", Target],
  ["expenses", "Расходы", WalletCards],
  ["pricing", "Цены", BadgeRussianRuble],
  ["analytics", "Аналитика", ChartNoAxesColumnIncreasing],
] as const;
const months = [
  "Янв",
  "Фев",
  "Мар",
  "Апр",
  "Май",
  "Июн",
  "Июл",
  "Авг",
  "Сен",
  "Окт",
  "Ноя",
  "Дек",
];
const expenseColors = [
  "#70ad87",
  "#e5bc50",
  "#e89c7c",
  "#7faed9",
  "#a88bc2",
  "#d87b83",
  "#82b8ac",
  "#d49a53",
];
const monthlyExpenseAmount = (expense: Expense, date: Date) => {
  if (!expense.enabled) return 0;
  if (expense.frequency === "annual") return expense.amount / 12;
  if (expense.frequency === "monthly") return expense.amount;
  return expense.date?.slice(0, 7) === iso(date).slice(0, 7)
    ? expense.amount
    : 0;
};
function expenseGradient(items: Expense[], date: Date) {
  const values = items.map((item) => monthlyExpenseAmount(item, date));
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!total) return "#e6e3dc";
  let cursor = 0;
  return `conic-gradient(${values
    .map((value, index) => {
      const start = cursor;
      cursor += (value / total) * 100;
      return `${expenseColors[index % expenseColors.length]} ${start}% ${cursor}%`;
    })
    .join(",")})`;
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", f);
    return () => document.removeEventListener("keydown", f);
  }, [onClose]);
  return (
    <div
      className="backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <button className="icon close" onClick={onClose} aria-label="Закрыть">
          <X />
        </button>
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  );
}
function Onboarding({
  state,
  setState,
}: {
  state: AppState;
  setState: (s: AppState) => void;
}) {
  const [name, setName] = useState(state.profile.name);
  const [gender, setGender] = useState<"female" | "male">(state.profile.gender);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (clean)
      setState({ ...state, onboarded: true, profile: { name: clean, gender } });
  };
  return (
    <div className="onboard welcome">
      <div className="onboard-art">
        <img src="/Assets/hero_tree.png" />
        <div>
          <span className="eyebrow">TutorGarden</span>
          <h1>
            Ваши финансы.
            <br />
            Ваш ритм роста.
          </h1>
          <p>
            Для начала давайте познакомимся. Остальное можно настроить уже в
            планере.
          </p>
        </div>
      </div>
      <form className="setup welcome-form" onSubmit={submit}>
        <span className="eyebrow">Добро пожаловать</span>
        <h2>Как вас зовут?</h2>
        <p>Имя будет отображаться в вашем профиле.</p>
        <Field label="Ваше имя">
          <input
            autoFocus
            required
            maxLength={40}
            placeholder="Например, Анна"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <div
          className="avatar-choice"
          role="group"
          aria-label="Выберите аватар"
        >
          <button
            type="button"
            className={gender === "female" ? "selected" : ""}
            onClick={() => setGender("female")}
          >
            <img src="/Assets/avatar_female.png" />
            <span>Женский</span>
          </button>
          <button
            type="button"
            className={gender === "male" ? "selected" : ""}
            onClick={() => setGender("male")}
          >
            <img src="/Assets/avatar_male.png" />
            <span>Мужской</span>
          </button>
        </div>
        <button className="btn primary full" disabled={!name.trim()}>
          Перейти в планер <ChevronRight />
        </button>
      </form>
    </div>
  );
}
export function App() {
  const [state, setStateRaw] = useState(loadState);
  const [page, setPage] = useState<Page>("home");
  const [month, setMonth] = useState(new Date());
  const [weekCursor, setWeekCursor] = useState(() => startOfWeek(new Date()));
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [modal, setModal] = useState<
    "lesson" | "expense" | "goal" | "pricing" | "profile" | null
  >(null);
  const [tick, setTick] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const setState = (s: AppState) => setStateRaw(s);
  const openExpenseModal = (id: string | null = null) => {
    setEditingExpenseId(id);
    setModal("expense");
  };
  useEffect(() => {
    const id = setTimeout(() => saveState(state), 250);
    return () => clearTimeout(id);
  }, [state]);
  function ProfileModal() {
    const [name, setName] = useState(state.profile.name);
    const [gender, setGender] = useState(state.profile.gender);
    return (
      <Modal title="Профиль" onClose={() => setModal(null)}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const clean = name.trim();
            if (!clean) return;
            setState({ ...state, profile: { name: clean, gender } });
            setModal(null);
          }}
        >
          <Field label="Ваше имя">
            <input
              autoFocus
              required
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <div className="avatar-choice compact-choice">
            <button
              type="button"
              className={gender === "female" ? "selected" : ""}
              onClick={() => setGender("female")}
            >
              <img src="/Assets/avatar_female.png" />
              <span>Женский</span>
            </button>
            <button
              type="button"
              className={gender === "male" ? "selected" : ""}
              onClick={() => setGender("male")}
            >
              <img src="/Assets/avatar_male.png" />
              <span>Мужской</span>
            </button>
          </div>
          <button className="btn primary full">Сохранить профиль</button>
        </form>
      </Modal>
    );
  }
  if (!state.onboarded) return <Onboarding state={state} setState={setState} />;
  const monthIncome = calculateRevenueForMonth(state, month),
    expenses = calculateExpensesForMonth(state, month),
    net = monthIncome - expenses,
    goalValue = state.goalMode === "net" ? net : monthIncome,
    progress = calculateGoalProgress(goalValue, state.goal.targetAmount),
    gap = state.goal.targetAmount - goalValue;
  const today = new Date(),
    weekStart = startOfWeek(today),
    weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const todayIncome = revenueBetween(state, today, today),
    weekIncome = revenueBetween(state, weekStart, weekEnd);
  const changeMonth = (n: number) =>
    setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const exportData = () => {
    const blob = new Blob(
        [
          JSON.stringify(
            {
              app: "tutor-finance-calculator",
              exportVersion: 1,
              exportedAt: new Date().toISOString(),
              data: state,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tutor-finance-backup-${iso(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const capturePlanner = async () => {
    const target = document.querySelector("main") as HTMLElement | null;
    if (!target) throw new Error("Не удалось найти область для экспорта");
    return html2canvas(target, {
      backgroundColor: "#f7f5ed",
      scale: Math.min(window.devicePixelRatio || 1, 2),
      useCORS: true,
      logging: false,
    });
  };
  const exportPng = async () => {
    try {
      const canvas = await capturePlanner();
      const link = document.createElement("a");
      link.download = `tutor-garden-${iso(new Date())}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      alert(
        "Не удалось создать PNG. Попробуйте открыть приложение через локальный сервер.",
      );
    }
  };
  const exportPdf = () => {
    document.body.classList.add("print-planner");
    window.print();
    setTimeout(() => document.body.classList.remove("print-planner"), 500);
  };
  const importData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const x = JSON.parse(await f.text());
      if (
        x.app !== "tutor-finance-calculator" ||
        x.exportVersion !== 1 ||
        x.data?.schemaVersion !== 1
      )
        throw 0;
      if (confirm("Текущие данные будут заменены. Продолжить?"))
        setState(x.data);
    } catch {
      alert("Не удалось прочитать резервную копию. Проверьте файл.");
    }
    e.target.value = "";
  };
  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <img src="/Assets/decor_small_plant.png" alt="" />
          <div>
            <b>TutorGarden</b>
            <small>финансы роста</small>
          </div>
        </div>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => setPage(id)}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <img className="side-garden" src="/Assets/sidebar_garden.png" />
        <p className="motto">
          Маленькие шаги сегодня — большой результат завтра
        </p>
      </aside>
      <main>
        <header>
          <div>
            <h1>{nav.find((n) => n[0] === page)?.[1]}</h1>
            <p>Ваше время. Ваши ученики. Ваш рост.</p>
          </div>
          <button
            className="profile"
            onClick={() => setModal("profile")}
            aria-label="Изменить профиль"
          >
            <img src={`/Assets/avatar_${state.profile.gender}.png`} />
            <span>
              <b>{state.profile.name || "Мой профиль"}</b>
              <small>частный репетитор · изменить</small>
            </span>
            <Pencil />
          </button>
        </header>
        {page === "home" && <Dashboard />}
        {page === "schedule" && <Schedule />}
        {page === "goal" && <GoalPage />}
        {page === "expenses" && <Expenses />}
        {page === "pricing" && <PricingPage />}
        {page === "analytics" && <Analytics />}
      </main>
      <div className="mobile-nav">
        {nav.map(([id, label, Icon]) => (
          <button
            key={id}
            className={page === id ? "active" : ""}
            onClick={() => setPage(id)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </div>
      {modal === "lesson" && <LessonModal />}
      {modal === "expense" && <ExpenseModal />}
      {modal === "goal" && <GoalModal />}
      {modal === "pricing" && <PricingModal />}
      {modal === "profile" && <ProfileModal />}
      <input
        hidden
        ref={fileRef}
        type="file"
        accept="application/json"
        onChange={importData}
      />
    </div>
  );
  function MonthSwitch() {
    return (
      <div className="month-switch">
        <button
          className="icon"
          onClick={() => changeMonth(-1)}
          aria-label="Предыдущий месяц"
        >
          <ChevronLeft />
        </button>
        <b>
          {month.toLocaleDateString("ru-RU", {
            month: "long",
            year: "numeric",
          })}
        </b>
        <button
          className="icon"
          onClick={() => changeMonth(1)}
          aria-label="Следующий месяц"
        >
          <ChevronRight />
        </button>
      </div>
    );
  }
  function Dashboard() {
    return (
      <>
        <section className="hero">
          <div className="hero-copy">
            <span className="section-label">
              <Target /> Финансовая цель
            </span>
            <div className="goal-number">
              {money(goalValue, state.currency)}{" "}
              <small>/ {money(state.goal.targetAmount, state.currency)}</small>
            </div>
            <div className="progress">
              <i style={{ width: `${Math.min(progress * 100, 100)}%` }} />
            </div>
            <div className="progress-line">
              <span>
                {progress >= 1
                  ? `Цель выполнена на ${Math.round(progress * 100)}%`
                  : `До цели осталось ${money(gap, state.currency)}`}
              </span>
              <b>{Math.round(progress * 100)}%</b>
            </div>
            <div className="hero-actions">
              <button className="btn primary" onClick={() => setModal("goal")}>
                <Pencil /> Изменить цель
              </button>
              <button className="btn ghost" onClick={() => setPage("goal")}>
                Подробнее о цели
              </button>
            </div>
          </div>
          <div className="hero-art">
            <img className="tree" src="/Assets/hero_tree.png" />
            <img className="books" src="/Assets/hero_books.png" />
            <img className="can" src="/Assets/hero_watering_can.png" />
            <img className="coins" src="/Assets/hero_coin_stack.png" />
            <img className="flowers" src="/Assets/hero_flower_pot.png" />
          </div>
        </section>
        <div className="kpis">
          <Stat
            icon={<Sun />}
            label="Сегодня"
            value={todayIncome}
            sub={`${generateLessonOccurrencesCount(today, today)} занятия`}
          />
          <Stat
            icon={<CalendarDays />}
            label="Эта неделя"
            value={weekIncome}
            sub={`${generateLessonOccurrencesCount(weekStart, weekEnd)} занятий`}
          />
          <Stat
            icon={<TrendingUp />}
            label="Этот месяц"
            value={monthIncome}
            sub="календарный прогноз"
          />
          <Stat
            icon={<WalletCards />}
            label="После расходов"
            value={net}
            sub={`${money(expenses, state.currency)} расходов`}
          />
        </div>
        <div className="dashboard-grid">
          <section className="card schedule-card">
            <div className="card-head">
              <div>
                <span className="section-label">
                  <CalendarDays /> Ближайшие занятия
                </span>
              </div>
              <button
                className="btn compact"
                onClick={() => setModal("lesson")}
              >
                Добавить <Plus />
              </button>
            </div>
            <WeekPreview />
          </section>
          <section className="card expense-summary">
            <div className="card-head">
              <span className="section-label">Расходы месяца</span>
              <button
                className="btn compact"
                onClick={() => openExpenseModal()}
              >
                Добавить
              </button>
            </div>
            <div
              className="donut"
              style={{ background: expenseGradient(state.expenses, month) }}
            >
              <span>
                {money(expenses, state.currency)}
                <small>из выручки</small>
              </span>
            </div>
            {state.expenses.map((e, index) => (
              <div className="legend" key={e.id}>
                <i
                  style={{
                    background: expenseColors[index % expenseColors.length],
                  }}
                />
                <span>{e.title}</span>
                <b>{money(monthlyExpenseAmount(e, month), state.currency)}</b>
              </div>
            ))}
          </section>
          <section className="card milestone">
            <div>
              <span className="section-label">Мой рост</span>
              <h3>
                {gap > 0
                  ? `Осталось ${money(gap, state.currency)}`
                  : `На ${money(-gap, state.currency)} выше цели`}
              </h3>
              <p>
                {gap > 0
                  ? `Это примерно ${calculateRequiredLessonsForGoal(gap, state.pricing.individual.amount)} индивидуальных занятий.`
                  : "Отличный запас — можно направить его на развитие."}
              </p>
            </div>
            <img
              src={`/Assets/goal_stage_${progress >= 1 ? "100" : progress >= 0.75 ? "75" : progress >= 0.5 ? "50" : "25"}.png`}
            />
          </section>
          <section className="card insight">
            <img src="/Assets/decor_flower_branch.png" alt="" />
            <div>
              <b>
                {progress >= 1
                  ? "Цель уже достигнута!"
                  : progress >= 0.8
                    ? "Вы почти у цели"
                    : "План становится яснее"}
              </b>
              <p>
                {progress >= 1
                  ? "Ваше расписание создаёт хороший запас."
                  : `Добавление одного регулярного урока сразу обновит прогноз.`}
              </p>
            </div>
          </section>
        </div>
      </>
    );
  }
  function generateLessonOccurrencesCount(a: Date, b: Date) {
    return state.lessons.reduce(
      (n, l) => n + generateLessonOccurrences(l, a, b).length,
      0,
    );
  }
  function Stat({
    icon,
    label,
    value,
    sub,
  }: {
    icon: React.ReactNode;
    label: string;
    value: number;
    sub: string;
  }) {
    return (
      <button
        className="stat"
        onClick={() =>
          label.includes("расход") ? setPage("expenses") : setPage("schedule")
        }
      >
        <span className="stat-icon">{icon}</span>
        <div>
          <small>{label}</small>
          <b>{money(value, state.currency)}</b>
          <em>{sub}</em>
        </div>
      </button>
    );
  }
  function WeekPreview() {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekCursor);
      d.setDate(d.getDate() + i);
      return d;
    });
    const move = (n: number) =>
      setWeekCursor((d) => {
        const x = new Date(d);
        x.setDate(x.getDate() + n * 7);
        return x;
      });
    return (
      <div className="week-block">
        <div className="week-nav">
          <button
            className="icon"
            onClick={() => move(-1)}
            aria-label="Предыдущая неделя"
          >
            <ChevronLeft />
          </button>
          <b>
            {days[0].toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "short",
            })}{" "}
            —{" "}
            {days[6].toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </b>
          <button
            className="icon"
            onClick={() => move(1)}
            aria-label="Следующая неделя"
          >
            <ChevronRight />
          </button>
        </div>
        <div className="week-preview">
          {days.map((d) => (
            <div
              className={`day ${iso(d) === iso(new Date()) ? "today" : ""}`}
              key={iso(d)}
            >
              <div>
                <b>{d.toLocaleDateString("ru-RU", { weekday: "short" })}</b>
                <small>{d.getDate()}</small>
              </div>
              {state.lessons
                .filter((l) => generateLessonOccurrences(l, d, d).length)
                .map((l) => (
                  <div key={l.id} className={`lesson ${l.type}`}>
                    <button
                      className="lesson-main"
                      onClick={() => setPage("schedule")}
                    >
                      <b>{l.time}</b>
                      <span>{l.title}</span>
                      <small>
                        {money(
                          calculateLessonRevenue(l, state.pricing),
                          state.currency,
                        )}
                      </small>
                    </button>
                    <button
                      className="lesson-cancel"
                      onClick={() => {
                        if (
                          !confirm(
                            `Отменить занятие «${l.title}» ${d.toLocaleDateString("ru-RU")} в ${l.time}?`,
                          )
                        )
                          return;
                        setState({
                          ...state,
                          lessons: state.lessons.map((item) =>
                            item.id === l.id
                              ? {
                                  ...item,
                                  excludedDates: [
                                    ...new Set([...item.excludedDates, iso(d)]),
                                  ],
                                }
                              : item,
                          ),
                        });
                      }}
                    >
                      Отменить
                    </button>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>
    );
  }
  function Schedule() {
    return (
      <section className="page-card">
        <div className="page-toolbar">
          <MonthSwitch />
          <button className="btn primary" onClick={() => setModal("lesson")}>
            <Plus /> Добавить занятие
          </button>
        </div>
        <WeekPreview />
        <div className="lesson-list">
          <h2>Регулярное расписание</h2>
          {state.lessons.length === 0 ? (
            <Empty text="Добавьте занятие — и здесь появится ваш финансовый ритм." />
          ) : (
            state.lessons.map((l) => (
              <article key={l.id}>
                <div className={`type-dot ${l.type}`}>
                  {l.type === "individual" ? <User /> : <Users />}
                </div>
                <div>
                  <b>{l.title}</b>
                  <small>
                    {["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"][l.weekday]} ·{" "}
                    {l.time} · {labels[l.type]} · каждую неделю
                  </small>
                </div>
                <strong>
                  {money(
                    calculateLessonRevenue(l, state.pricing),
                    state.currency,
                  )}
                </strong>
                <button
                  className="icon danger"
                  aria-label="Удалить"
                  onClick={() =>
                    confirm("Удалить всю серию занятий?") &&
                    setState({
                      ...state,
                      lessons: state.lessons.filter((x) => x.id !== l.id),
                    })
                  }
                >
                  <Trash2 />
                </button>
              </article>
            ))
          )}
        </div>
      </section>
    );
  }
  function GoalPage() {
    return (
      <section className="page-card goal-page">
        <img
          src="/Assets/goal_round_sign.png"
          onError={(e) => {
            e.currentTarget.src = "/Assets/hero_round_sign.png";
          }}
        />
        <span className="eyebrow">Моя цель</span>
        <h2>{state.goal.title}</h2>
        <div className="huge">
          {money(state.goal.targetAmount, state.currency)}
        </div>
        <div className="progress large">
          <i style={{ width: `${Math.min(progress * 100, 100)}%` }} />
        </div>
        <div className="goal-stats">
          <div>
            <small>Прогноз</small>
            <b>{money(monthIncome, state.currency)}</b>
          </div>
          <div>
            <small>Чистый доход</small>
            <b>{money(net, state.currency)}</b>
          </div>
          <div>
            <small>Выполнение</small>
            <b>{Math.round(progress * 100)}%</b>
          </div>
        </div>
        <label className="switch-line">
          Считать цель по{" "}
          <select
            value={state.goalMode}
            onChange={(e) =>
              setState({
                ...state,
                goalMode: e.target.value as "net" | "gross",
              })
            }
          >
            <option value="net">чистому доходу</option>
            <option value="gross">выручке</option>
          </select>
        </label>
        <button className="btn primary" onClick={() => setModal("goal")}>
          <Pencil /> Изменить цель
        </button>
      </section>
    );
  }
  function Expenses() {
    return (
      <section className="page-card">
        <div className="page-toolbar">
          <div>
            <h2>Рабочие расходы</h2>
            <p>Годовые суммы равномерно распределяются на 12 месяцев.</p>
          </div>
          <button className="btn primary" onClick={() => openExpenseModal()}>
            <Plus /> Добавить расход
          </button>
        </div>
        <div className="expense-total">
          <small>Нагрузка за выбранный месяц</small>
          <b>{money(expenses, state.currency)}</b>
          <MonthSwitch />
        </div>
        {state.expenses.length === 0 ? (
          <Empty text="Добавьте сервисы, обучение или другие рабочие расходы." />
        ) : (
          <div className="expense-list">
            {state.expenses.map((e, index) => (
              <article key={e.id}>
                <span
                  className="expense-color"
                  style={{
                    background: expenseColors[index % expenseColors.length],
                  }}
                />
                <div>
                  <b>{e.title}</b>
                  <small>
                    {e.category} ·{" "}
                    {e.frequency === "annual"
                      ? `${money(e.amount, state.currency)} в год ≈ ${money(e.amount / 12, state.currency)} в месяц`
                      : e.frequency === "monthly"
                        ? "ежемесячно"
                        : "разово"}
                  </small>
                </div>
                <strong>{money(e.amount, state.currency)}</strong>
                <button
                  className="icon"
                  onClick={() => openExpenseModal(e.id)}
                  aria-label="Редактировать расход"
                >
                  <Pencil />
                </button>
                <button
                  className="icon danger"
                  onClick={() =>
                    setState({
                      ...state,
                      expenses: state.expenses.filter((x) => x.id !== e.id),
                    })
                  }
                  aria-label="Удалить"
                >
                  <Trash2 />
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    );
  }
  function Analytics() {
    const data = useMemo(
      () =>
        Array.from({ length: 12 }, (_, i) =>
          calculateRevenueForMonth(state, new Date(month.getFullYear(), i, 1)),
        ),
      [state, tick],
    );
    const max = Math.max(...data, 1);
    return (
      <section className="page-card">
        <div className="page-toolbar">
          <div>
            <h2>Доход по месяцам</h2>
            <p>Прогноз строится по реальным датам календаря.</p>
          </div>
          <b>{month.getFullYear()} год</b>
        </div>
        <div className="chart">
          {data.map((v, i) => (
            <div key={i} className={i === month.getMonth() ? "current" : ""}>
              <span
                title={money(v, state.currency)}
                style={{ height: `${(v / max) * 100}%` }}
              />
              <small>{months[i]}</small>
            </div>
          ))}
        </div>
        <div className="analytics-grid">
          <div>
            <small>Средний доход с урока</small>
            <b>
              {money(
                state.lessons.length
                  ? state.lessons.reduce(
                      (a, l) => a + calculateLessonRevenue(l, state.pricing),
                      0,
                    ) / state.lessons.length
                  : 0,
                state.currency,
              )}
            </b>
          </div>
          {(["individual", "pair", "group"] as LessonType[]).map((t) => (
            <div key={t}>
              <small>{labels[t]}</small>
              <b>
                {money(
                  state.lessons
                    .filter((l) => l.type === t)
                    .reduce(
                      (a, l) =>
                        a +
                        calculateLessonRevenue(l, state.pricing) *
                          generateLessonOccurrences(
                            l,
                            new Date(month.getFullYear(), month.getMonth(), 1),
                            new Date(
                              month.getFullYear(),
                              month.getMonth() + 1,
                              0,
                            ),
                          ).length,
                      0,
                    ),
                  state.currency,
                )}
              </b>
            </div>
          ))}
        </div>
      </section>
    );
  }
  function PricingPage() {
    const [draft, setDraft] = useState(state.pricing);
    const commitPricing = (next = draft) =>
      setState({ ...state, pricing: next });
    const pricingMeta: Record<LessonType, { image: string; text: string }> = {
      individual: {
        image: "/Assets/decor_small_plant.png",
        text: "Одно занятие с одним учеником",
      },
      pair: {
        image: "/Assets/decor_flower_branch.png",
        text: "Занятие для двух учеников",
      },
      group: {
        image: "/Assets/hero_flower_pot.png",
        text: "Занятие для группы",
      },
    };
    return (
      <section className="page-card pricing-page">
        <div className="page-toolbar">
          <div>
            <h2>Стоимость занятий</h2>
            <p>
              Укажите базовые цены. Изменения сразу применяются к прогнозу
              дохода.
            </p>
          </div>
        </div>
        <div className="price-editor-grid">
          {(["individual", "pair", "group"] as LessonType[]).map((type) => (
            <article className={`price-editor ${type}`} key={type}>
              <div className="price-editor-head">
                <span>
                  <img src={pricingMeta[type].image} alt="" />
                </span>
                <div>
                  <h3>{labels[type]}</h3>
                  <p>{pricingMeta[type].text}</p>
                </div>
              </div>
              <Field label="Стоимость">
                <div className="money-input">
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={draft[type].amount}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        [type]: {
                          ...draft[type],
                          amount: Math.max(0, Number(e.target.value)),
                        },
                      })
                    }
                    onBlur={() => commitPricing()}
                    onKeyDown={(e) =>
                      e.key === "Enter" && e.currentTarget.blur()
                    }
                  />
                  <span>{state.currency === "RUB" ? "₽" : state.currency}</span>
                </div>
              </Field>
              {type !== "individual" && (
                <Field label="Как считать">
                  <select
                    value={draft[type].mode}
                    onChange={(e) => {
                      const next = {
                        ...draft,
                        [type]: {
                          ...draft[type],
                          mode: e.target.value as PricingMode,
                        },
                      };
                      setDraft(next);
                      commitPricing(next);
                    }}
                  >
                    <option value="perStudent">За каждого ученика</option>
                    <option value="perLesson">За всё занятие</option>
                  </select>
                </Field>
              )}
              <div className="price-preview">
                <small>Доход с занятия</small>
                <b>
                  {money(
                    calculateLessonRevenue(
                      {
                        type,
                        studentCount:
                          type === "individual" ? 1 : type === "pair" ? 2 : 4,
                        status: "planned",
                      } as Lesson,
                      draft,
                    ),
                    state.currency,
                  )}
                </b>
              </div>
            </article>
          ))}
        </div>
        <p className="save-note">
          <CheckCircle2 /> Все изменения сохраняются автоматически
        </p>
      </section>
    );
  }
  function SettingsPage() {
    return (
      <section className="page-card settings-page">
        <h2>Скачать отчёт</h2>
        <p>
          Сохраните текущий экран планера как изображение или многостраничный
          документ.
        </p>
        <div className="data-actions export-actions">
          <button className="btn primary" onClick={exportPng}>
            <Download /> Скачать PNG
          </button>
          <button className="btn primary" onClick={exportPdf}>
            <Download /> Скачать PDF
          </button>
        </div>
        <h2>Данные</h2>
        <p>
          Ваши данные хранятся только в этом браузере и не отправляются на
          сервер. Не храните здесь секретную информацию.
        </p>
        <div className="data-actions">
          <button className="btn" onClick={exportData}>
            <Download /> Резервная копия JSON
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <Upload /> Восстановить из файла
          </button>
          <button
            className="btn danger-btn"
            onClick={() => {
              if (
                confirm(
                  "Все данные будут удалены без возможности восстановления. Продолжить?",
                )
              ) {
                localStorage.removeItem(STORAGE_KEY);
                setState(defaultState());
              }
            }}
          >
            <Trash2 /> Очистить все данные
          </button>
        </div>
        <Field label="Валюта">
          <select
            value={state.currency}
            onChange={(e) =>
              setState({
                ...state,
                currency: e.target.value as AppState["currency"],
              })
            }
          >
            <option>RUB</option>
            <option>EUR</option>
            <option>USD</option>
            <option>CHF</option>
          </select>
        </Field>
      </section>
    );
  }
  function Empty({ text }: { text: string }) {
    return (
      <div className="empty">
        <BookOpen />
        <b>Здесь пока тихо</b>
        <p>{text}</p>
      </div>
    );
  }
  function LessonModal() {
    const [l, setL] = useState({
      title: "",
      weekday: 1,
      time: "16:00",
      type: "individual" as LessonType,
      studentCount: 1,
      duration: 60,
      startDate: iso(new Date()),
      recurrence: "weekly" as Lesson["recurrence"],
      customPrice: "",
    });
    const revenue = calculateLessonRevenue(
      {
        ...l,
        id: "",
        excludedDates: [],
        status: "planned",
        customPrice: l.customPrice ? +l.customPrice : undefined,
      } as Lesson,
      state.pricing,
    );
    const submit = (e: FormEvent) => {
      e.preventDefault();
      if (!l.title || l.studentCount < 1) return;
      setState({
        ...state,
        lessons: [
          ...state.lessons,
          {
            ...l,
            id: crypto.randomUUID(),
            customPrice: l.customPrice ? +l.customPrice : undefined,
            excludedDates: [],
            status: "planned",
          } as Lesson,
        ],
      });
      setModal(null);
      setTick((x) => x + 1);
    };
    return (
      <Modal title="Новое занятие" onClose={() => setModal(null)}>
        <form onSubmit={submit}>
          <Field label="Ученик или группа">
            <input
              required
              value={l.title}
              onChange={(e) => setL({ ...l, title: e.target.value })}
            />
          </Field>
          <div className="form-grid">
            <Field label="День недели">
              <select
                value={l.weekday}
                onChange={(e) => setL({ ...l, weekday: +e.target.value })}
              >
                {["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"].map((x, i) => (
                  <option value={i} key={x}>
                    {x}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Время">
              <input
                type="time"
                required
                value={l.time}
                onChange={(e) => setL({ ...l, time: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Формат">
            <select
              value={l.type}
              onChange={(e) => {
                const type = e.target.value as LessonType;
                setL({
                  ...l,
                  type,
                  studentCount:
                    type === "individual" ? 1 : type === "pair" ? 2 : 4,
                });
              }}
            >
              {Object.entries(labels).map(([k, v]) => (
                <option value={k} key={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          {l.type !== "individual" && (
            <Field label="Количество учеников">
              <input
                type="number"
                min="1"
                required
                value={l.studentCount}
                onChange={(e) => setL({ ...l, studentCount: +e.target.value })}
              />
            </Field>
          )}
          <div className="form-grid">
            <Field label="Повторение">
              <select
                value={l.recurrence}
                onChange={(e) =>
                  setL({
                    ...l,
                    recurrence: e.target.value as Lesson["recurrence"],
                  })
                }
              >
                <option value="weekly">каждую неделю</option>
                <option value="biweekly">каждые 2 недели</option>
                <option value="once">один раз</option>
              </select>
            </Field>
            <Field label="Дата начала">
              <input
                type="date"
                value={l.startDate}
                onChange={(e) => setL({ ...l, startDate: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Своя цена (необязательно)">
            <input
              type="number"
              min="0"
              value={l.customPrice}
              onChange={(e) => setL({ ...l, customPrice: e.target.value })}
            />
          </Field>
          <div className="revenue-preview">
            <span>Доход занятия</span>
            <b>{money(revenue, state.currency)}</b>
          </div>
          <button className="btn primary full">Добавить занятие</button>
        </form>
      </Modal>
    );
  }
  function ExpenseModal() {
    const existing = state.expenses.find(
      (item) => item.id === editingExpenseId,
    );
    const [e, setE] = useState<Expense>(
      existing ?? {
        id: "",
        title: "",
        amount: 0,
        frequency: "annual",
        category: "Сервисы",
        enabled: true,
      },
    );
    return (
      <Modal
        title={existing ? "Редактировать расход" : "Новый расход"}
        onClose={() => {
          setEditingExpenseId(null);
          setModal(null);
        }}
      >
        <form
          onSubmit={(x) => {
            x.preventDefault();
            if (e.amount < 0 || !e.title) return;
            const saved = { ...e, id: existing?.id ?? crypto.randomUUID() };
            setState({
              ...state,
              expenses: existing
                ? state.expenses.map((item) =>
                    item.id === existing.id ? saved : item,
                  )
                : [...state.expenses, saved],
            });
            setEditingExpenseId(null);
            setModal(null);
          }}
        >
          <Field label="Название">
            <input
              required
              value={e.title}
              onChange={(x) => setE({ ...e, title: x.target.value })}
            />
          </Field>
          <Field label="Сумма">
            <input
              required
              type="number"
              min="0"
              value={e.amount || ""}
              onChange={(x) => setE({ ...e, amount: +x.target.value })}
            />
          </Field>
          <Field label="Периодичность">
            <select
              value={e.frequency}
              onChange={(x) =>
                setE({
                  ...e,
                  frequency: x.target.value as Expense["frequency"],
                })
              }
            >
              <option value="annual">за год</option>
              <option value="monthly">ежемесячно</option>
              <option value="oneTime">разово</option>
            </select>
          </Field>
          {e.frequency === "oneTime" && (
            <Field label="Дата">
              <input
                type="date"
                required
                value={e.date ?? ""}
                onChange={(x) => setE({ ...e, date: x.target.value })}
              />
            </Field>
          )}
          <Field label="Категория">
            <select
              value={e.category}
              onChange={(x) => setE({ ...e, category: x.target.value })}
            >
              {[
                "Обучение",
                "Сервисы",
                "Техника",
                "Реклама",
                "Налоги",
                "Материалы",
                "Прочее",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          {e.frequency === "annual" && e.amount > 0 && (
            <div className="revenue-preview">
              <span>Нагрузка в месяц</span>
              <b>{money(e.amount / 12, state.currency)}</b>
            </div>
          )}
          <button className="btn primary full">
            {existing ? "Сохранить изменения" : "Добавить расход"}
          </button>
        </form>
      </Modal>
    );
  }
  function GoalModal() {
    const [g, setG] = useState(state.goal);
    return (
      <Modal title="Изменить цель" onClose={() => setModal(null)}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (g.targetAmount <= 0) return;
            setState({
              ...state,
              goal: { ...g, updatedAt: new Date().toISOString() },
            });
            setModal(null);
          }}
        >
          <Field label="Название">
            <input
              value={g.title}
              onChange={(e) => setG({ ...g, title: e.target.value })}
            />
          </Field>
          <Field label="Сумма цели">
            <input
              type="number"
              min="1"
              required
              value={g.targetAmount}
              onChange={(e) => setG({ ...g, targetAmount: +e.target.value })}
            />
          </Field>
          <button className="btn primary full">Сохранить цель</button>
        </form>
      </Modal>
    );
  }
  function PricingModal() {
    const [p, setP] = useState(state.pricing);
    return (
      <Modal title="Стоимость занятий" onClose={() => setModal(null)}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setState({ ...state, pricing: p });
            setModal(null);
          }}
        >
          {(["individual", "pair", "group"] as LessonType[]).map((t) => (
            <div className="price-row" key={t}>
              <b>{labels[t]}</b>
              <input
                type="number"
                min="0"
                value={p[t].amount}
                onChange={(e) =>
                  setP({ ...p, [t]: { ...p[t], amount: +e.target.value } })
                }
              />
              {t !== "individual" && (
                <select
                  value={p[t].mode}
                  onChange={(e) =>
                    setP({
                      ...p,
                      [t]: { ...p[t], mode: e.target.value as PricingMode },
                    })
                  }
                >
                  <option value="perStudent">за ученика</option>
                  <option value="perLesson">за занятие</option>
                </select>
              )}
            </div>
          ))}
          <p className="hint">
            Новые цены применятся к будущему прогнозу. Уроки со своей ценой не
            изменятся.
          </p>
          <button className="btn primary full">Сохранить цены</button>
        </form>
      </Modal>
    );
  }
}
