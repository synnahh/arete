import { describe, it, expect } from 'vitest';
import { buildDay, daySummary, overdue, weekStrip, weekStart, upcoming, weekdayKey, addDays } from './plan.js';

const TODAY = '2026-10-01'; // a Thursday
const task = (o) => ({ id: o.id ?? o.text, done: false, priority: 'med', ...o });
const program = { days: { mon: { splitType: 'push', label: 'Push' }, thu: { splitType: 'legs', label: 'Legs' }, fri: { splitType: 'rest' } } };

describe('weekday and week maths', () => {
  it('maps dates to weekday keys and the Monday that starts the week', () => {
    expect(weekdayKey('2026-10-01')).toBe('thu');
    expect(weekStart('2026-10-01')).toBe('2026-09-28');
    expect(weekStart('2026-09-28')).toBe('2026-09-28');
    expect(weekStart('2026-10-04')).toBe('2026-09-28'); // Sunday belongs to the week before
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(weekStart('nope')).toBeNull();
  });
});

describe('buildDay', () => {
  it('puts timed items first by clock, then training, then tasks by priority, and done items last', () => {
    const items = buildDay({
      date: TODAY, today: TODAY, program,
      events: [{ id: 'e1', title: 'Dentist', date: TODAY, time: '15:00' }, { id: 'e2', title: 'Standup', date: TODAY, time: '09:30' }],
      routines: [{ id: 'r1', name: 'Evening', steps: [{ time: '21:00', label: 'Wind down' }], reminder: { days: ['thu'] } }],
      tasks: [task({ text: 'Low thing', priority: 'low', dueDate: TODAY }), task({ text: 'Big thing', priority: 'high', dueDate: TODAY }), task({ text: 'Finished', done: true, dueDate: TODAY })],
    });
    expect(items.map(i => i.title)).toEqual(['Standup', 'Dentist', 'Evening', 'Train · Legs', 'Big thing', 'Low thing', 'Finished']);
  });

  it('shows undated open tasks on today only, and other dates only their own tasks', () => {
    const tasks = [task({ text: 'No date' }), task({ text: 'Tomorrow', dueDate: '2026-10-02' }), task({ text: 'Done undated', done: true })];
    expect(buildDay({ date: TODAY, today: TODAY, tasks }).map(i => i.title)).toEqual(['No date']);
    expect(buildDay({ date: '2026-10-02', today: TODAY, tasks }).map(i => i.title)).toEqual(['Tomorrow']);
  });

  it('only lists routines on their reminder days, skips inactive ones, and ignores rest days', () => {
    const routines = [{ name: 'Morning', steps: [], reminder: { days: ['fri'] } }, { name: 'Off', active: false, reminder: { days: ['thu'] } }];
    expect(buildDay({ date: TODAY, today: TODAY, routines, program: null })).toEqual([]);
    expect(buildDay({ date: '2026-10-02', today: TODAY, routines, program }).map(i => i.title)).toEqual(['Morning']); // Friday is a rest day
  });

  it('marks the training session done when a workout is logged that date', () => {
    const train = buildDay({ date: TODAY, today: TODAY, program, workouts: [{ date: TODAY }] }).find(i => i.kind === 'train');
    expect(train.done).toBe(true);
  });

  it('copes with bad dates, untitled events and calendar-API shaped events', () => {
    expect(buildDay({ date: 'soon', today: TODAY })).toEqual([]);
    const items = buildDay({ date: TODAY, today: TODAY, events: [{ title: '', date: TODAY }, { id: 'g', title: 'Gcal', start: { dateTime: '2026-10-01T08:15:00+10:00' } }] });
    expect(items.map(i => [i.title, i.time])).toEqual([['Gcal', '08:15']]);
  });
});

describe('daySummary / overdue', () => {
  it('counts tasks and training, not events', () => {
    const s = daySummary([{ kind: 'event', done: false }, { kind: 'task', done: true }, { kind: 'task', done: false }, { kind: 'train', done: true }]);
    expect(s).toEqual({ done: 2, total: 3, pct: 67 });
    expect(daySummary([])).toEqual({ done: 0, total: 0, pct: 0 });
  });

  it('lists open tasks due before today, oldest first', () => {
    const list = overdue([task({ text: 'b', dueDate: '2026-09-29' }), task({ text: 'a', dueDate: '2026-09-20' }), task({ text: 'today', dueDate: TODAY }), task({ text: 'done', done: true, dueDate: '2026-09-01' }), task({ text: 'undated' })], TODAY);
    expect(list.map(t => t.text)).toEqual(['a', 'b']);
  });
});

describe('weekStrip / upcoming', () => {
  it('gives seven days Monday to Sunday with load counts and the selected and today flags', () => {
    const strip = weekStrip({ anchor: TODAY, today: TODAY, selected: '2026-10-02', program,
      tasks: [task({ text: 'x', dueDate: '2026-10-02' }), task({ text: 'y', dueDate: '2026-10-02', done: true })], events: [{ title: 'E', date: '2026-10-02', time: '10:00' }] });
    expect(strip.map(d => d.weekday)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    const fri = strip[4];
    expect(fri.date).toBe('2026-10-02');
    expect(fri).toMatchObject({ isSelected: true, isToday: false, open: 1, events: 1, train: false });
    expect(strip[3]).toMatchObject({ isToday: true, train: true });
  });

  it('groups what is coming in the next days, skipping empty days and finished tasks', () => {
    const up = upcoming({ today: TODAY, days: 7, events: [{ title: 'Late', date: '2026-10-03', time: '18:00' }, { title: 'Early', date: '2026-10-03', time: '07:00' }], tasks: [task({ text: 'T', dueDate: '2026-10-05' }), task({ text: 'D', dueDate: '2026-10-04', done: true }), task({ text: 'Far', dueDate: '2026-10-20' })] });
    expect(up.map(d => d.date)).toEqual(['2026-10-03', '2026-10-05']);
    expect(up[0].items.map(i => i.title)).toEqual(['Early', 'Late']);
  });
});

import { advanceByRepeat, nextOccurrence } from './tasks.js';

describe('repeating tasks', () => {
  it('advances by day, week and month, and leaves other repeats alone', () => {
    expect(advanceByRepeat('2026-10-01', 'daily')).toBe('2026-10-02');
    expect(advanceByRepeat('2026-10-01', 'weekly')).toBe('2026-10-08');
    expect(advanceByRepeat('2026-01-31', 'monthly')).toBe('2026-03-03'); // JS month rollover, same as the Tasks screen has always done
    expect(advanceByRepeat('2026-10-01', 'none')).toBe('2026-10-01');
    expect(advanceByRepeat('', 'daily', '2026-10-01')).toBe('2026-10-02'); // undated: counts from today
  });

  it('builds the next row only for a repeating task', () => {
    expect(nextOccurrence({ text: 'x', repeat: 'none' })).toBeNull();
    expect(nextOccurrence({ text: 'x' })).toBeNull();
    expect(nextOccurrence({ text: 'Prep', priority: 'high', dueDate: '2026-10-01', repeat: 'weekly', category: 'Home' }, '2026-10-01'))
      .toEqual({ text: 'Prep', description: '', priority: 'high', dueDate: '2026-10-08', category: 'Home', repeat: 'weekly', done: false });
  });
});
