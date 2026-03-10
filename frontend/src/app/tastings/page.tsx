'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Wine, Calendar, MapPin, Users, Clock, History } from 'lucide-react';
import { useTastingSessions } from '@/lib/hooks/useTastings';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';
import { PageHeader, SearchInput, Button, Skeleton, Card, CardHeader, CardTitle, CardContent, CardFooter, Badge } from '@/components/ui';
import { Pagination } from '@/components/ui/Pagination';
import { useAppState } from '@/lib/store';
import type { TastingSession } from '@/types';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function isSessionExpired(dateString: string): boolean {
  const sessionDate = new Date(dateString);
  const today = new Date();
  // Set both to start of day for comparison
  sessionDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return sessionDate < today;
}

interface TastingSessionCardProps {
  session: TastingSession;
  expired?: boolean;
  isOwn?: boolean;
  isInvited?: boolean;
}

function TastingSessionCard({ session, expired, isOwn, isInvited }: TastingSessionCardProps) {
  return (
    <Link href={`/tastings/${session.id}`} className="block">
      <Card interactive className={`h-full ${expired ? 'opacity-75' : ''}`}>
        <CardHeader>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="truncate">{session.name}</CardTitle>
              {isOwn && (
                <Badge variant="success" className="text-xs shrink-0">Yours</Badge>
              )}
              {!isOwn && isInvited && (
                <Badge variant="success" className="text-xs shrink-0">Invited</Badge>
              )}
              {expired && (
                <Badge variant="secondary" className="text-xs shrink-0">Past</Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              <Calendar className="h-3.5 w-3.5" />
              <span>{formatDate(session.date)}</span>
            </div>
          </div>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            expired
              ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500'
              : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
          }`}>
            <Wine className="h-5 w-5" />
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
            {session.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-zinc-400" />
                <span className="truncate">{session.location}</span>
              </div>
            )}
            {session.participants && session.participants.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-zinc-400" />
                <span className="truncate">
                  {session.participants.length} attendee{session.participants.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate">
            {session.notes ? session.notes.substring(0, 60) + (session.notes.length > 60 ? '...' : '') : 'No notes'}
          </p>
        </CardFooter>
      </Card>
    </Link>
  );
}

export default function TastingsPage() {
  const { userId } = useAppState();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [pageNumber, setPageNumber] = useState(1);
  useEffect(() => setPageNumber(1), [debouncedSearch]);

  const { data, isLoading, error } = useTastingSessions({
    page_size: 30,
    page_number: pageNumber,
    search: debouncedSearch || undefined,
  });
  const sessions = data?.items ?? [];

  const { ongoingSessions, expiredSessions } = useMemo(() => {
    if (!sessions || sessions.length === 0) return { ongoingSessions: [], expiredSessions: [] };

    const ongoing: TastingSession[] = [];
    const expired: TastingSession[] = [];

    sessions.forEach((session) => {
      if (isSessionExpired(session.date)) {
        expired.push(session);
      } else {
        ongoing.push(session);
      }
    });

    // Sort ongoing by date ascending (nearest first)
    ongoing.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    // Sort expired by date descending (most recent first)
    expired.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { ongoingSessions: ongoing, expiredSessions: expired };
  }, [sessions]);

  const hasNoSessions = ongoingSessions.length === 0 && expiredSessions.length === 0;

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-600 dark:text-red-400">
          Failed to load tasting sessions. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 max-w-7xl mx-auto">
        <PageHeader
          title="Tasting Sessions"
          description="Track recipe tastings and feedback from R&D sessions"
        >
          <Link href="/tastings/new">
            <Button>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Session</span>
            </Button>
          </Link>
        </PageHeader>

        {/* Toolbar */}
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center">
          <div className="flex-1 max-w-md">
            <SearchInput
              placeholder="Search sessions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch('')}
            />
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-lg" />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && hasNoSessions && (
          <div className="text-center py-12">
            <Wine className="h-12 w-12 mx-auto mb-4 text-zinc-300 dark:text-zinc-600" />
            <p className="text-zinc-500 dark:text-zinc-400">
              {search ? 'No sessions match your search' : 'No tasting sessions yet'}
            </p>
            <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-2">
              Create your first tasting session to start tracking recipe feedback
            </p>
            <Link href="/tastings/new" className="mt-4 inline-block">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Session
              </Button>
            </Link>
          </div>
        )}

        {/* Ongoing Sessions */}
        {!isLoading && ongoingSessions.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-purple-500" />
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Upcoming & Today
              </h2>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                ({ongoingSessions.length})
              </span>
            </div>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {ongoingSessions.map((session) => (
                <TastingSessionCard key={session.id} session={session} isOwn={!!(userId && session.creator_id === userId)} isInvited={!!(userId && session.participants?.some((p) => p.user_id === userId))} />
              ))}
            </div>
          </div>
        )}

        {/* Expired Sessions */}
        {!isLoading && expiredSessions.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <History className="h-5 w-5 text-zinc-400" />
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Past Sessions
              </h2>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                ({expiredSessions.length})
              </span>
            </div>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {expiredSessions.map((session) => (
                <TastingSessionCard key={session.id} session={session} expired isOwn={!!(userId && session.creator_id === userId)} isInvited={!!(userId && session.participants?.some((p) => p.user_id === userId))} />
              ))}
            </div>
          </div>
        )}

        {/* Pagination */}
        {data && (
          <Pagination
            pageNumber={data.page_number}
            totalPages={data.total_pages}
            totalCount={data.total_count}
            currentPageSize={data.current_page_size}
            onPageChange={setPageNumber}
          />
        )}
      </div>
    </div>
  );
}
