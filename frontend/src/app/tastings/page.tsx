'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Plus, Wine, Calendar, MapPin, Users, Clock, History } from 'lucide-react';
import { useTastingSessions } from '@/lib/hooks/useTastings';
import { PageHeader, SearchInput, Button, Skeleton, Card, CardHeader, CardTitle, CardContent, CardFooter, Badge } from '@/components/ui';
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
}

function TastingSessionCard({ session, expired }: TastingSessionCardProps) {
  return (
    <Link href={`/tastings/${session.id}`} className="block">
      <Card interactive className={`h-full ${expired ? 'opacity-75' : ''}`}>
        <CardHeader>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="truncate">{session.name}</CardTitle>
              {expired && (
                <Badge variant="secondary" className="text-xs">Past</Badge>
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
            {session.attendees && session.attendees.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-zinc-400" />
                <span className="truncate">
                  {session.attendees.length} attendee{session.attendees.length !== 1 ? 's' : ''}
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
  const { data: sessions, isLoading, error } = useTastingSessions();
  const [search, setSearch] = useState('');

  const { ongoingSessions, expiredSessions } = useMemo(() => {
    if (!sessions) return { ongoingSessions: [], expiredSessions: [] };

    let filtered = sessions;
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = sessions.filter(
        (session) =>
          session.name.toLowerCase().includes(searchLower) ||
          session.location?.toLowerCase().includes(searchLower) ||
          session.attendees?.some((a) => a.toLowerCase().includes(searchLower))
      );
    }

    const ongoing: TastingSession[] = [];
    const expired: TastingSession[] = [];

    filtered.forEach((session) => {
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
  }, [sessions, search]);

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
                <TastingSessionCard key={session.id} session={session} />
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
                <TastingSessionCard key={session.id} session={session} expired />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
