import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { CityRankings } from '~/components/city-rankings';
import { RankingSkeleton } from '~/components/ranking-skeleton';
import { ErrorBoundary } from '~/components/error-boundary';

const formSchema = z.object({
  city: z.string().trim().min(1, 'Enter a city'),
});
type FormValues = z.infer<typeof formSchema>;

export function App() {
  const [city, setCity] = useState('');
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { city: '' },
  });

  function onSubmit(values: FormValues) {
    setCity(values.city);
  }

  return (
    <main className="bg-surface text-text p-page">
      <h1 className="text-text">Weather-driven activity rankings</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 flex items-end gap-3">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. London" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit">Rank activities</Button>
        </form>
      </Form>

      {city && (
        <ErrorBoundary key={city}>
          <Suspense fallback={<RankingSkeleton />}>
            <CityRankings city={city} />
          </Suspense>
        </ErrorBoundary>
      )}
    </main>
  );
}

export default App;
