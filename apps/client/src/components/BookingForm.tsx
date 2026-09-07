import { useState, type FormEvent } from 'react';
export function BookingForm({
  pending,
  onQuote,
  onCreate,
}: {
  pending: boolean;
  onQuote(start: string, end: string): Promise<void>;
  onCreate(start: string, end: string): Promise<void>;
}) {
  const [start, setStart] = useState(''),
    [end, setEnd] = useState('');
  const run = (e: FormEvent, fn: (a: string, b: string) => Promise<void>) => {
    e.preventDefault();
    void fn(start, end);
  };
  return (
    <form onSubmit={(e) => run(e, onCreate)}>
      <p>The return date is exclusive and is not billed.</p>
      <label>
        Start date
        <input
          type="date"
          required
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
      </label>
      <label>
        Return date
        <input
          type="date"
          required
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </label>
      <button disabled={pending} type="button" onClick={(e) => run(e, onQuote)}>
        Get quote
      </button>
      <button disabled={pending}>Create booking</button>
    </form>
  );
}
