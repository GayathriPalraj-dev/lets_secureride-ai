import type { CarListQuery } from '@lets-secureride-ai/contracts';
export function CarFilters({
  value,
  onChange,
}: {
  value: CarListQuery;
  onChange(value: CarListQuery): void;
}) {
  function changed(key: keyof CarListQuery, next: string) {
    const result = { ...value };
    delete result[key];
    onChange(
      next ? { ...result, [key]: next, page: 1 } : { ...result, page: 1 },
    );
  }
  return (
    <form
      className="filters"
      onSubmit={(event) => event.preventDefault()}
      aria-label="Filter cars"
    >
      <label>
        Make
        <input
          value={value.make ?? ''}
          onChange={(e) => changed('make', e.target.value)}
        />
      </label>
      <label>
        Category
        <select
          value={value.category ?? ''}
          onChange={(e) => changed('category', e.target.value)}
        >
          <option value="">All</option>
          <option value="hatchback">Hatchback</option>
          <option value="sedan">Sedan</option>
          <option value="suv">SUV</option>
          <option value="luxury">Luxury</option>
          <option value="van">Van</option>
        </select>
      </label>
      <label>
        Transmission
        <select
          value={value.transmission ?? ''}
          onChange={(e) => changed('transmission', e.target.value)}
        >
          <option value="">All</option>
          <option value="manual">Manual</option>
          <option value="automatic">Automatic</option>
        </select>
      </label>
      <label>
        Sort
        <select
          value={value.sort ?? 'make_asc'}
          onChange={(e) => changed('sort', e.target.value)}
        >
          <option value="make_asc">Make</option>
          <option value="price_asc">Price: low first</option>
          <option value="price_desc">Price: high first</option>
          <option value="year_desc">Newest</option>
        </select>
      </label>
      <button
        type="button"
        onClick={() =>
          onChange({
            page: 1,
            ...(value.pageSize ? { pageSize: value.pageSize } : {}),
          })
        }
      >
        Clear filters
      </button>
    </form>
  );
}
