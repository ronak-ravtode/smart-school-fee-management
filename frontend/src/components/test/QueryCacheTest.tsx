import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Post {
  id: number;
  title: string;
  body: string;
}

async function fetchPost(): Promise<Post> {
  const response = await fetch(
    "https://jsonplaceholder.typicode.com/posts/1"
  );
  if (!response.ok) throw new Error("Failed to fetch");
  return response.json();
}

export function QueryCacheTest() {
  const { data, isLoading, isError, error, fetchStatus } = useQuery({
    queryKey: ["test-post"],
    queryFn: fetchPost,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-slate-900">TanStack Query Cache Test</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            Fetch status: <span className="font-mono text-slate-700">{fetchStatus}</span>
          </p>
          {isLoading && <p className="text-sm text-slate-600">Loading...</p>}
          {isError && (
            <p className="text-sm text-red-600">Error: {error.message}</p>
          )}
          {data && (
            <div>
              <p className="text-sm font-medium text-slate-800">{data.title}</p>
              <p className="text-xs text-slate-600 mt-1">{data.body.slice(0, 100)}...</p>
            </div>
          )}
          <p className="text-xs text-slate-500 mt-2">
            Navigate away and back — network tab should NOT show a new request.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
