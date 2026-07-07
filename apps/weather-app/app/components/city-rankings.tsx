import { useSuspenseQuery } from '@tanstack/react-query';
import { rankActivities } from '~/graphql/client';

export function CityRankings({ city }: { city: string }) {
  const { data } = useSuspenseQuery({
    queryKey: ['rankActivities', city],
    queryFn: () => rankActivities(city),
  });

  const place = [data.location.name, data.location.admin1, data.location.country]
    .filter(Boolean)
    .join(', ');

  return (
    <section className="mt-6 space-y-4">
      <h2 className="text-lg font-semibold text-text">{place}</h2>
      {data.rankings.map((ranking) => (
        <article key={ranking.activity} className="rounded border border-text-muted/20 p-4">
          <h3 className="flex items-center justify-between font-medium text-text">
            <span>{ranking.activity}</span>
            <span>{ranking.overallScore}</span>
          </h3>
          <ul className="mt-2 flex flex-wrap gap-3 text-sm text-text-muted">
            {ranking.daily.map((day) => (
              <li key={day.date}>
                {day.date}: {day.score}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}
