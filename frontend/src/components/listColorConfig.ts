export type ListColorKey =
  | 'default'
  | 'blue'
  | 'green'
  | 'yellow'
  | 'orange'
  | 'red'
  | 'purple'
  | 'pink'
  | 'teal'
  | 'gray';

export interface ListColorDefinition {
  key: ListColorKey;
  label: string;
  dotClass: string;
  containerClass: string;
  headerBadgeClass: string;
  addBtnClass: string;
  dragOverClass: string;
  borderClass: string;
}

export const LIST_COLOR_MAP: Record<ListColorKey, ListColorDefinition> = {
  default: {
    key: 'default',
    label: '標準',
    dotClass: 'bg-slate-400',
    containerClass: 'bg-slate-100/90 border-slate-200/60',
    headerBadgeClass: 'bg-slate-200 text-slate-600',
    addBtnClass: 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60',
    dragOverClass: 'bg-indigo-50/50',
    borderClass: 'border-slate-200/60',
  },
  blue: {
    key: 'blue',
    label: 'ブルー',
    dotClass: 'bg-sky-500',
    containerClass: 'bg-sky-50/90 border-sky-200/70',
    headerBadgeClass: 'bg-sky-100 text-sky-700',
    addBtnClass: 'text-sky-700 hover:text-sky-900 hover:bg-sky-100/60',
    dragOverClass: 'bg-sky-100/50',
    borderClass: 'border-sky-200/70',
  },
  green: {
    key: 'green',
    label: 'グリーン',
    dotClass: 'bg-emerald-500',
    containerClass: 'bg-emerald-50/90 border-emerald-200/70',
    headerBadgeClass: 'bg-emerald-100 text-emerald-700',
    addBtnClass: 'text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100/60',
    dragOverClass: 'bg-emerald-100/50',
    borderClass: 'border-emerald-200/70',
  },
  yellow: {
    key: 'yellow',
    label: 'イエロー',
    dotClass: 'bg-amber-500',
    containerClass: 'bg-amber-50/90 border-amber-200/70',
    headerBadgeClass: 'bg-amber-100 text-amber-800',
    addBtnClass: 'text-amber-800 hover:text-amber-950 hover:bg-amber-100/60',
    dragOverClass: 'bg-amber-100/50',
    borderClass: 'border-amber-200/70',
  },
  orange: {
    key: 'orange',
    label: 'オレンジ',
    dotClass: 'bg-orange-500',
    containerClass: 'bg-orange-50/90 border-orange-200/70',
    headerBadgeClass: 'bg-orange-100 text-orange-800',
    addBtnClass: 'text-orange-800 hover:text-orange-950 hover:bg-orange-100/60',
    dragOverClass: 'bg-orange-100/50',
    borderClass: 'border-orange-200/70',
  },
  red: {
    key: 'red',
    label: 'レッド',
    dotClass: 'bg-rose-500',
    containerClass: 'bg-rose-50/90 border-rose-200/70',
    headerBadgeClass: 'bg-rose-100 text-rose-700',
    addBtnClass: 'text-rose-700 hover:text-rose-900 hover:bg-rose-100/60',
    dragOverClass: 'bg-rose-100/50',
    borderClass: 'border-rose-200/70',
  },
  purple: {
    key: 'purple',
    label: 'パープル',
    dotClass: 'bg-purple-500',
    containerClass: 'bg-purple-50/90 border-purple-200/70',
    headerBadgeClass: 'bg-purple-100 text-purple-700',
    addBtnClass: 'text-purple-700 hover:text-purple-900 hover:bg-purple-100/60',
    dragOverClass: 'bg-purple-100/50',
    borderClass: 'border-purple-200/70',
  },
  pink: {
    key: 'pink',
    label: 'ピンク',
    dotClass: 'bg-pink-500',
    containerClass: 'bg-pink-50/90 border-pink-200/70',
    headerBadgeClass: 'bg-pink-100 text-pink-700',
    addBtnClass: 'text-pink-700 hover:text-pink-900 hover:bg-pink-100/60',
    dragOverClass: 'bg-pink-100/50',
    borderClass: 'border-pink-200/70',
  },
  teal: {
    key: 'teal',
    label: 'ティール',
    dotClass: 'bg-teal-500',
    containerClass: 'bg-teal-50/90 border-teal-200/70',
    headerBadgeClass: 'bg-teal-100 text-teal-700',
    addBtnClass: 'text-teal-700 hover:text-teal-900 hover:bg-teal-100/60',
    dragOverClass: 'bg-teal-100/50',
    borderClass: 'border-teal-200/70',
  },
  gray: {
    key: 'gray',
    label: 'グレー',
    dotClass: 'bg-zinc-400',
    containerClass: 'bg-zinc-100/90 border-zinc-200/70',
    headerBadgeClass: 'bg-zinc-200 text-zinc-700',
    addBtnClass: 'text-zinc-700 hover:text-zinc-900 hover:bg-zinc-200/60',
    dragOverClass: 'bg-zinc-200/50',
    borderClass: 'border-zinc-200/70',
  },
};

export const LIST_COLOR_OPTIONS: ListColorDefinition[] = [
  LIST_COLOR_MAP.default,
  LIST_COLOR_MAP.blue,
  LIST_COLOR_MAP.green,
  LIST_COLOR_MAP.yellow,
  LIST_COLOR_MAP.orange,
  LIST_COLOR_MAP.red,
  LIST_COLOR_MAP.purple,
  LIST_COLOR_MAP.pink,
  LIST_COLOR_MAP.teal,
  LIST_COLOR_MAP.gray,
];

export function getListColorConfig(color?: string | null): ListColorDefinition {
  if (!color || color === 'default') {
    return LIST_COLOR_MAP.default;
  }
  return LIST_COLOR_MAP[color as ListColorKey] || LIST_COLOR_MAP.default;
}
