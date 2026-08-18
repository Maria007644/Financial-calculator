import type {AppState,Expense,Lesson,PricingRule} from './types';
export const STORAGE_KEY='tutorFinanceApp:v1';
export const uid=()=>globalThis.crypto?.randomUUID?.()??`id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const iso=(d:Date)=>{const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`};
export const parseDate=(s:string)=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
export const startOfWeek=(d:Date)=>{const x=new Date(d);x.setHours(0,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return x};
export const endOfMonth=(d:Date)=>new Date(d.getFullYear(),d.getMonth()+1,0);
export function calculateLessonRevenue(l:Lesson,p:Record<string,PricingRule>){if(l.status==='cancelled')return 0;const amount=l.customPrice??p[l.type].amount;const mode=l.customPrice!=null?(l.customPricingMode??p[l.type].mode):p[l.type].mode;return mode==='perStudent'?amount*l.studentCount:amount}
export function generateLessonOccurrences(l:Lesson,from:Date,to:Date){const out:Date[]=[];const start=parseDate(l.startDate),end=l.endDate?parseDate(l.endDate):to;for(let d=new Date(from);d<=to;d.setDate(d.getDate()+1)){const x=new Date(d);if(x<start||x>end||x.getDay()!==l.weekday||l.excludedDates.includes(iso(x)))continue;if(l.recurrence==='once'&&iso(x)!==l.startDate)continue;if(l.recurrence==='biweekly'&&Math.floor((+x-+start)/86400000/7)%2!==0)continue;out.push(x)}return out}
export function revenueBetween(s:AppState,from:Date,to:Date){return s.lessons.reduce((sum,l)=>sum+generateLessonOccurrences(l,from,to).length*calculateLessonRevenue(l,s.pricing),0)}
export function calculateRevenueForMonth(s:AppState,d:Date){return revenueBetween(s,new Date(d.getFullYear(),d.getMonth(),1),endOfMonth(d))}
export function expenseForMonth(e:Expense,d:Date){if(!e.enabled)return 0;if(e.frequency==='annual')return e.amount/12;if(e.frequency==='monthly')return e.amount;if(!e.date)return 0;const x=parseDate(e.date);return x.getFullYear()===d.getFullYear()&&x.getMonth()===d.getMonth()?e.amount:0}
export const calculateExpensesForMonth=(s:AppState,d:Date)=>s.expenses.reduce((a,e)=>a+expenseForMonth(e,d),0);
export const calculateGoalProgress=(forecast:number,target:number)=>target>0?forecast/target:0;
export const calculateRequiredLessonsForGoal=(gap:number,revenue:number)=>revenue>0?Math.ceil(Math.max(0,gap)/revenue):0;
export const defaultState=():AppState=>{const now=new Date(),end=endOfMonth(now),stamp=new Date().toISOString();return {schemaVersion:1,onboarded:false,profile:{name:'',gender:'female'},currency:'RUB',goalMode:'net',goal:{id:uid(),title:'Моя цель на месяц',targetAmount:120000,periodType:'month',startDate:iso(new Date(now.getFullYear(),now.getMonth(),1)),endDate:iso(end),createdAt:stamp,updatedAt:stamp},pricing:{individual:{amount:1500,mode:'perLesson'},pair:{amount:1100,mode:'perStudent'},group:{amount:900,mode:'perStudent'}},lessons:[],expenses:[],celebratedMilestones:[]}}
export function loadState(){try{const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return defaultState();const data=JSON.parse(raw);if(data.schemaVersion!==1||!data.goal||!data.pricing||!Array.isArray(data.lessons))return defaultState();return {...defaultState(),...data,profile:{...defaultState().profile,...data.profile}} as AppState}catch{return defaultState()}}
export const saveState=(s:AppState)=>localStorage.setItem(STORAGE_KEY,JSON.stringify(s));
export const money=(n:number,c='RUB')=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:c,maximumFractionDigits:Number.isInteger(n)?0:2}).format(n);
