import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
export function HomeSearch() {
  const navigate = useNavigate();
  const [category, setCategory] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    navigate(
      category ? `/cars?category=${encodeURIComponent(category)}` : '/cars',
    );
  }
  return (
    <form className="hero-search" aria-label="Find a car" onSubmit={submit}>
      <label>
        Vehicle type
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="">All vehicles</option>
          <option value="hatchback">Hatchback</option>
          <option value="sedan">Sedan</option>
          <option value="suv">SUV</option>
          <option value="luxury">Luxury</option>
          <option value="van">Van</option>
        </select>
      </label>
      <label>
        Start date
        <input type="date" />
      </label>
      <label>
        Return date
        <input type="date" />
      </label>
      <button className="button button-accent">Search cars</button>
    </form>
  );
}
