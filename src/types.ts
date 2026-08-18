export type LessonType='individual'|'pair'|'group';
export type PricingMode='perStudent'|'perLesson';
export interface PricingRule{amount:number;mode:PricingMode}
export interface Lesson{id:string;title:string;weekday:number;time:string;type:LessonType;studentCount:number;duration:number;startDate:string;endDate?:string;recurrence:'once'|'weekly'|'biweekly';customPrice?:number;customPricingMode?:PricingMode;excludedDates:string[];status:'planned'|'completed'|'cancelled'}
export interface Expense{id:string;title:string;amount:number;frequency:'annual'|'monthly'|'oneTime';category:string;date?:string;enabled:boolean}
export interface Goal{id:string;title:string;targetAmount:number;periodType:'month'|'year'|'custom';startDate:string;endDate:string;createdAt:string;updatedAt:string}
export interface AppState{schemaVersion:1;onboarded:boolean;profile:{name:string;gender:'female'|'male'};currency:'RUB'|'EUR'|'USD'|'CHF';goalMode:'net'|'gross';goal:Goal;pricing:Record<LessonType,PricingRule>;lessons:Lesson[];expenses:Expense[];celebratedMilestones:number[]}
